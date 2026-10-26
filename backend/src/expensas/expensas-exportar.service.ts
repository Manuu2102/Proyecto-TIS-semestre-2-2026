import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExpensasService } from './expensas.service.js';
import { ExportarSaldosDto } from './dto/exportar.dto.js';
import { generarPdf, filaTabla, ANCHO_TABLA, type LineaPdf } from '../lib/exportar.js';
import { generarExcel } from '../lib/excel.js';
import { datosEmision } from '../lib/emision.js';
import { MESES, TIPO_XLSX, bs, fechaCorta } from '../lib/formato.js';

type Formato = 'pdf' | 'excel';
type Archivo = { contenido: Buffer; nombre: string; tipo: string };
type EstadoDepto = 'Al día' | 'En mora' | 'Pendiente';

type FilaSaldo = {
  numero: number;
  responsable: string;
  categoria: string;
  sinPagar: number;
  adeudado: number;
  mora: number;
  saldoTotal: number;
  estado: EstadoDepto;
};

type EstadoCuenta = Awaited<ReturnType<ExpensasService['estadoCuenta']>>;
type MovimientoCuenta = EstadoCuenta['movimientos'][number];

const r2 = (n: number) => Math.round(n * 100) / 100;

// Igual que el buscador de la pantalla: sin mayúsculas ni tildes
const normalizar = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const nombrePeriodo = (periodo: string) => {
  const [anio, mes] = periodo.split('-').map(Number);
  return `${MESES[mes - 1]} ${anio}`;
};

/**
 * Exportación a PDF y Excel de las pantallas de expensas: Saldos pendientes (Pagos y
 * mora) y Estado de cuenta. Usa los mismos cálculos que el backend ya entrega a esas
 * pantallas, así el archivo muestra lo mismo que se ve.
 */
