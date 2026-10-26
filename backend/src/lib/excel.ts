import ExcelJS from 'exceljs';

/**
 * Genera un .xlsx real para los reportes de finanzas (caja, ingresos y gastos, balance):
 * encabezado del reporte, totales y una tabla con títulos en negrita y montos como
 * número con formato, para que se puedan sumar en Excel.
 */

export type ColumnaExcel = {
  titulo: string;
  ancho: number;
  tipo?: 'texto' | 'monto';
};

export type ReporteExcel = {
  hoja: string;
  edificio: string;
  titulo: string;
  cabecera: string[];
  totales: [string, number][];
  columnas: ColumnaExcel[];
  filas: (string | number)[][];
  /** Índices de filas que se muestran atenuadas (p. ej. anulados) */
  atenuadas?: number[];
};

const FORMATO_MONTO = '#,##0.00';
const ROJO = 'FFC83232';
const GRIS = 'FF8A837D';

export async function generarExcel(r: ReporteExcel): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = r.edificio;
  libro.created = new Date();
  // Excel no admite más de 31 caracteres ni algunos símbolos en el nombre de la hoja
  const hoja = libro.addWorksheet(r.hoja.replace(/[\\/?*[\]:]/g, '-').slice(0, 31));

  hoja.columns = r.columnas.map((c) => ({ width: c.ancho }));

  // Encabezado
  hoja.addRow([r.edificio]).font = { bold: true, size: 14, color: { argb: ROJO } };
  hoja.addRow([r.titulo]).font = { bold: true, size: 12 };
  for (const linea of r.cabecera) hoja.addRow([linea]).font = { color: { argb: GRIS } };
  hoja.addRow([]);

  // Totales
  r.totales.forEach(([etiqueta, valor], i) => {
    const fila = hoja.addRow([etiqueta, valor]);
    fila.getCell(1).font = { bold: true };
    fila.getCell(2).numFmt = FORMATO_MONTO;
    if (i === r.totales.length - 1) fila.getCell(2).font = { bold: true };
  });
  hoja.addRow([]);

  // Tabla
  const encabezado = hoja.addRow(r.columnas.map((c) => c.titulo));
  encabezado.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROJO } };
    celda.alignment = { vertical: 'middle' };
  });
  const filaEncabezado = encabezado.number;

  r.filas.forEach((valores, i) => {
    const fila = hoja.addRow(valores);
    r.columnas.forEach((c, j) => {
      if (c.tipo === 'monto') fila.getCell(j + 1).numFmt = FORMATO_MONTO;
    });
    if (r.atenuadas?.includes(i)) fila.font = { italic: true, color: { argb: GRIS } };
  });

  // La fila de títulos queda fija al bajar y con filtro en cada columna
  hoja.views = [{ state: 'frozen', ySplit: filaEncabezado }];
  if (r.filas.length > 0) {
    hoja.autoFilter = {
      from: { row: filaEncabezado, column: 1 },
      to: { row: filaEncabezado + r.filas.length, column: r.columnas.length },
    };
  }

  return Buffer.from(await libro.xlsx.writeBuffer());
}
