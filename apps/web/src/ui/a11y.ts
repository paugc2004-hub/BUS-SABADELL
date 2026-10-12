/**
 * Ajustos d'accessibilitat de l'app (Compte › Configuració, Més › Accessibilitat): mida del text, alt contrast i
 * reduir el moviment. S'apliquen a l'instant a <html> (data-text, data-contrast, data-motion) i es recorden al dispositiu.
 */
import { create } from 'zustand';

export type TextSize = 'normal' | 'lg' | 'xl';
export interface A11y {
  text: TextSize;
  contrast: boolean;
  motion: boolean;
}

const KEY = 'nextmobility.a11y';
const DEFAULTS: A11y = { text: 'normal', contrast: false, motion: false };

function read(): A11y {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<A11y> | null;
    return { ...DEFAULTS, ...(v ?? {}), text: v?.text === 'lg' || v?.text === 'xl' ? v.text : 'normal' };
  } catch {
    return DEFAULTS;
  }
}

function apply(a: A11y) {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  if (a.text === 'normal') delete el.dataset.text;
  else el.dataset.text = a.text;
  if (a.contrast) el.dataset.contrast = 'high';
  else delete el.dataset.contrast;
  if (a.motion) el.dataset.motion = 'reduce';
  else delete el.dataset.motion;
}

export const useA11y = create<A11y & { set(p: Partial<A11y>): void }>((set, get) => ({
  ...read(),
  set(p) {
    const next = { text: get().text, contrast: get().contrast, motion: get().motion, ...p };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* sense emmagatzematge: s'aplica igualment */
    }
    apply(next);
    set(next);
  },
}));

if (typeof window !== 'undefined') apply(read());

/** el sistema ja demana menys moviment */
export const systemReducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