@Injectable()
export class ExpensasExportarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expensas: ExpensasService,
  ) {}

  // =====================================================================
  // Saldos pendientes (pantalla Pagos y mora)
  // =====================================================================

  /**
   * Filas de saldos con los filtros y el orden de la pantalla. Por departamento:
   * deudas sin pagar (del período, si se filtra), monto, mora, saldo descontando lo
   * que tiene a favor y estado.
   */
  private async filasSaldos(f: ExportarSaldosDto): Promise<FilaSaldo[]> {
    const resumen = await this.expensas.resumenPagos();

    const filas = resumen.departamentos.map((d): FilaSaldo => {
      const pendientes = resumen.deudas.filter(
        (x) =>
          x.departamento === d.numero &&
          x.monto + x.mora > 0 &&
          (!f.periodo || x.periodo === f.periodo),
      );
      const adeudado = r2(pendientes.reduce((s, x) => s + x.monto, 0));
      const mora = r2(pendientes.reduce((s, x) => s + x.mora, 0));
      return {
        numero: d.numero,
        responsable: d.responsable,
        categoria: d.categoria,
        sinPagar: pendientes.length,
        adeudado,
        mora,
        saldoTotal: r2(adeudado + mora - (resumen.aFavor[d.numero] ?? 0)),
        estado:
          pendientes.length === 0 ? 'Al día' : pendientes.some((x) => x.vencida) ? 'En mora' : 'Pendiente',
      };
    });

    const q = normalizar(f.busqueda ?? '');
    const campo = (f.orden ?? 'departamento') as keyof FilaSaldo | 'departamento';
    const valor = (fila: FilaSaldo) =>
      campo === 'departamento' ? fila.numero : campo === 'responsable' ? normalizar(fila.responsable) : fila[campo];

    return filas
      .filter(
        (fila) =>
          (!f.categoria || fila.categoria === f.categoria) &&
          (!f.estado || fila.estado === f.estado) &&
          (q === '' || String(fila.numero).includes(q) || normalizar(fila.responsable).includes(q)),
      )
      .sort((a, b) => {
        const x = valor(a);
        const y = valor(b);
        const comparacion =
          typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
        return f.dir === 'desc' ? -comparacion : comparacion;
      });
  }

  private async textoRegla() {
    const r = await this.expensas.obtenerReglaMora();
    if (!r.configurada) return 'se usa la mora definida en cada expensa';
    const frecuencia = r.frecuencia === 'dia' ? 'por cada día de atraso' : 'por cada mes de atraso';
    const monto =
      r.tipo === 'porcentaje'
        ? r.tope !== null
          ? `el menor valor entre ${r.valor}% de la expensa y ${bs(r.tope)}`
          : `${r.valor}% de la expensa`
        : bs(r.valor);
    return `sin mora antes del día ${r.dia}; desde ese día, ${monto}, ${frecuencia}`;
  }

  async exportarSaldos(f: ExportarSaldosDto, idUsuario: string): Promise<Archivo> {
    const filas = await this.filasSaldos(f);
    if (filas.length === 0) throw new BadRequestException('No hay datos para exportar.');

    const { edificio, emisor, emitido } = await datosEmision(this.prisma, idUsuario);
    const filtros =
      [
        f.periodo && `Período: ${nombrePeriodo(f.periodo)}`,
        f.categoria && `Categoría: ${f.categoria}`,
        f.estado && `Estado: ${f.estado}`,
        f.busqueda?.trim() && `Búsqueda: "${f.busqueda.trim()}"`,
      ]
        .filter(Boolean)
        .join(' · ') || 'Sin filtros';
    const suma = (campo: 'adeudado' | 'mora' | 'saldoTotal') => r2(filas.reduce((s, x) => s + x[campo], 0));
    const cabecera = [
      `Filtros aplicados: ${filtros}`,
      `Regla de mora vigente: ${await this.textoRegla()}`,
      `Emitido por: ${emisor}   ·   Fecha y hora de emisión: ${emitido}`,
    ];
    const totales: [string, number][] = [
      ['Total adeudado', suma('adeudado')],
      ['Mora acumulada', suma('mora')],
      ['Saldo total', suma('saldoTotal')],
    ];
    const nombre = `saldos-pendientes-${new Date().toISOString().slice(0, 10)}`;

    if (f.formato === 'excel') {
      const contenido = await generarExcel({
        hoja: 'Saldos pendientes',
        edificio,
        titulo: 'Saldos pendientes',
        cabecera,
        totales,
        columnas: [
          { titulo: 'Departamento', ancho: 14 },
          { titulo: 'Responsable', ancho: 30 },
          { titulo: 'Categoría', ancho: 11 },
          { titulo: 'Expensas sin pagar', ancho: 18 },
          { titulo: 'Monto adeudado (Bs)', ancho: 20, tipo: 'monto' },
          { titulo: 'Mora acumulada (Bs)', ancho: 20, tipo: 'monto' },
          { titulo: 'Saldo total (Bs)', ancho: 18, tipo: 'monto' },
          { titulo: 'Estado', ancho: 12 },
        ],
        filas: filas.map((x) => [x.numero, x.responsable, x.categoria, x.sinPagar, x.adeudado, x.mora, x.saldoTotal, x.estado]),
      });
      return { contenido, nombre: `${nombre}.xlsx`, tipo: TIPO_XLSX };
    }

    // Suma de anchos + separadores = ANCHO_TABLA
    const anchos = [6, 30, 4, 9, 14, 13, 14, 15];
    const derecha = [3, 4, 5, 6];
    // Un saldo negativo es dinero a favor del departamento
    const saldo = (n: number) => (n < 0 ? `A favor ${bs(-n)}` : bs(n));
    const lineas: LineaPdf[] = [
      { texto: edificio, estilo: 'titulo' },
      { texto: 'Saldos pendientes', estilo: 'subtitulo' },
      ...cabecera.map((texto) => ({ texto })),
      { texto: '' },
      ...totales.map(([etiqueta, valor], i) => ({
        texto: `${etiqueta}: ${i === totales.length - 1 ? saldo(valor) : bs(valor)}`,
        estilo: (i === totales.length - 1 ? 'subtitulo' : 'normal') as LineaPdf['estilo'],
      })),
      { texto: '' },
      {
        texto: filaTabla(['Dpto.', 'Responsable', 'Cat.', 'Sin pagar', 'Adeudado', 'Mora', 'Saldo total', 'Estado'], anchos, derecha),
        estilo: 'tabla-encabezado',
      },
      { texto: '-'.repeat(ANCHO_TABLA), estilo: 'tabla' },
      ...filas.map((x) => ({
        texto: filaTabla(
          [x.numero, x.responsable, x.categoria, x.sinPagar, bs(x.adeudado), bs(x.mora), saldo(x.saldoTotal), x.estado],
          anchos,
          derecha,
        ),
        estilo: 'tabla' as const,
      })),
    ];
    return { contenido: generarPdf(lineas), nombre: `${nombre}.pdf`, tipo: 'application/pdf' };
  }

  // =====================================================================
  // Estado de cuenta de un departamento
  // =====================================================================

  async exportarEstadoCuenta(numero: number, formato: Formato, idUsuario: string): Promise<Archivo> {
    const estado = await this.expensas.estadoCuenta(numero);
    if (estado.movimientos.length === 0) throw new BadRequestException('No hay datos para exportar.');

    const { edificio, emisor, emitido } = await datosEmision(this.prisma, idUsuario);
    const { depto, totales: t } = estado;
    const cabecera = [
      `Departamento: ${depto.numero}   ·   Categoría: ${depto.categoria}   ·   Responsable: ${depto.responsable}`,
      `Emitido por: ${emisor}   ·   Fecha y hora de emisión: ${emitido}`,
    ];
    const totales: [string, number][] = [
      ['Expensas emitidas', t.expensas],
      ['Pagos realizados', t.pagos],
      ['Anticipos pagados', t.anticipos],
      ['Moras generadas', t.moras],
      ['Saldo', t.saldo],
    ];
    const monto = (m: MovimientoCuenta, tipo: MovimientoCuenta['tipo']) => (m.tipo === tipo ? m.monto : '');
    const desglose = (m: MovimientoCuenta) =>
      'desglose' in m && m.desglose ? m.desglose.map((c) => `${c.concepto}: ${bs(c.monto)}`).join(' | ') : '';
    const vencimiento = (m: MovimientoCuenta) =>
      'vencimiento' in m && m.vencimiento ? fechaCorta(m.vencimiento) : '';
    const nombre = `estado-de-cuenta-dpto-${depto.numero}`;

    if (formato === 'excel') {
      const contenido = await generarExcel({
        hoja: `Dpto ${depto.numero}`,
        edificio,
        titulo: 'Estado de cuenta',
        cabecera,
        totales,
        columnas: [
          { titulo: 'Fecha', ancho: 12 },
          { titulo: 'Detalle', ancho: 36 },
          { titulo: 'Expensas emitidas (Bs)', ancho: 22, tipo: 'monto' },
          { titulo: 'Pagos realizados (Bs)', ancho: 21, tipo: 'monto' },
          { titulo: 'Anticipos pagados (Bs)', ancho: 22, tipo: 'monto' },
          { titulo: 'Moras generadas (Bs)', ancho: 21, tipo: 'monto' },
          { titulo: 'Desglose por concepto', ancho: 45 },
          { titulo: 'Fecha límite', ancho: 13 },
        ],
        filas: estado.movimientos.map((m) => [
          fechaCorta(m.fecha),
          m.detalle,
          monto(m, 'expensa'),
          monto(m, 'pago'),
          monto(m, 'anticipo'),
          monto(m, 'mora'),
          desglose(m),
          vencimiento(m),
        ]),
      });
      return { contenido, nombre: `${nombre}.xlsx`, tipo: TIPO_XLSX };
    }

    // Suma de anchos + separadores = ANCHO_TABLA
    const anchos = [10, 37, 15, 15, 15, 15];
    const derecha = [2, 3, 4, 5];
    const celda = (m: MovimientoCuenta, tipo: MovimientoCuenta['tipo']) => (m.tipo === tipo ? bs(m.monto) : '');
    const lineas: LineaPdf[] = [
      { texto: edificio, estilo: 'titulo' },
      { texto: 'Estado de cuenta', estilo: 'subtitulo' },
      ...cabecera.map((texto) => ({ texto })),
      { texto: '' },
      {
        texto: filaTabla(['Fecha', 'Detalle', 'Expensas', 'Pagos', 'Anticipos', 'Moras'], anchos, derecha),
        estilo: 'tabla-encabezado',
      },
      { texto: '-'.repeat(ANCHO_TABLA), estilo: 'tabla' },
      ...estado.movimientos.flatMap((m) => [
        {
          texto: filaTabla(
            [fechaCorta(m.fecha), m.detalle, celda(m, 'expensa'), celda(m, 'pago'), celda(m, 'anticipo'), celda(m, 'mora')],
            anchos,
            derecha,
          ),
          estilo: 'tabla' as const,
        },
        // Las expensas emitidas muestran su desglose y fecha límite debajo
        ...(desglose(m)
          ? [{ texto: filaTabla(['', `  ${desglose(m)}`], [10, 101]), estilo: 'tabla' as const }]
          : []),
        ...(vencimiento(m)
          ? [{ texto: filaTabla(['', `  Fecha límite: ${vencimiento(m)}`], [10, 101]), estilo: 'tabla' as const }]
          : []),
      ]),
      { texto: '-'.repeat(ANCHO_TABLA), estilo: 'tabla' },
      {
        texto: filaTabla(['', 'Totales', bs(t.expensas), bs(t.pagos), bs(t.anticipos), bs(t.moras)], anchos, derecha),
        estilo: 'tabla-encabezado',
      },
      { texto: '' },
      { texto: `Saldo: ${t.saldo < 0 ? `A favor ${bs(-t.saldo)}` : bs(t.saldo)}`, estilo: 'subtitulo' },
    ];
    return { contenido: generarPdf(lineas), nombre: `${nombre}.pdf`, tipo: 'application/pdf' };
  }
}
