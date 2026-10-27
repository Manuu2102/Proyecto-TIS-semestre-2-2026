import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { generarPdf, filaTabla, ANCHO_TABLA, type LineaPdf } from '../lib/exportar.js';
import { generarExcel } from '../lib/excel.js';
import { MESES, TIPO_XLSX, aFecha, bs, fechaCorta, isoDia } from '../lib/formato.js';
import { datosEmision } from '../lib/emision.js';
import { FiltrosReporteDto } from './dto/reporte.dto.js';

const CERO = new Prisma.Decimal(0);

export type MovimientoReporte = {
  id: string;
  tipo: 'Ingreso' | 'Gasto';
  fecha: string;
  categoria: string;
  descripcion: string;
  proveedor: string | null;
  monto: number;
  metodo: string;
  estado: 'Vigente' | 'Anulado';
  motivo_anulacion: string | null;
};

type Totales = { ingresos: number; gastos: number; saldo: number; anulados: number };

const METODO: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  deposito: 'Depósito',
};

/**
 * HU-23 (reporte de ingresos y gastos) y HU-24 (balance mensual). Ambos leen las
 * tablas ingreso y gasto; los movimientos anulados se listan con su estado pero no
 * suman en los totales.
 */
@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  // =====================================================================
  // Base común
  // =====================================================================

  private async validarFiltros(f: FiltrosReporteDto) {
    if (f.desde && f.hasta && f.desde.slice(0, 10) > f.hasta.slice(0, 10)) {
      throw new BadRequestException('La fecha inicial no puede ser posterior a la fecha final.');
    }
    if (f.monto_min !== undefined && f.monto_max !== undefined && f.monto_min > f.monto_max) {
      throw new BadRequestException('El monto mínimo no puede ser mayor que el monto máximo.');
    }
    if (f.id_categoria) {
      const categoria = await this.prisma.categoria_movimiento.findUnique({
        where: { id: BigInt(f.id_categoria) },
      });
      if (!categoria) throw new BadRequestException('La categoría seleccionada no existe.');
      if (f.tipo && categoria.tipo !== f.tipo) {
        throw new BadRequestException('La categoría seleccionada no corresponde al tipo de movimiento.');
      }
      return categoria;
    }
    return null;
  }

  /** Ingresos y gastos que cumplen los filtros, ordenados por fecha. */
  private async movimientos(f: FiltrosReporteDto): Promise<MovimientoReporte[]> {
    const where = {
      ...((f.desde || f.hasta) && {
        fecha: {
          ...(f.desde && { gte: aFecha(f.desde.slice(0, 10)) }),
          ...(f.hasta && { lte: aFecha(f.hasta.slice(0, 10)) }),
        },
      }),
      ...(f.id_categoria && { id_categoria: BigInt(f.id_categoria) }),
      ...((f.monto_min !== undefined || f.monto_max !== undefined) && {
        monto: {
          ...(f.monto_min !== undefined && { gte: new Prisma.Decimal(f.monto_min) }),
          ...(f.monto_max !== undefined && { lte: new Prisma.Decimal(f.monto_max) }),
        },
      }),
    };
    const select = {
      id: true,
      fecha: true,
      monto: true,
      descripcion: true,
      metodo: true,
      anulado: true,
      motivo_anulacion: true,
      categoria_movimiento: { select: { nombre: true } },
    } as const;

    // Consultas una tras otra para no ocupar varias conexiones del pooler a la vez
    const ingresos = f.tipo === 'gasto' ? [] : await this.prisma.ingreso.findMany({ where, select });
    const gastos =
      f.tipo === 'ingreso'
        ? []
        : await this.prisma.gasto.findMany({ where, select: { ...select, proveedor: true } });

    const fila = (
      tipo: MovimientoReporte['tipo'],
      m: (typeof ingresos)[number] & { proveedor?: string | null },
    ): MovimientoReporte => ({
      id: `${tipo === 'Ingreso' ? 'I' : 'G'}-${m.id}`,
      tipo,
      fecha: isoDia(m.fecha),
      categoria: m.categoria_movimiento.nombre,
      descripcion: m.descripcion ?? '',
      proveedor: m.proveedor ?? null,
      monto: m.monto.toNumber(),
      metodo: METODO[m.metodo] ?? m.metodo,
      estado: m.anulado ? 'Anulado' : 'Vigente',
      motivo_anulacion: m.motivo_anulacion,
    });

    return [...ingresos.map((m) => fila('Ingreso', m)), ...gastos.map((m) => fila('Gasto', m))].sort(
      (a, b) => a.fecha.localeCompare(b.fecha) || a.tipo.localeCompare(b.tipo) || a.id.localeCompare(b.id),
    );
  }

  /** Solo los vigentes suman; saldo = ingresos − gastos. */
  private totales(lista: MovimientoReporte[]): Totales {
    let ingresos = CERO;
    let gastos = CERO;
    for (const m of lista) {
      if (m.estado !== 'Vigente') continue;
      if (m.tipo === 'Ingreso') ingresos = ingresos.plus(m.monto);
      else gastos = gastos.plus(m.monto);
    }
    return {
      ingresos: ingresos.toNumber(),
      gastos: gastos.toNumber(),
      saldo: ingresos.minus(gastos).toNumber(),
      anulados: lista.filter((m) => m.estado === 'Anulado').length,
    };
  }

  // =====================================================================
  // HU-23: reporte de ingresos y gastos
  // =====================================================================

  async reporte(f: FiltrosReporteDto) {
    const categoria = await this.validarFiltros(f);
    const lista = await this.movimientos(f);
    return {
      filtros: {
        desde: f.desde?.slice(0, 10) ?? null,
        hasta: f.hasta?.slice(0, 10) ?? null,
        tipo: f.tipo ?? null,
        id_categoria: f.id_categoria ?? null,
        categoria: categoria?.nombre ?? null,
        monto_min: f.monto_min ?? null,
        monto_max: f.monto_max ?? null,
      },
      total_registros: lista.length,
      movimientos: lista,
      totales: this.totales(lista),
    };
  }

  async exportarReporte(formato: 'pdf' | 'excel', f: FiltrosReporteDto, idUsuario: string) {
    const r = await this.reporte(f);
    if (r.total_registros === 0) throw new BadRequestException('No hay datos para exportar.');
    const { edificio, emisor, emitido } = await datosEmision(this.prisma, idUsuario);

    const filtrosTexto = [
      `Fechas: ${r.filtros.desde ? fechaCorta(r.filtros.desde) : 'inicio'} al ${r.filtros.hasta ? fechaCorta(r.filtros.hasta) : 'hoy'}`,
      `Tipo: ${r.filtros.tipo === 'ingreso' ? 'Ingresos' : r.filtros.tipo === 'gasto' ? 'Gastos' : 'Todos'}`,
      `Categoría: ${r.filtros.categoria ?? 'Todas'}`,
      `Monto: ${r.filtros.monto_min !== null ? bs(r.filtros.monto_min) : 'sin mínimo'} a ${r.filtros.monto_max !== null ? bs(r.filtros.monto_max) : 'sin máximo'}`,
    ];

    return this.archivo(formato, `reporte-ingresos-gastos-${new Date().toISOString().slice(0, 10)}`, {
      hoja: 'Ingresos y gastos',
      edificio,
      titulo: 'Reporte de ingresos y gastos',
      cabecera: [...filtrosTexto, `Emitido por: ${emisor}   ·   Fecha y hora de emisión: ${emitido}`],
      totales: [
        ['Total de ingresos', r.totales.ingresos],
        ['Total de gastos', r.totales.gastos],
        ['Saldo resultante', r.totales.saldo],
      ],
      movimientos: r.movimientos,
    });
  }

  // =====================================================================
  // HU-24: balance mensual
  // =====================================================================

  async balanceMensual(anio: number, mes: number) {
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    const hasta = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    const lista = await this.movimientos({ desde, hasta });
    const totales = this.totales(lista);
    return {
      anio,
      mes,
      periodo: `${MESES[mes - 1]} ${anio}`,
      desde,
      hasta,
      total_ingresos: totales.ingresos,
      total_gastos: totales.gastos,
      balance: totales.saldo,
      anulados: totales.anulados,
      sin_movimientos: lista.length === 0,
      ingresos: lista.filter((m) => m.tipo === 'Ingreso'),
      gastos: lista.filter((m) => m.tipo === 'Gasto'),
    };
  }

  async exportarBalance(formato: 'pdf' | 'excel', anio: number, mes: number, idUsuario: string) {
    const b = await this.balanceMensual(anio, mes);
    const { edificio, emisor, emitido } = await datosEmision(this.prisma, idUsuario);

    // Un mes sin movimientos también se exporta: el balance en 0 es un resultado válido (HU-24 #7)
    return this.archivo(formato, `balance-${b.anio}-${String(b.mes).padStart(2, '0')}`, {
      hoja: `Balance ${b.periodo}`,
      edificio,
      titulo: `Balance mensual · ${b.periodo}`,
      cabecera: [
        `Período: ${fechaCorta(b.desde)} al ${fechaCorta(b.hasta)}`,
        `Emitido por: ${emisor}   ·   Fecha y hora de emisión: ${emitido}`,
        ...(b.sin_movimientos ? ['No se registraron movimientos en este período.'] : []),
      ],
      totales: [
        ['Total de ingresos', b.total_ingresos],
        ['Total de gastos', b.total_gastos],
        ['Balance mensual', b.balance],
      ],
      movimientos: [...b.ingresos, ...b.gastos],
    });
  }

  // =====================================================================
  // Archivo PDF / Excel común a ambos reportes
  // =====================================================================

  private async archivo(
    formato: 'pdf' | 'excel',
    nombre: string,
    d: {
      hoja: string;
      edificio: string;
      titulo: string;
      cabecera: string[];
      totales: [string, number][];
      movimientos: MovimientoReporte[];
    },
  ) {
    if (formato === 'excel') {
      const contenido = await generarExcel({
        hoja: d.hoja,
        edificio: d.edificio,
        titulo: d.titulo,
        cabecera: d.cabecera,
        totales: d.totales,
        columnas: [
          { titulo: 'Fecha', ancho: 12 },
          { titulo: 'Tipo', ancho: 10 },
          { titulo: 'Categoría', ancho: 24 },
          { titulo: 'Descripción', ancho: 40 },
          { titulo: 'Proveedor', ancho: 22 },
          { titulo: 'Monto (Bs)', ancho: 14, tipo: 'monto' },
          { titulo: 'Método', ancho: 14 },
          { titulo: 'Estado', ancho: 10 },
        ],
        filas: d.movimientos.map((m) => [
          fechaCorta(m.fecha),
          m.tipo,
          m.categoria,
          m.descripcion,
          m.proveedor ?? '',
          m.monto,
          m.metodo,
          m.estado,
        ]),
        // Los anulados se listan, pero no suman en los totales
        atenuadas: d.movimientos.flatMap((m, i) => (m.estado === 'Anulado' ? [i] : [])),
      });
      return { contenido, nombre: `${nombre}.xlsx`, tipo: TIPO_XLSX };
    }

    // Suma de anchos + separadores = ANCHO_TABLA
    const anchos = [10, 7, 18, 36, 14, 13, 8];
    const derecha = [4];
    const lineas: LineaPdf[] = [
      { texto: d.edificio, estilo: 'titulo' },
      { texto: d.titulo, estilo: 'subtitulo' },
      ...d.cabecera.map((texto) => ({ texto })),
      { texto: '' },
      ...d.totales.map(([etiqueta, valor], i) => ({
        texto: `${etiqueta}: ${bs(valor)}`,
        estilo: (i === d.totales.length - 1 ? 'subtitulo' : 'normal') as LineaPdf['estilo'],
      })),
      { texto: '' },
      {
        texto: filaTabla(['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Método', 'Estado'], anchos, derecha),
        estilo: 'tabla-encabezado',
      },
      { texto: '-'.repeat(ANCHO_TABLA), estilo: 'tabla' },
      ...d.movimientos.map((m) => ({
        texto: filaTabla(
          [
            fechaCorta(m.fecha),
            m.tipo,
            m.categoria,
            [m.proveedor, m.descripcion].filter(Boolean).join(' - '),
            bs(m.monto),
            m.metodo,
            m.estado,
          ],
          anchos,
          derecha,
        ),
        estilo: 'tabla' as const,
      })),
    ];
    return { contenido: generarPdf(lineas), nombre: `${nombre}.pdf`, tipo: 'application/pdf' };
  }
}
