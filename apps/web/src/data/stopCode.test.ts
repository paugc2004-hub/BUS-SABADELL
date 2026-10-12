import { describe, expect, it } from 'vitest';
import { parseStopQr } from './stopCode.ts';

const exists = (c: string) => ['1', '43', '131'].includes(c);
const ORIG = ['https://bus-sabadell.vercel.app', 'http://localhost:4173'];

describe('lector de QR de parada: què s’accepta', () => {
  it('URL pròpies de fitxa de parada', () => {
    expect(parseStopQr('https://bus-sabadell.vercel.app/p/43', exists, ORIG)).toBe('43');
    expect(parseStopQr('http://localhost:4173/p/131/', exists, ORIG)).toBe('131');
  });
  it('un número que sigui una parada existent (també escrit a mà)', () => {
    expect(parseStopQr(' 43 ', exists, ORIG)).toBe('43');
    expect(parseStopQr('9999', exists, ORIG)).toBeNull();
  });
  it('mai una URL externa ni un format desconegut (no es navega enlloc)', () => {
    expect(parseStopQr('https://malicios.example/p/43', exists, ORIG)).toBeNull();
    expect(parseStopQr('https://bus-sabadell.vercel.app.malicios.example/p/43', exists, ORIG)).toBeNull();
    expect(parseStopQr('javascript:alert(1)', exists, ORIG)).toBeNull();
    expect(parseStopQr('https://bus-sabadell.vercel.app/p/..%2F..%2Fadmin', exists, ORIG)).toBeNull();
    expect(parseStopQr('https://bus-sabadell.vercel.app/p/77', exists, ORIG)).toBeNull();
    expect(parseStopQr('TUS:PARADA:43:XYZ', exists, ORIG)).toBeNull();
    expect(parseStopQr('', exists, ORIG)).toBeNull();
  });
});
