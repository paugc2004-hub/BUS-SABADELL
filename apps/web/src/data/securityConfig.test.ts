/**
 * Configuració de seguretat del desplegament (vercel.json): capçaleres que no s'han de perdre i coherència amb l'app.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = join(__dirname, '..', '..');
const cfg = JSON.parse(readFileSync(join(WEB, 'vercel.json'), 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
const header = (k: string) => cfg.headers.find((h) => h.source === '/(.*)')!.headers.find((h) => h.key === k)?.value ?? '';

describe('capçaleres de seguretat (vercel.json)', () => {
  it('Permissions-Policy: ubicació i càmera (lector de QR) només per a l’app; res de pagaments ni micròfon', () => {
    const p = header('Permissions-Policy');
    expect(p).toContain('geolocation=(self)');
    expect(p).toContain('camera=(self)');
    expect(p).toContain('microphone=()');
    expect(p).toContain('payment=()');
  });
  it('CSP: sense eval ni scripts externs, sense iframes, i amb el hash de l’únic script en línia d’index.html', () => {
    const csp = header('Content-Security-Policy');
    expect(csp).not.toMatch(/unsafe-eval/);
    expect(csp).toMatch(/script-src 'self' 'sha256-[^']+'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'none'");
    const html = readFileSync(join(WEB, 'index.html'), 'utf8');
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
    expect(inline.length).toBeGreaterThan(0);
    for (const code of inline) expect(csp).toContain(`'sha256-${createHash('sha256').update(code).digest('base64')}'`);
  });
  it('HSTS, nosniff i sense marcs', () => {
    expect(header('Strict-Transport-Security')).toMatch(/max-age=\d{8,}/);
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('X-Frame-Options')).toBe('DENY');
  });
});
