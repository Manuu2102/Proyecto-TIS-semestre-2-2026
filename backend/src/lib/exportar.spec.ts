import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { ANCHO_TABLA, filaTabla, generarPdf } from './exportar.js';
import { generarExcel } from './excel.js';
import { bs, diaAnterior, esFechaISO, fechaCorta } from './formato.js';

describe('generarExcel', () => {
  it('genera un .xlsx real con encabezado, totales numéricos y tabla', async () => {
    const buffer = await generarExcel({
      hoja: 'Balance Octubre/2026',
      edificio: 'Edificio Las Flores',
      titulo: 'Balance mensual',
      cabecera: ['Período: 01/10/2026 al 31/10/2026'],
      totales: [
        ['Total de ingresos', 1500.5],
        ['Balance mensual', 300],
      ],
      columnas: [
        { titulo: 'Fecha', ancho: 12 },
        { titulo: 'Monto (Bs)', ancho: 14, tipo: 'monto' },
      ],
      filas: [
        ['05/10/2026', 1200.5],
        ['07/10/2026', 300],
      ],
      atenuadas: [1],
    });

    // Un .xlsx es un ZIP: empieza con "PK"
    expect(buffer.subarray(0, 2).toString('latin1')).toBe('PK');

    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer as unknown as ArrayBuffer);
    const hoja = libro.worksheets[0];

    // El nombre de hoja no admite "/"
    expect(hoja.name).toBe('Balance Octubre-2026');
    expect(hoja.getCell('A1').value).toBe('Edificio Las Flores');
    expect(hoja.getCell('A1').font?.bold).toBe(true);

    // Totales: número con formato de monto (no texto)
    expect(hoja.getCell('B5').value).toBe(1500.5);
    expect(hoja.getCell('B5').numFmt).toBe('#,##0.00');

    // Tabla: títulos en negrita, montos numéricos, fila atenuada y encabezado fijo
    expect(hoja.getCell('A8').value).toBe('Fecha');
    expect(hoja.getCell('A8').font?.bold).toBe(true);
    expect(hoja.getCell('B9').value).toBe(1200.5);
    expect(hoja.getCell('B9').numFmt).toBe('#,##0.00');
    expect(hoja.getRow(10).font?.italic).toBe(true);
    expect(hoja.views[0]).toMatchObject({ state: 'frozen', ySplit: 8 });
  });
});

describe('filaTabla', () => {
  it('ajusta cada celda a su ancho y alinea a la derecha las indicadas', () => {
    const fila = filaTabla(['ab', 'texto muy largo', '5'], [4, 6, 3], [2]);
    expect(fila).toBe('ab   texto.   5');
  });

  it('los anchos de los reportes suman exactamente ANCHO_TABLA', () => {
    const caja = [15, 10, 7, 9, 30, 13, 13, 8];
    const reportes = [10, 7, 18, 36, 14, 13, 8];
    const saldosPendientes = [6, 30, 4, 9, 14, 13, 14, 15];
    const estadoCuenta = [10, 37, 15, 15, 15, 15];
    const desgloseEstadoCuenta = [10, 101];
    for (const anchos of [caja, reportes, saldosPendientes, estadoCuenta, desgloseEstadoCuenta]) {
      expect(filaTabla(anchos.map(() => ''), anchos).length).toBe(ANCHO_TABLA);
    }
  });
});

describe('generarPdf', () => {
  const pdf = generarPdf([
    { texto: 'Edificio Las Flores', estilo: 'titulo' },
    { texto: 'Concepto con (paréntesis) y acentos: ñandú — Bs 1.234,50' },
    ...Array.from({ length: 120 }, (_, i) => ({ texto: `Fila ${i}`, estilo: 'tabla' as const })),
  ]);
  const texto = pdf.toString('latin1');

  it('tiene cabecera, fin de archivo y varias páginas', () => {
    expect(texto.startsWith('%PDF-1.4')).toBe(true);
    expect(texto.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(texto).toMatch(/\/Count [2-9]/);
    expect(texto).toContain('Página 1 de');
  });

  it('las posiciones de la tabla xref apuntan a cada objeto', () => {
    const inicioXref = Number(texto.match(/startxref\n(\d+)/)![1]);
    expect(texto.slice(inicioXref, inicioXref + 4)).toBe('xref');
    const entradas = texto.slice(inicioXref).match(/^\d{10} 00000 n $/gm)!;
    entradas.forEach((entrada, i) => {
      const posicion = Number(entrada.slice(0, 10));
      expect(texto.slice(posicion).startsWith(`${i + 1} 0 obj`)).toBe(true);
    });
  });

  it('escapa paréntesis y reemplaza caracteres fuera de Latin-1', () => {
    expect(texto).toContain('\\(paréntesis\\)');
    expect(texto).toContain('ñandú - Bs');
  });
});

describe('formato', () => {
  it('formatea montos en bolivianos', () => {
    expect(bs(1234.5)).toBe('Bs 1.234,50');
  });

  it('trabaja con fechas ISO', () => {
    expect(fechaCorta('2026-10-09')).toBe('09/10/2026');
    expect(diaAnterior('2026-03-01')).toBe('2026-02-28');
    expect(esFechaISO('2026-10-09')).toBe(true);
    expect(esFechaISO('09/10/2026')).toBe(false);
  });
});
