import { useEffect, useState, type ReactNode } from 'react';
import type { Route } from '@bus/core';
import { clock, useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';

/** Re-render periódico leyendo SIEMPRE el reloj absoluto (bug 12.2-19). */
export function useNow(intervalMs = 1000): number {
  const v = useApp((s) => s.clockVersion);
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    setNow(clock.now());
    const speed = clock.getSpeed();
    const ms = Math.max(100, intervalMs / Math.min(speed, 10));
    const id = setInterval(() => setNow(clock.now()), ms);
    const vis = () => setNow(clock.now());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [intervalMs, v]);
  return now;
}

export function RouteChip({ route, size = 'md', dim = false }: { route: Route | undefined; size?: 'sm' | 'md' | 'lg'; dim?: boolean }) {
  if (!route) return null;
  return (
    <span
      className={`chip chip-${size}${dim ? ' chip-dim' : ''}`}
      style={{ background: route.color, color: route.textColor }}
      aria-label={`Línia ${route.ref}`}
    >
      {route.ref}
    </span>
  );
}

/** mm:ss derivado del instante absoluto de llegada. */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function Countdown({ at, now, className = '' }: { at: number; now: number; className?: string }) {
  return <span className={`mono ${className}`}>{formatCountdown(at - now)}</span>;
}

export function relativeLabel(at: number, now: number, t: ReturnType<typeof useT>): string {
  const min = Math.floor((at - now) / 60000);
  if (min <= 0) return t.imminent;
  if (min > 30) return new Intl.DateTimeFormat('ca', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
  return t.inMin(min);
}

export function hm(at: number): string {
  return new Intl.DateTimeFormat('ca', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
}

export function SourceTag({ source }: { source: 'SIMULATED' | 'SCHEDULED' | 'REALTIME' }) {
  const t = useT();
  return (
    <span className={`source source-${source.toLowerCase()}`} title={t.sourceHint[source]}>
      <span className="source-dot" aria-hidden />
      {t.source[source]}
    </span>
  );
}

export function IconButton({ label, onClick, children, active = false, className = '' }: { label: string; onClick: () => void; children: ReactNode; active?: boolean; className?: string }) {
  return (
    <button type="button" className={`icon-btn${active ? ' active' : ''} ${className}`} aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

export const Icon = {
  close: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
      <circle cx="6" cy="12" r="2.4" fill="currentColor" />
      <circle cx="18" cy="6" r="2.4" fill="currentColor" />
      <circle cx="18" cy="18" r="2.4" fill="currentColor" />
      <path d="M8 11l8-4M8 13l8 4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  follow: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M15 15l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  map: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
    </svg>
  ),
  line: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path d="M3 17l5-5 4 3 8-8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 7h5v5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
      <path d="M6 16V11a6 6 0 1112 0v5l2 2H4z M10 20a2 2 0 004 0" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path d="M8 5l11 7-11 7z" fill="currentColor" />
    </svg>
  ),
  locate: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M12 2l3 19-3-4-3 4z" fill="currentColor" transform="rotate(45 12 12)" />
    </svg>
  ),
  layers: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M12 3l9 5-9 5-9-5z M3 13l9 5 9-5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  ),
  star: (on: boolean) => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  ),
  board: (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
      <path d="M12 2.5v10M7.5 8.5L12 13l4.5-4.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="15.5" width="16" height="5" rx="2" stroke="currentColor" strokeWidth="1.8" fill="none" />
    </svg>
  ),
  walk: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <circle cx="13" cy="4.5" r="2.2" fill="currentColor" />
      <path d="M10 21l2-6 3 3v3M12 15l-1-5 4-1 2 4h3M11 10l-3 2v3" stroke="currentColor" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  home: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path d="M12 3a6 6 0 016 6c0 4.5-6 11-6 11S6 13.5 6 9a6 6 0 016-6z" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <circle cx="12" cy="9" r="2.2" fill="currentColor" />
    </svg>
  ),
  chevron: (up: boolean) => (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden style={{ transform: up ? 'rotate(180deg)' : undefined }}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M12 11v6M12 7.5v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};

export async function shareUrl(url: string, title: string, onCopied: () => void) {
  try {
    if (navigator.share) {
      await navigator.share({ url, title });
      return;
    }
  } catch {
    /* cancel·lat */
  }
  try {
    await navigator.clipboard.writeText(url);
    onCopied();
  } catch {
    /* sense porta-retalls */
  }
}

/**
 * Puntualitat respecte de l'horari: "A l'hora", "+2 min", "−1 min". Mai només el color.
 * A la simulació el retard és simulat (ho diu l'etiqueta accessible i el títol).
 */
export function Punctuality({ delaySec, source = 'SIMULATED', compact = false }: { delaySec: number | null; source?: 'SIMULATED' | 'SCHEDULED' | 'REALTIME'; compact?: boolean }) {
  const t = useT();
  if (delaySec === null) return null;
  const m = Math.round(Math.abs(delaySec) / 60);
  const kind = delaySec >= 60 ? (delaySec >= 180 ? 'late3' : 'late') : delaySec <= -60 ? 'early' : 'ontime';
  const text = kind === 'ontime' ? t.punct.onTime : kind === 'early' ? t.punct.early(m) : t.punct.late(m);
  const long = kind === 'ontime' ? t.punct.onTime : kind === 'early' ? t.punct.earlyLong(m) : t.punct.lateLong(m);
  const note = source === 'SIMULATED' ? ` · ${t.punct.simNote}` : '';
  return (
    <span className={`punct punct-${kind}${compact ? ' compact' : ''}`} title={long + note} aria-label={long + note}>
      {text}
    </span>
  );
}
