/**
 * Mode presentació (/presentacio): demo narrada de 2–3 minuts sobre l'aplicació real.
 *
 * No és un vídeo ni una maqueta: cada escena mou l'estat de l'app (línia enfocada, bus
 * seleccionat, seguiment, parada, viatge) i el que es veu és el mateix mapa, la mateixa
 * fitxa i el mateix panell de parada que fa servir qualsevol usuari.
 *
 *  1 xarxa · 2 línia · 3 bus · 4 seguir · 5 línia temporal · 6 parada · 7 viatge · 8 "a 2 parades"
 *
 * Determinista: amb la mateixa hora forçada (?hora=08:15&dia=dimarts) tria sempre el mateix bus.
 * Controls: ←/→ escenes, espai pausa, Esc surt. Velocitat del rellotge 1× 5× 10× 30×.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { forcedInstant, stopsUntil, type SimEngine, type VehicleState } from '@bus/core';
import { clock, useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { vehicleById, vehiclesAt } from '../data/vehicles.ts';
import { RouteChip, hm, useNow } from '../ui/common.tsx';

const SCENES = 10;
/** durada mínima de cada escena (ms de temps real) */
const DUR = [9000, 9000, 10000, 9000, 11000, 11000, 8000, 30000, 12000, 16000];
const SPEEDS = [1, 5, 10, 30];

interface Cast {
  routeId: string;
  busId: string;
  /** parada de la demo: 3 parades per davant del bus */
  stopId: string;
  stopIndex: number;
  patternId: string;
}

/** Tria la línia (L2 si circula), un bus amb recorregut per davant i la parada de la demo. */
function cast(engine: SimEngine, t: number, prefer: string | null = null): Cast | null {
  const vs = vehiclesAt(engine, t).filter((v) => v.status === 'EN_RUTA' && v.stopsRemaining >= 8);
  const byRoute = new Map<string, VehicleState[]>();
  for (const v of vs) byRoute.set(v.routeId, [...(byRoute.get(v.routeId) ?? []), v]);
  const order = [...(prefer ? [prefer] : []), 'L2', ...[...byRoute.entries()].sort((a, b) => b[1].length - a[1].length).map(([r]) => r)];
  for (const r of order) {
    const cands = (byRoute.get(r) ?? []).sort((a, b) => a.id.localeCompare(b.id));
    for (const v of cands) {
      const p = engine.patternById(v.patternId)!;
      const idx = v.nextStopIndex + 3;
      const stopId = p.stopIds[idx];
      if (!stopId || idx >= p.stopIds.length - 1) continue;
      return { routeId: r, busId: v.id, stopId, stopIndex: idx, patternId: v.patternId };
    }
  }
  return null;
}

