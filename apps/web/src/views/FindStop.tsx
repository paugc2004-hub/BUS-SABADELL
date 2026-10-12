/**
 * Cercar una parada (lupa de la capçalera) i llegir el QR d'una parada (icona QR). Paritat amb l'app de TUS, i a més:
 * parades a prop, preferides i recents quan encara no has escrit res (la de TUS queda buida).
 * La càmera només s'obre en tocar el botó, la imatge no surt del dispositiu i es para en sortir.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SimEngine } from '@bus/core';
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { RouteChip } from '../ui/common.tsx';
import { Ic } from '../ui/icons.tsx';
import { PageHead } from '../ui/Page.tsx';
import { findStops, nearStops, type StopHit } from '../data/stopSearch.ts';
import { PUBLIC_ORIGIN, parseStopQr } from '../data/stopCode.ts';

function StopRow({ engine, hit, onOpen }: { engine: SimEngine; hit: StopHit; onOpen: (id: string) => void }) {
  const t = useT();
  const { stop, m } = hit;
  return (
    <li>
      <button type="button" className="fs-row" onClick={() => onOpen(stop.id)}>
        <span className="fs-code">{stop.id}</span>
        <span className="fs-main">
          <span className="fs-name">
            {stop.id} - {stop.name}
          </span>
          <span className="fs-chips">
            {stop.routes.slice(0, 8).map((r) => (
              <RouteChip key={r} route={engine.routes.get(r)} size="sm" />
            ))}
          </span>
        </span>
        {m !== null && <span className="fs-dist dim small">{t.p.find.meters(m)}</span>}
      </button>
    </li>
  );
}

export function FindStopPage() {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const userPos = useApp((s) => s.userPos);
  const favorites = useApp((s) => s.favorites);
  const recents = useApp((s) => s.recents);
  const st = useApp.getState();
  const [q, setQ] = useState('');
  const hits = useMemo(() => (engine ? findStops(engine, q, userPos) : []), [engine, q, userPos]);
  const near = useMemo(() => (engine && userPos ? nearStops(engine, userPos) : []), [engine, userPos]);
  if (!engine) return null;
  const open = (id: string) => {
    st.addRecent(id);
    st.navigate({ name: 'stop', id });
  };
  const toHit = (id: string): StopHit | null => {
    const s = engine.stops.get(id);
    return s ? { stop: s, m: null } : null;
  };
  const list = (title: string, items: (StopHit | null)[], extra?: ReactNode) => {
    const ok = items.filter((x): x is StopHit => Boolean(x));
    if (!ok.length) return null;
    return (
      <section className="fs-sec">
        <h2 className="group-title fs-sec-title">
          <span>{title}</span>
          {extra}
        </h2>
        <ul className="fs-list">
          {ok.map((h) => (
            <StopRow key={h.stop.id} engine={engine} hit={h} onOpen={open} />
          ))}
        </ul>
      </section>
    );
  };
  return (
    <aside className="home find-stop" aria-label={t.p.find.title}>
      <PageHead title={t.p.find.title} up={{ name: 'map' }} />
      <div className="fs-bar">
        <label className="search-field fs-field">
          {Ic.search}
          <input type="search" inputMode="search" value={q} placeholder={t.p.find.placeholder} aria-label={t.p.find.placeholder} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </label>
        <button type="button" className="fs-qr" aria-label={t.p.find.qr} title={t.p.find.qr} onClick={() => st.navigate({ name: 'scan' })}>
          {Ic.qr}
        </button>
      </div>
      {q.trim() ? (
        hits.length ? (
          <ul className="fs-list fs-results">
            {hits.map((h) => (
              <StopRow key={h.stop.id} engine={engine} hit={h} onOpen={open} />
            ))}
          </ul>
        ) : (
          <p className="empty">{t.p.find.none}</p>
        )
      ) : (
        <>
          <p className="dim small fs-hint">{t.p.find.hint}</p>
          {list(t.p.find.near, near)}
          {list(t.p.find.favs, favorites.map(toHit))}
          {list(
            t.p.find.recents,
            recents.map(toHit),
            <button type="button" className="text-btn" onClick={() => st.clearRecents()}>
              {t.p.find.clear}
            </button>,
          )}
        </>
      )}
    </aside>
  );
}

type ScanState = 'idle' | 'starting' | 'reading' | 'denied' | 'noCamera' | 'unsupported';

interface Detector {
  detect(src: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

export function ScanPage() {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const st = useApp.getState();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<ScanState>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const exists = (c: string) => Boolean(engine?.stops.has(c));
  const origins = [PUBLIC_ORIGIN, location.origin];

  const stop = () => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  };
  // la càmera s'atura en sortir de la pantalla o en amagar l'app
  useEffect(() => {
    const vis = () => {
      if (document.hidden) {
        stop();
        setState('idle');
      }
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      stop();
    };
  }, []);

  const found = (text: string) => {
    const id = parseStopQr(text, exists, origins);
    if (!id) {
      setMsg(t.p.scan.unknown);
      return false;
    }
    stop();
    st.addRecent(id);
    st.navigate({ name: 'stop', id });
    return true;
  };

  const start = async () => {
    setMsg(null);
    if (!navigator.mediaDevices?.getUserMedia) return setState('unsupported');
    setState('starting');
    let s: MediaStream;
    try {
      s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch (e) {
      const name = (e as { name?: string }).name;
      return setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'noCamera');
    }
    stream.current = s;
    const v = video.current;
    if (!v) return stop();
    v.srcObject = s;
    await v.play().catch(() => undefined);
    setState('reading');
    // BarcodeDetector (natiu) si n'hi ha; si no, jsQR carregat només ara
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    const det: Detector | null = BD ? new BD({ formats: ['qr_code'] }) : null;
    const jsqr = det ? null : (await import('jsqr')).default;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const tick = async () => {
      if (!stream.current || !video.current) return;
      const vv = video.current;
      if (vv.readyState >= 2 && vv.videoWidth) {
        let text: string | null = null;
        if (det) text = (await det.detect(vv).catch(() => []))[0]?.rawValue ?? null;
        else if (jsqr && ctx) {
          const w = Math.min(640, vv.videoWidth);
          const h = Math.round((vv.videoHeight / vv.videoWidth) * w);
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(vv, 0, 0, w, h);
          text = jsqr(ctx.getImageData(0, 0, w, h).data, w, h)?.data ?? null;
        }
        if (text && found(text)) return;
      }
      window.setTimeout(() => void tick(), 250);
    };
    void tick();
  };

  return (
    <aside className="home scan-page" aria-label={t.p.scan.title}>
      <PageHead title={t.p.scan.title} up={{ name: 'findStop' }} />
      <p className="page-lead">{t.p.scan.intro}</p>
      <div className={`scan-view${state === 'reading' ? ' on' : ''}`}>
        <video ref={video} playsInline muted aria-label={t.p.scan.reading} />
        {state === 'reading' && <span className="scan-frame" aria-hidden />}
      </div>
      {state === 'reading' ? (
        <button
          type="button"
          className="btn ghost wide"
          onClick={() => {
            stop();
            setState('idle');
          }}
        >
          {t.p.scan.stop}
        </button>
      ) : (
        <button type="button" className="btn primary wide" onClick={() => void start()} disabled={state === 'starting'}>
          {Ic.qr} {t.p.scan.start}
        </button>
      )}
      <div role="status" aria-live="polite">
        {state === 'reading' && <p className="dim small">{t.p.scan.reading}</p>}
        {state === 'denied' && <p className="form-msg err">{t.p.scan.denied}</p>}
        {state === 'noCamera' && <p className="form-msg err">{t.p.scan.noCamera}</p>}
        {state === 'unsupported' && <p className="form-msg err">{t.p.scan.unsupported}</p>}
        {msg && <p className="form-msg err">{msg}</p>}
      </div>
      <form
        className="scan-type"
        onSubmit={(e) => {
          e.preventDefault();
          found(code);
        }}
      >
        <label className="field">
          <span>{t.p.scan.type}</span>
          <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="43" autoComplete="off" />
        </label>
        <button type="submit" className="btn ghost" disabled={!code.trim()}>
          {t.p.scan.go}
        </button>
      </form>
    </aside>
  );
}
