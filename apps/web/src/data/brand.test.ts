import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = join(__dirname, '..', '..');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? (f === 'data' ? [] : files(p)) : [p];
  });
}

describe('marques alienes', () => {
  it('cap recurs de public/ porta el nom de TUS, l’Ajuntament, la UE o Bizum', () => {
    const bad = files(join(WEB, 'public')).filter((f) => /tus|ajuntament|escut|nextgeneration|bizum|t-sabadell|eu-flag/i.test(f.replace(WEB, '')));
    expect(bad).toEqual([]);
  });
  it('cap SVG ni imatge incrustada del logo de TUS o de Bizum al codi', () => {
    const src = files(join(WEB, 'src')).filter((f) => /\.(tsx?|css)$/.test(f) && !f.endsWith('.test.ts'));
    const bad = src.filter((f) => /logo[-_ ]?tus|tus[-_ ]?logo|bizum[-_ ]?logo|nextgenerationeu|data:image\/(png|jpe?g)/i.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
});
