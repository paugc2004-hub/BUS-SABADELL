import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { qrMatrix, qrSvg, stopCardUrl, validStopCode } from './qr.ts';

/** pinta la matriu en píxels (RGBA) i la llegeix amb un decodificador independent */
function decode(text: string): string | null {
  const m = qrMatrix(text);
  const scale = 4;
  const margin = 4;
  const size = (m.length + margin * 2) * scale;
  const px = new Uint8ClampedArray(size * size * 4).fill(255);
  m.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (!dark) return;
      for (let y = 0; y < scale; y++)
        for (let x = 0; x < scale; x++) {
          const i = (((r + margin) * scale + y) * size + (c + margin) * scale + x) * 4;
          px[i] = px[i + 1] = px[i + 2] = 0;
        }
    }),
  );
  return jsQR(px, size, size)?.data ?? null;
}

describe('QR de parada (PPT §2.1.5)', () => {
  it('cada QR es llegeix i porta a la fitxa pública de la parada', () => {
    for (const code of ['1', '278', '753', '20']) {
      const url = stopCardUrl(code);
      expect(url).toBe(`https://bus-sabadell.vercel.app/p/${code}`);
      expect(decode(url)).toBe(url);
    }
  });

  it('l’origen es pot canviar (p. ej. el domini definitiu) i no duplica barres', () => {
    expect(stopCardUrl('278', 'https://exemple.cat/')).toBe('https://exemple.cat/p/278');
  });

  it('SVG: zona blanca de 4 mòduls, text alternatiu escapat i res d’HTML injectat', () => {
    const svg = qrSvg(stopCardUrl('278'), { title: 'Parada 278 <Rambla & "centre">' });
    const n = qrMatrix(stopCardUrl('278')).length;
    expect(svg).toContain(`viewBox="0 0 ${n + 8} ${n + 8}"`);
    expect(svg).toContain('aria-label="Parada 278 &lt;Rambla &amp; &quot;centre&quot;&gt;"');
    expect(svg).not.toMatch(/<Rambla/);
  });

  it('codis de parada: només formats curts i segurs', () => {
    expect(validStopCode('278')).toBe(true);
    expect(validStopCode('../etc')).toBe(false);
    expect(validStopCode('<script>')).toBe(false);
    expect(validStopCode('')).toBe(false);
  });
});
