import { ca, type Dict } from './ca.ts';
export type { Dict } from './ca.ts';
import { es } from './es.ts';
import { useApp } from '../state/store.ts';

export type Lang = 'ca' | 'es';
export const dicts: Record<Lang, Dict> = { ca, es };

/** Català per defecte; castellà si l'usuari l'ha triat (es guarda). */
export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'ca' || saved === 'es') return saved;
  } catch {
    /* sense emmagatzematge */
  }
  // el producte és en català; el castellà, a un toc (botó ES), i es recorda
  return 'ca';
}

export function useT(): Dict {
  return dicts[useApp((s) => s.lang)];
}
