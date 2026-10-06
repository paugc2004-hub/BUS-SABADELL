import { useEffect, useMemo, useRef } from 'react';
import type { Pattern, SimEngine, VehicleState } from '@bus/core';
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { vehiclesAt } from '../data/vehicles.ts';
import { RouteChip, SourceTag, hm, useNow } from '../ui/common.tsx';

const SPACING = 96;
const PAD = 70;
const TOP_Y = 150;
const BOT_Y = 196;

function mainPatterns(engine: SimEngine, routeId: string, dayType: string) {
  const pats = [...engine.patterns.values()].map((p) => p.p).filter((p) => p.routeId === routeId);
  const today = pats.filter((p) => p.dayType === dayType);
  const pool = today.length ? today : pats.filter((p) => p.dayType === pats[0]?.dayType);
  const pick = (dir: number) => pool.filter((p) => p.dir === dir).sort((a, b) => b.trips.length - a.trips.length || b.stopIds.length - a.stopIds.length)[0];
  const a = pick(0) ?? pool[0];
  const b = pick(1) ?? (pool.find((p) => p !== a) ?? null);
  return { a: a ?? null, b: b && b !== a ? b : null, runsToday: today.length > 0 };
}

/** Posición x de un bus sobre el esquema del patrón principal (fracción entre paradas). */
function trackPosition(v: VehicleState, own: Pattern, main: Pattern): number | null {
  const sd = own.stopDist;
  let i = 0;
  while (i < sd.length - 1 && sd[i + 1]! <= v.dist) i++;
  const seg = (sd[i + 1] ?? sd[i]!) - sd[i]!;
  const f = seg > 0 ? Math.min(1, Math.max(0, (v.dist - sd[i]!) / seg)) : 0;
  if (own.id === main.id) return i + f;
  const a = main.stopIds.indexOf(own.stopIds[i]!);
  const b = main.stopIds.indexOf(own.stopIds[i + 1] ?? '');
  if (a >= 0 && b > a) return a + f * (b - a);
  if (a >= 0) return a;
  if (b >= 0) return b;
  return null;
}

