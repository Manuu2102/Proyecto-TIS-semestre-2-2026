/**
 * Exportación a PDF sin librerías externas: documento de texto simple (A4) con las
 * fuentes estándar del PDF. Las tablas usan Courier (ancho fijo) para que las columnas
 * queden alineadas. El Excel se genera en excel.ts.
 */

export type Celda = string | number | null | undefined;

export type EstiloLinea = 'titulo' | 'subtitulo' | 'normal' | 'tabla' | 'tabla-encabezado';
export type LineaPdf = { texto: string; estilo?: EstiloLinea };

/** Ancho de una línea de tabla en caracteres (Courier 7.5 pt en A4 con márgenes de 40 pt) */
export const ANCHO_TABLA = 112;

/** Arma una fila de ancho fijo: cada celda se recorta o se completa con espacios. */
export function filaTabla(celdas: Celda[], anchos: number[], derecha: number[] = []): string {
  return celdas
    .map((c, i) => {
      const ancho = anchos[i];
      let t = String(c ?? '');
      // Se recorta con "." (un solo carácter) para no descuadrar las columnas
      if (t.length > ancho) t = `${t.slice(0, ancho - 1)}.`;
      return derecha.includes(i) ? t.padStart(ancho) : t.padEnd(ancho);
    })
    .join(' ');
}

const A4 = { ancho: 595, alto: 842 };
const MARGEN = 40;
const FUENTES: Record<EstiloLinea, { fuente: string; tamano: number }> = {
  titulo: { fuente: 'F2', tamano: 14 },
  subtitulo: { fuente: 'F2', tamano: 10 },
  normal: { fuente: 'F1', tamano: 9 },
  tabla: { fuente: 'F3', tamano: 7.5 },
  'tabla-encabezado': { fuente: 'F4', tamano: 7.5 },
};

/** Deja el texto en Latin-1 (WinAnsi) y escapa los caracteres especiales del PDF. */
function textoPdf(texto: string) {
  return texto
    .replace(/[—–−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/** Corta textos normales largos para que no se salgan de la página. */
function envolver(linea: LineaPdf): LineaPdf[] {
  const estilo = linea.estilo ?? 'normal';
  if (estilo === 'tabla' || estilo === 'tabla-encabezado') return [linea];
  const maximo = estilo === 'titulo' ? 60 : 100;
  const palabras = linea.texto.split(' ');
  const lineas: LineaPdf[] = [];
  let actual = '';
  for (const p of palabras) {
    if (actual && (actual + ' ' + p).length > maximo) {
      lineas.push({ texto: actual, estilo });
      actual = p;
    } else {
      actual = actual ? `${actual} ${p}` : p;
    }
  }
  lineas.push({ texto: actual, estilo });
  return lineas;
}

export function generarPdf(lineasEntrada: LineaPdf[]): Buffer {
  // 1. Repartir las líneas en páginas
  const paginas: string[][] = [[]];
  let y = A4.alto - MARGEN;
  for (const linea of lineasEntrada.flatMap(envolver)) {
    const { fuente, tamano } = FUENTES[linea.estilo ?? 'normal'];
    const alto = tamano * 1.45;
    if (y - alto < MARGEN + 20) {
      paginas.push([]);
      y = A4.alto - MARGEN;
    }
    y -= alto;
    if (linea.texto) {
      paginas[paginas.length - 1].push(
        `BT /${fuente} ${tamano} Tf ${MARGEN} ${y.toFixed(2)} Td (${textoPdf(linea.texto)}) Tj ET`,
      );
    }
  }

  // Pie con el número de página
  paginas.forEach((ops, i) => {
    ops.push(`BT /F1 8 Tf ${MARGEN} ${MARGEN - 10} Td (${textoPdf(`Página ${i + 1} de ${paginas.length}`)}) Tj ET`);
  });

  // 2. Objetos del PDF: 1 catálogo, 2 páginas, 3-6 fuentes, luego página + contenido
  const objetos: string[] = [];
  objetos[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const fuente = (nombre: string) =>
    `<< /Type /Font /Subtype /Type1 /BaseFont /${nombre} /Encoding /WinAnsiEncoding >>`;
  objetos[3] = fuente('Helvetica');
  objetos[4] = fuente('Helvetica-Bold');
  objetos[5] = fuente('Courier');
  objetos[6] = fuente('Courier-Bold');

  const kids: string[] = [];
  paginas.forEach((ops, i) => {
    const idPagina = 7 + i * 2;
    const idContenido = idPagina + 1;
    const contenido = ops.join('\n');
    kids.push(`${idPagina} 0 R`);
    objetos[idPagina] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.ancho} ${A4.alto}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> /Contents ${idContenido} 0 R >>`;
    objetos[idContenido] = `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`;
  });
  objetos[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${paginas.length} >>`;

  // 3. Ensamblar con la tabla de referencias (las posiciones son en bytes Latin-1)
  let salida = '%PDF-1.4\n';
  const posiciones: number[] = [];
  for (let id = 1; id < objetos.length; id++) {
    posiciones[id] = salida.length;
    salida += `${id} 0 obj\n${objetos[id]}\nendobj\n`;
  }
  const inicioXref = salida.length;
  salida += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objetos.length; id++) {
    salida += `${String(posiciones[id]).padStart(10, '0')} 00000 n \n`;
  }
  salida += `trailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`;

  return Buffer.from(salida, 'latin1');
}
