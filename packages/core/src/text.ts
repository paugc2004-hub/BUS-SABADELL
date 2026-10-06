/** Normalización de texto para el buscador: "Créu Alta" = "creu alta" (sección 7.2). */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/l[·.]l/gi, 'll')
    .replace(/['’`´]/g, ' ')
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .toLowerCase()
    .replace(/\b(pl|pla)\b/g, 'placa')
    .replace(/\b(av|avda)\b/g, 'avinguda')
    .replace(/\b(c|cr|carrer)\b/g, 'carrer')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Comparación de nombres con reglas catalanas (bug 12.4-36). */
export const collator = new Intl.Collator('ca', { sensitivity: 'base', numeric: true });

/** Orden natural de líneas: L1, L2 … L80, F1 … F15. */
export function compareRouteRefs(a: string, b: string): number {
  const pa = /^([A-Z]+)(\d+)(.*)$/.exec(a);
  const pb = /^([A-Z]+)(\d+)(.*)$/.exec(b);
  if (!pa || !pb) return collator.compare(a, b);
  if (pa[1] !== pb[1]) return pa[1] === 'L' ? -1 : pb[1] === 'L' ? 1 : pa[1]!.localeCompare(pb[1]!);
  return Number(pa[2]) - Number(pb[2]) || collator.compare(pa[3]!, pb[3]!);
}

/** Color de texto legible sobre un color de fondo (contraste WCAG). */
export function textColorFor(hex: string): '#000000' | '#FFFFFF' {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? '#000000' : '#FFFFFF';
}

/** Normaliza un color ("red", "#f00", "#FF0000 ") a #rrggbb en minúsculas, o null (bug 12.1-11). */
const NAMED: Record<string, string> = {
  red: '#ff0000', blue: '#0000ff', green: '#008000', yellow: '#ffff00', orange: '#ffa500',
  purple: '#800080', black: '#000000', white: '#ffffff', grey: '#808080', gray: '#808080',
  brown: '#a52a2a', pink: '#ffc0cb', cyan: '#00ffff', magenta: '#ff00ff',
};
export function normalizeColour(input: string | undefined | null): string | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (NAMED[s]) return NAMED[s]!;
  const m3 = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(s);
  if (m3) return `#${m3[1]}${m3[1]}${m3[2]}${m3[2]}${m3[3]}${m3[3]}`;
  const m6 = /^#?([0-9a-f]{6})$/.exec(s);
  if (m6) return `#${m6[1]}`;
  return null;
}