export function LineView({ routeRef }: { routeRef: string | null }) {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const network = useApp((s) => s.network);
  const selectedBus = useApp((s) => s.selectedBus);
  const now = useNow(250);
  const scroller = useRef<HTMLDivElement>(null);
  const st = useApp.getState();
  const routeId = routeRef && engine?.routes.has(routeRef) ? routeRef : (network?.routes[0]?.id ?? 'L1');
  const route = engine?.routes.get(routeId);
  const dayType = engine ? engine.dayTypeAt(now) : 'feiner';
  const { a, b, runsToday } = useMemo(() => (engine ? mainPatterns(engine, routeId, dayType) : { a: null, b: null, runsToday: false }), [engine, routeId, dayType]);
  const summary = engine ? engine.routeSummary(routeId, now) : null;

  const n = Math.max(a?.stopIds.length ?? 0, b?.stopIds.length ?? 0);
  const width = PAD * 2 + Math.max(0, n - 1) * SPACING;
  const xTop = (i: number) => PAD + i * SPACING * ((n - 1) / Math.max(1, (a?.stopIds.length ?? 1) - 1));
  const nb = b?.stopIds.length ?? 1;
  // la vuelta se dibuja de derecha a izquierda
  const xBot = (i: number) => PAD + (nb - 1 - i) * SPACING * ((n - 1) / Math.max(1, nb - 1));

  const vehicles = engine ? vehiclesAt(engine, now).filter((v) => v.routeId === routeId) : [];
  const placed = vehicles
    .map((v) => {
      const own = engine!.patternById(v.patternId);
      if (!own) return null;
      const onA = a && (own.dir === a.dir || !b);
      const main = onA ? a! : b!;
      if (!main) return null;
      const pos = trackPosition(v, own, main);
      if (pos === null) return null;
      return { v, x: onA ? xTop(pos) : xBot(pos), y: onA ? TOP_Y : BOT_Y, dirTop: onA };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const sel = placed.find((p) => p.v.id === selectedBus);
  const selEtas = new Map((sel?.v.etas ?? []).map((e) => [e.stopId, e.at]));

  // centrar el bus seleccionado (o el primero) al abrir
  const centered = useRef<string | null>(null);
  useEffect(() => {
    const target = sel ?? placed[0];
    const key = `${routeId}|${target?.v.id ?? ''}`;
    if (!scroller.current || !target || centered.current === key) return;
    centered.current = key;
    scroller.current.scrollTo({ left: target.x - scroller.current.clientWidth / 2, behavior: 'smooth' });
  });

  if (!engine || !route || !a) return null;
  const color = route.color;

  const stopLabel = (id: string, x: number, top: boolean, i: number, len: number) => {
    const s = engine.stops.get(id);
    const name = s?.name ?? id;
    const short = name.length > 22 ? `${name.slice(0, 21)}…` : name;
    const edge = i === 0 || i === len - 1;
    return (
      <g key={`${top ? 't' : 'b'}${i}`} className="lv-stop" onClick={() => st.navigate({ name: 'stop', id })} role="button" tabIndex={0} aria-label={name}
        onKeyDown={(e) => e.key === 'Enter' && st.navigate({ name: 'stop', id })}>
        <title>{name}</title>
        <circle cx={x} cy={top ? TOP_Y : BOT_Y} r={edge ? 6.5 : 5} className={edge ? 'lv-dot edge' : 'lv-dot'} />
        <text
          x={x}
          y={top ? TOP_Y - 18 : BOT_Y + 22}
          transform={`rotate(${top ? -38 : 38} ${x} ${top ? TOP_Y - 18 : BOT_Y + 22})`}
          className="lv-label"
          textAnchor="start"
        >
          {short}
        </text>
        {top && selEtas.has(id) && sel?.dirTop && (
          <text x={x} y={TOP_Y - 8} className="lv-eta" textAnchor="middle">
            {hm(selEtas.get(id)!)}
          </text>
        )}
        {!top && selEtas.has(id) && sel && !sel.dirTop && (
          <text x={x} y={BOT_Y + 14} className="lv-eta" textAnchor="middle">
            {hm(selEtas.get(id)!)}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="line-view">
      <div className="lv-head">
        <RouteChip route={route} size="lg" />
        <div>
          <div className="lv-name">{route.longName}</div>
          <div className="dim small">
            {t.routeKind[route.kind]}
            {!runsToday && <strong className="warn"> · {t.notToday}</strong>}
          </div>
        </div>
      </div>

      <div className="lv-scroll" ref={scroller} tabIndex={0} aria-label={`${t.viewLine} ${route.ref}`}>
        <svg width={width} height={360} className="lv-svg" style={{ ['--line' as string]: color }}>
          <defs>
            <linearGradient id="fadeL" x1="0" x2="1">
              <stop offset="0" stopColor={color} stopOpacity="0" />
              <stop offset="1" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>
          <line x1={PAD - 50} x2={width - PAD + 50} y1={TOP_Y} y2={TOP_Y} className="lv-track" stroke={color} />
          {b && <line x1={PAD - 50} x2={width - PAD + 50} y1={BOT_Y} y2={BOT_Y} className="lv-track" stroke={color} />}
          <text x={PAD - 46} y={TOP_Y - 60} className="lv-dir">→ {a.headsign}</text>
          {b && <text x={width - PAD + 46} y={BOT_Y + 92} className="lv-dir" textAnchor="end">{b.headsign} ←</text>}
          {a.stopIds.map((id, i) => stopLabel(id, xTop(i), true, i, a.stopIds.length))}
          {b?.stopIds.map((id, i) => stopLabel(id, xBot(i), false, i, b.stopIds.length))}
          {placed.map(({ v, x, y, dirTop }) => (
            <g
              key={v.id}
              className={`lv-bus${v.id === selectedBus ? ' sel' : ''}${v.status === 'EN_CABECERA' || v.status === 'RETIRADA' ? ' idle' : ''}`}
              style={{ transform: `translate(${x}px, ${y}px)` }}
              onClick={() => st.selectBus(v.id === selectedBus ? null : v.id)}
              role="button"
              tabIndex={0}
              aria-label={`Bus ${v.label}`}
              onKeyDown={(e) => e.key === 'Enter' && st.selectBus(v.id)}
            >
              <rect x={-17} y={-11} width={34} height={22} rx={6} className="lv-bus-body" />
              <path d={dirTop ? 'M 19 -5 L 25 0 L 19 5 Z' : 'M -19 -5 L -25 0 L -19 5 Z'} className="lv-bus-nose" />
              <rect x={-12} y={-6} width={8} height={6} rx={1.5} className="lv-bus-win" />
              <rect x={-2} y={-6} width={8} height={6} rx={1.5} className="lv-bus-win" />
              <rect x={8} y={-6} width={4} height={6} rx={1.5} className="lv-bus-win" />
            </g>
          ))}
        </svg>
      </div>

      <div className="lv-footer">
        <div className="lv-lines" role="tablist" aria-label="Línies">
          {network?.routes.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={r.id === routeId}
              className={`lv-chip${r.id === routeId ? ' on' : ''}`}
              style={{ ['--c' as string]: r.color, ['--tc' as string]: r.textColor }}
              onClick={() => st.navigate({ name: 'line', ref: r.id })}
            >
              {r.ref}
            </button>
          ))}
        </div>
        <div className="lv-stats">
          <div>
            <div className="cell-label">{t.vehicles}</div>
            <div className="stat mono">{placed.filter((p) => p.v.status !== 'RETIRADA').length}</div>
          </div>
          <div>
            <div className="cell-label">Freq.</div>
            <div className="stat mono">{summary?.runsToday && summary.headwayMin ? `${summary.headwayMin}′` : '—'}</div>
          </div>
          <div>
            <div className="cell-label">{t.now === 'Ara' ? 'Servei' : 'Servicio'}</div>
            <div className="stat-sm mono">{summary?.runsToday ? `${hm(summary.first)}–${hm(summary.last)}` : t.notToday}</div>
          </div>
          <div>
            <div className="cell-label">Origen</div>
            <SourceTag source="SIMULATED" />
          </div>
        </div>
      </div>
    </div>
  );
}
