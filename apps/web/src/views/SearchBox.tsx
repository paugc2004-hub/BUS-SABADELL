/** Cercador global: carrers (on vas → com hi arribo), línies, parades (per zona) i destinacions. Navegable amb el teclat. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { areaOf } from '../data/derive.ts';
import { searchAll } from '../data/search.ts';
import { Icon, RouteChip } from '../ui/common.tsx';
import { loadStreets, searchPlaces, type Gazetteer } from '../data/streets.ts';
import { placeWhere, poiWhere } from './Route.tsx';

export function SearchBox({ autoFocus = false, toRoute = false, placeholder }: { autoFocus?: boolean; toRoute?: boolean; placeholder?: string }) {
  const t = useT();
  const network = useApp((s) => s.network);
  const engine = useApp((s) => s.engine);
  // compartit des d'una altra app o enllaç web+nextmobility: /cercar?text=…
  const [q, setQ] = useState(() => {
    const p = new URLSearchParams(location.search);
    const raw = (p.get('text') || p.get('title') || '').replace(/^web\+nextmobility:/i, '');
    try {
      return decodeURIComponent(raw).trim().slice(0, 80);
    } catch {
      return raw.trim().slice(0, 80);
    }
  });
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const st = useApp.getState();
  const res = useMemo(() => (network && engine ? searchAll(network, q, (id) => areaOf(engine, id)) : null), [network, engine, q]);
  // carrers: es baixen la primera vegada que s'escriu alguna cosa
  const [gz, setGz] = useState<Gazetteer | null>(null);
  useEffect(() => {
    if (q.trim() && !gz) void loadStreets().then(setGz).catch(() => undefined);
  }, [q, gz]);
  const { streets, places } = useMemo(() => (gz && q.trim().length >= 2 ? searchPlaces(gz, q, 4) : { streets: [], places: [] }), [gz, q]);
  if (!network || !engine || !res) return null;

  type Item = { key: string; go: () => void };
  const items: Item[] = [
    ...places.map((x) => ({ key: `l${x.id}`, go: () => st.navigate({ name: 'route', to: `l${x.id}` }) })),
    ...streets.map((x) => ({ key: `c${x.id}`, go: () => st.navigate({ name: 'route', to: `c${x.id}` }) })),
    ...res.routes.map((r) => ({ key: `r${r.id}`, go: () => st.navigate({ name: 'line', ref: r.id }) })),
    ...res.stops.map((s) => ({ key: `s${s.stop.id}`, go: () => st.navigate(toRoute ? { name: 'route', to: `p${s.stop.id}` } : { name: 'stop', id: s.stop.id }) })),
    ...res.destinations.map((d) => ({ key: `d${d.name.replace(/\W+/g, '-')}`, go: () => st.navigate({ name: 'line', ref: d.routes[0]! }) })),
  ];
  const pick = (i: number) => {
    items[i]?.go();
    setQ('');
  };
  let idx = -1;
  const row = () => ++idx;
  const open = q.trim().length > 0;

  return (
    <div className={`searchbox${open ? ' open' : ''}`} role="search">
      <label className="search-field">
        {Icon.search}
        <input
          ref={ref}
          autoFocus={autoFocus}
          type="search"
          value={q}
          placeholder={placeholder ?? t.plan.searchPlaceholder}
          aria-label={placeholder ?? t.plan.searchPlaceholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="search-results"
          aria-activedescendant={open && items[active] ? `sr-${items[active]!.key}` : undefined}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter') pick(active);
            else if (e.key === 'Escape') setQ('');
          }}
        />
      </label>
      {open && (
        <div id="search-results" className="search-results" role="listbox" aria-label={t.searchAll}>
          {items.length === 0 && <div className="sr-empty">{t.searchEmpty}</div>}
          {places.length > 0 && <div className="sr-group">{t.plan.places}</div>}
          {places.map((x) => {
            const i = row();
            return (
              <button key={x.id} id={`sr-l${x.id}`} type="button" role="option" aria-selected={i === active} className={`sr-item${i === active ? ' on' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => pick(i)}>
                <span className="sr-dest" aria-hidden>
                  {Icon.home}
                </span>
                <span className="sr-main">
                  {x.name}
                  <span className="sr-sub">{poiWhere(x, t)}</span>
                </span>
                <span className="sr-go">{t.plan.title} ›</span>
              </button>
            );
          })}
          {streets.length > 0 && <div className="sr-group">{t.plan.streets}</div>}
          {streets.map((x) => {
            const i = row();
            return (
              <button key={x.id} id={`sr-c${x.id}`} type="button" role="option" aria-selected={i === active} className={`sr-item${i === active ? ' on' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => pick(i)}>
                <span className="sr-dest" aria-hidden>
                  {Icon.home}
                </span>
                <span className="sr-main">
                  {x.name}
                  <span className="sr-sub">{placeWhere(x, t)}</span>
                </span>
                <span className="sr-go">{t.plan.title} ›</span>
              </button>
            );
          })}
          {res.routes.length > 0 && <div className="sr-group">{t.results.lines}</div>}
          {res.routes.map((r) => {
            const i = row();
            return (
              <button key={r.id} id={`sr-r${r.id}`} type="button" role="option" aria-selected={i === active} className={`sr-item${i === active ? ' on' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => pick(i)}>
                <RouteChip route={r} size="md" />
                <span className="sr-main">{r.longName}</span>
              </button>
            );
          })}
          {res.stops.length > 0 && <div className="sr-group">{t.results.stops}</div>}
          {res.stops.map((s) => {
            const i = row();
            return (
              <button key={s.stop.id} id={`sr-s${s.stop.id}`} type="button" role="option" aria-selected={i === active} className={`sr-item${i === active ? ' on' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => pick(i)}>
                <span className="stop-dot" aria-hidden />
                <span className="sr-main">{s.stop.name}</span>
                <span className="chips sr-chips">
                  {s.routes.slice(0, 5).map((r) => (
                    <RouteChip key={r} route={engine.routes.get(r)} size="sm" />
                  ))}
                </span>
              </button>
            );
          })}
          {res.destinations.length > 0 && <div className="sr-group">{t.results.destinations}</div>}
          {res.destinations.map((d) => {
            const i = row();
            return (
              <button key={d.name} id={`sr-d${d.name.replace(/\W+/g, '-')}`} type="button" role="option" aria-selected={i === active} className={`sr-item${i === active ? ' on' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => pick(i)}>
                <span className="sr-dest" aria-hidden>
                  →
                </span>
                <span className="sr-main">{d.name}</span>
                <span className="chips sr-chips">
                  {d.routes.slice(0, 5).map((r) => (
                    <RouteChip key={r} route={engine.routes.get(r)} size="sm" />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
