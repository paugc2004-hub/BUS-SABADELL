/**
 * Codis QR de parada (licitació 2024, PPT §2.1.5): cada parada té un QR que porta a la seva fitxa pública
 * (`/p/<codi>`): codi i nom, línies que hi passen i propers busos. Es genera al dispositiu, sense serveis externs.
 */
import qrcode from 'qrcode-generator';

export { PUBLIC_ORIGIN, stopCardUrl, validStopCode } from './stopCode.ts';

/** matriu de mòduls (true = fosc); correcció d'errors M: aguanta brutícia i rascades a la marquesina */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** camí SVG (un sol `path`) i mida total en mòduls; `margin` en mòduls (la norma demana 4 de zona blanca) */
export function qrPath(text: string, margin = 4): { size: number; d: string } {
  const m = qrMatrix(text);
  const size = m.length + margin * 2;
  let d = '';
  m.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (!row[c]) {
        c++;
        continue;
      }
      const start = c;
      while (c < row.length && row[c]) c++;
      d += `M${start + margin} ${r + margin}h${c - start}v1h-${c - start}z`;
    }
  });
  return { size, d };
}

/** SVG autònom (per descarregar o imprimir) */
export function qrSvg(text: string, { margin = 4, title }: { margin?: number; title?: string } = {}): string {
  const { size, d } = qrPath(text, margin);
  const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
  const label = title ? `<title>${esc(title)}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img"${title ? ` aria-label="${esc(title)}"` : ''}>${label}<rect width="${size}" height="${size}" fill="#fff"/><path fill="#000" d="${d}"/></svg>`;
}