export function Presentation() {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const network = useApp((s) => s.network);
  const now = useNow(1000);
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(clock.getSpeed());
  const castRef = useRef<Cast | null>(null);
  const [lineChoice, setLineChoice] = useState<string | null>(null);
  const [setup, setSetup] = useState(false);
  const [when, setWhen] = useState(() => ({ time: '08:15', date: '' }));
  const enteredAt = useRef(Date.now());

  const setClockSpeed = useCallback((x: number) => {
    setSpeed(x);
    useApp.getState().setClock(clock.now(), x);
  }, []);

  // en entrar: si ara no hi ha prou servei (nit, festiu sense F...), hora de demo de dia feiner
  useEffect(() => {
    if (!engine) return;
    if (vehiclesAt(engine, clock.now()).filter((v) => v.status === 'EN_RUTA').length < 15)
      useApp.getState().setClock(forcedInstant(Date.now(), '08:15', 'dimarts'), clock.getSpeed());
    const s = useApp.getState();
    s.endTrip();
    s.set({ homeCollapsed: true });
    return () => {
      const e = useApp.getState();
      e.setFocusRoute(null);
      e.setFollow(false);
      e.selectBus(null);
      e.endTrip();
      e.set({ homeCollapsed: false });
    };
  }, [engine]);

  // cada escena posa l'app en el seu estat
  useEffect(() => {
    if (!engine) return;
    enteredAt.current = Date.now();
    const s = useApp.getState();
    if (scene === 0 || !castRef.current) castRef.current = cast(engine, clock.now(), lineChoice);
    const c = castRef.current;
    const goStop = () => c && s.view.name !== 'stop' && s.navigate({ name: 'stop', id: c.stopId }, { replace: true });
    const goMap = () => s.view.name !== 'present' && s.navigate({ name: 'present' }, { replace: true });
    switch (scene) {
      case 0:
        s.endTrip();
        s.setFollow(false);
        s.selectBus(null);
        s.setFocusRoute(null);
        goMap();
        if (speed !== 1) setClockSpeed(1);
        s.requestFly([2.1065, 41.5475], window.innerWidth < 700 ? 12 : 12.8);
        break;
      case 1:
        goMap();
        s.selectBus(null);
        s.setFocusRoute(c?.routeId ?? null);
        break;
      case 2:
        if (c) s.selectBus(c.busId);
        s.setFocusRoute(null);
        break;
      case 3:
        if (c) s.selectBus(c.busId);
        s.setFollow(true);
        break;
      case 4:
        s.setFollow(true);
        setClockSpeed(5);
        break;
      case 5:
        s.setFollow(false);
        s.selectBus(null);
        setClockSpeed(1);
        goStop();
        break;
      case 6:
        goStop();
        if (c) {
          s.set({ boardHint: c.stopId });
          s.selectBus(c.busId);
          const v = vehicleById(engine, c.busId, clock.now());
          // si el bus ja ha passat la parada de la demo, es tria la següent per davant
          let idx = c.stopIndex;
          if (v && v.patternId === c.patternId && stopsUntil(v, idx) < 3) idx = Math.min(engine.patternById(c.patternId)!.stopIds.length - 2, v.nextStopIndex + 2);
          const stopId = engine.patternById(c.patternId)!.stopIds[idx]!;
          s.startTrip({ vehicleId: c.busId, patternId: c.patternId, routeId: c.routeId, boardIndex: idx, boardStopId: stopId, alightIndex: null });
        }
        break;
      case 7:
        // fins que el bus és a 2 parades, el rellotge corre
        setClockSpeed(10);
        break;
      case 8:
        // la vista per a TUS: tota la xarxa, amb les xifres derivades de la mateixa flota
        setClockSpeed(1);
        s.selectBus(null);
        s.endTrip();
        s.navigate({ name: 'network' }, { replace: true });
        s.requestFly([2.1065, 41.5475], window.innerWidth < 700 ? 12 : 12.6);
        break;
      case 9:
        goMap();
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, engine]);

  // avançar escenes (i l'escena 8 espera l'esdeveniment real "a 2 parades")
  useEffect(() => {
    if (!playing || !engine) return;
    const id = setInterval(() => {
      const elapsed = Date.now() - enteredAt.current;
      if (scene === 7) {
        const tr = useApp.getState().trip;
        const v = tr ? vehicleById(engine, tr.vehicleId, clock.now()) : null;
        const away = v && tr && v.patternId === tr.patternId ? stopsUntil(v, tr.boardIndex) : null;
        if (away !== null && away <= 2 && clock.getSpeed() !== 1) setClockSpeed(1);
        if ((away !== null && away <= 1) || elapsed > DUR[7]!) setScene(8);
        return;
      }
      if (elapsed > DUR[scene]!) setScene((x) => (x + 1) % SCENES);
    }, 400);
    return () => clearInterval(id);
  }, [playing, scene, engine, setClockSpeed]);

  // teclat
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setScene((x) => (x + 1) % SCENES);
      else if (e.key === 'ArrowLeft') setScene((x) => (x + SCENES - 1) % SCENES);
      else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === 'Escape') exit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const exit = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    const s = useApp.getState();
    s.set({ presenting: false });
    s.setClock(null, 1);
    s.navigate({ name: 'home' });
  };

  if (!engine || !network) return null;
  const c = castRef.current;
  const route = c ? engine.routes.get(c.routeId) : undefined;
  const vs = vehiclesAt(engine, now);
  const moving = vs.filter((v) => v.status !== 'RETIRADA').length;
  const linesNow = new Set(vs.map((v) => v.routeId)).size;
  const sc = t.presentation.scenes[scene]!;
  const x = scene === 1 ? route?.ref ?? '' : scene === 5 && c ? engine.stops.get(c.stopId)?.name ?? '' : '';

  return (
    <div className="director" aria-live="polite">
      <div className="present-hud">
        <div className="hud-stats">
          <div>
            <div className="hud-num mono">{moving}</div>
            <div className="hud-lbl">{t.presentation.inService}</div>
          </div>
          <div>
            <div className="hud-num mono">{linesNow}</div>
            <div className="hud-lbl">{t.linesCount}</div>
          </div>
          <div>
            <div className="hud-num mono">{network.stops.length}</div>
            <div className="hud-lbl">{t.stopsCount}</div>
          </div>
        </div>
      </div>
      <div className="caption">
        <div className="caption-meta">
          <span className="mono">{t.presentation.scene.replace('{i}', String(scene + 1)).replace('{n}', String(SCENES))}</span>
          {route && scene > 0 && <RouteChip route={route} size="sm" />}
          <span className="mono dim">{hm(now)}</span>
        </div>
        <h2>{sc.title.replace('{x}', x)}</h2>
        <p>{sc.text}</p>
        <div className="caption-dots" aria-hidden>
          {Array.from({ length: SCENES }, (_, i) => (
            <span key={i} className={i === scene ? 'on' : i < scene ? 'done' : ''} />
          ))}
        </div>
        <div className="caption-ctrl">
          <button type="button" aria-label={t.presentation.prev} onClick={() => setScene((s) => (s + SCENES - 1) % SCENES)}>
            ‹
          </button>
          <button type="button" className="play" aria-label={playing ? t.presentation.pause : t.presentation.play} onClick={() => setPlaying(!playing)}>
            {playing ? '❚❚' : '▶'}
          </button>
          <button type="button" aria-label={t.presentation.next} onClick={() => setScene((s) => (s + 1) % SCENES)}>
            ›
          </button>
          <span className="caption-speed" role="group" aria-label={t.presentation.speed}>
            {SPEEDS.map((v) => (
              <button key={v} type="button" className={speed === v ? 'on' : ''} aria-pressed={speed === v} onClick={() => setClockSpeed(v)}>
                {v}×
              </button>
            ))}
          </span>
          <button type="button" className={`gear${setup ? ' on' : ''}`} aria-label={t.presentation.setup} aria-expanded={setup} onClick={() => setSetup(!setup)}>
            ⚙
          </button>
          <button type="button" className="exit" onClick={exit}>
            {t.presentation.exit}
          </button>
        </div>
        {setup && (
          <div className="caption-setup">
            <label>
              {t.presentation.time}
              <input type="time" value={when.time} onChange={(e) => setWhen({ ...when, time: e.target.value })} />
            </label>
            <label>
              {t.presentation.date}
              <input type="date" value={when.date} onChange={(e) => setWhen({ ...when, date: e.target.value })} />
            </label>
            <label>
              {t.presentation.line}
              <select value={lineChoice ?? ''} onChange={(e) => setLineChoice(e.target.value || null)}>
                <option value="">L2</option>
                {network.routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.ref}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="primary"
              onClick={() => {
                // reinicia: nova hora/data, línia triada i tornada a l'escena 1
                const start = forcedInstant(Date.now(), when.time || '08:15', when.date || 'dimarts');
                useApp.getState().setClock(start, 1);
                setSpeed(1);
                castRef.current = null;
                setScene(0);
                setPlaying(true);
                setSetup(false);
              }}
            >
              {t.presentation.reset}
            </button>
          </div>
        )}
      </div>
      {scene === 9 && <Architecture />}
      <div className="present-banner">{t.banner}</div>
    </div>
  );
}

/** Escena final: d'on venen les dades avui i d'on vindran amb el SAE de TUS. */
function Architecture() {
  const t = useT();
  const a = t.presentation.arch;
  return (
    <div className="arch" role="figure" aria-label={a.title}>
      <div className="arch-col">
        <div className="arch-box today">
          <strong>{a.sim}</strong>
          <span>{a.simSub}</span>
          <em>{a.today}</em>
        </div>
        <div className="arch-box future">
          <strong>{a.sae}</strong>
          <span>{a.saeSub}</span>
          <em>{a.tomorrow}</em>
        </div>
      </div>
      <div className="arch-arrow" aria-hidden>→</div>
      <div className="arch-box core">
        <strong>VehicleProvider → VehicleState</strong>
        <span>{a.coreSub}</span>
      </div>
      <div className="arch-arrow" aria-hidden>→</div>
      <div className="arch-box ui">
        <strong>{a.ui}</strong>
        <span>{a.uiSub}</span>
      </div>
      <p className="arch-msg">{a.message}</p>
    </div>
  );
}
