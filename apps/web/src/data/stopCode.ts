/**
 * Codis de parada a les URL i als QR (sense dependències: també el fan servir la fitxa de parada i el lector de QR).
 */
/** adreça pública on apunten els QR impresos (estable encara que l'app s'obri des d'un altre domini) */
export const PUBLIC_ORIGIN: string = (import.meta.env?.VITE_PUBLIC_ORIGIN as string | undefined) ?? 'https://bus-sabadell.vercel.app';

/** codi de parada vàlid a l'URL (els de tus.es són numèrics; s'admet alfanumèric curt per si de cas) */
export const validStopCode = (code: string) => /^[A-Za-z0-9_-]{1,12}$/.test(code);

export function stopCardUrl(code: string, origin: string = PUBLIC_ORIGIN): string {
  return `${origin.replace(/\/+$/, '')}/p/${encodeURIComponent(code)}`;
}

/**
 * Què vol dir un text llegit d'un QR o escrit a mà. Només s'accepten:
 *  1) URL pròpies de fitxa de parada (`…/p/<codi>`, del domini públic o de l'actual);
 *  2) un número que sigui el codi d'una parada que existeix.
 * Mai es navega a una URL externa llegida d'un QR, i no s'interpreta cap format privat.
 */
export function parseStopQr(text: string, exists: (code: string) => boolean, origins: string[] = [PUBLIC_ORIGIN]): string | null {
  const raw = text.trim();
  if (/^\d{1,6}$/.test(raw)) return exists(raw) ? raw : null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const allowed = origins.map((o) => {
    try {
      return new URL(o).origin;
    } catch {
      return '';
    }
  });
  if (!allowed.includes(u.origin)) return null;
  const m = /^\/p\/([^/]+)\/?$/.exec(u.pathname);
  if (!m) return null;
  let code: string;
  try {
    code = decodeURIComponent(m[1]!);
  } catch {
    return null;
  }
  return validStopCode(code) && exists(code) ? code : null;
}
