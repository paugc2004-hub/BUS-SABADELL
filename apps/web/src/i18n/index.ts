import { ca, type Dict } from './ca.ts';
export type { Dict } from './ca.ts';
import { es } from './es.ts';
import { useApp } from '../state/store.ts';

export type Lang = 'ca' | 'es';
export const dicts: Record<Lang, Dict> = { ca, es };

/** Català per defecte; castellà si el navegador el prefereix (i no hi ha elecció guardada). */
export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'ca' || saved === 'es') return saved;
  } catch {
    /* sense emmagatzematge */
  }
  const prefs = navigator.languages ?? [navigator.language];
  for (const p of prefs) {
    const l = p.toLowerCase();
    if (l.startsWith('ca')) return 'ca';
    if (l.startsWith('es')) return 'es';
  }
  return 'ca';
}

export function useT(): Dict {
  return dicts[useApp((s) => s.lang)];
}
