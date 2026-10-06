import { useMemo, useState } from 'react';
import { collator, haversine, normalize } from '@bus/core';
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { RouteChip, Icon, IconButton, relativeLabel, useNow } from '../ui/common.tsx';

/**
 * Cercador de parades i línies (tolerant a accents) i, a la vegada, la vista
 * accessible en forma de llista: línies → parades → llegades (sección 7.10).
 */
export function SearchPanel() {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const network = useApp((s) => s.network);
  const favorites = useApp((s) => s.favorites);
  const userPos = useApp((s) => s.userPos);
  const [q, setQ] = useState('');
  const [openLine, setOpenLine] = useState<string | null>(null);
  const now = useNow(15000);
  const st = useApp.getState();

  const results = useMemo(() => {
    if (!network) return { routes: [], stops: [] };
    const nq = normalize(q);
    if (!nq) return { routes: [], stops: [] };
    const tokens = nq.split(' ');
    const routes = network.routes.filter((r) => normalize(`${r.ref} ${r.longName}`).includes(nq) || r.ref.toLowerCase() === nq.replace(/^l/, 'l'));
    const stops = network.stops
      .map((s) => ({ s, n: normalize(s.name) }))
      .filter(({ n, s }) => tokens.every((tk) => n.includes(tk)) || s.id === q.trim())
      .sort((a, b) => Number(b.n.startsWith(nq)) - Number(a.n.startsWith(nq)) || collator.compare(a.s.name, b.s.name))
      .slice(0, 30)
      .map(({ s }) => s);
    return { routes, stops };
  }, [q, network]);

  if (!network || !engine) return null;
  const nearby = userPos
    ? [...network.stops]
        .map((s) => ({ s, d: haversine(userPos, [s.lon, s.lat]) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 5)
    : [];
  const dayType = engine.dayTypeAt(now);
  const goStop = (id: string) => st.navigate({ name: 'stop', id });

  return (
    <section className="panel search-panel" aria-label={t.nav.search}>
      <div className="search-box">
        {Icon.search}
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
        />
        <IconButton label={t.close} onClick={() => st.navigate({ name: 'map' })}>
          {Icon.close}
        </IconButton>
      </div>

      {q && results.routes.length + results.stops.length === 0 && <div className="card-empty">{t.searchEmpty}</div>}
      {results.routes.length > 0 && (
        <ul className="result-list">
          {results.routes.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => st.navigate({ name: 'line', ref: r.id })}>
                <RouteChip route={r} size="sm" /> <span>{r.longName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {results.stops.length > 0 && (
        <ul className="result-list">
          {results.stops.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => goStop(s.id)}>
                <span className="stop-dot" aria-hidden />
                <span className="grow">{s.name}</span>
                <span className="chips">
                  {s.routes.slice(0, 5).map((r) => (
                    <RouteChip key={r} route={engine.routes.get(r)} size="sm" />
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!q && (
        <>
          {favorites.length > 0 && (
            <>
              <h3 className="section-title">{t.favorites}</h3>
              <ul className="result-list">
                {favorites.map((id) => {
                  const s = engine.stops.get(id);
                  if (!s) return null;
                  const next = engine.arrivals(id, now, 60, 1)[0];
                  return (
                    <li key={id}>
                      <button type="button" onClick={() => goStop(id)}>
                        {Icon.star(true)} <span className="grow">{s.name}</span>
                        {next && (
                          <span className="small">
                            <RouteChip route={engine.routes.get(next.routeId)} size="sm" /> {relativeLabel(next.at, now, t)}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {nearby.length > 0 && (
            <>
              <h3 className="section-title">{t.nearby}</h3>
              <ul className="result-list">
                {nearby.map(({ s, d }) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => goStop(s.id)}>
                      <span className="stop-dot" aria-hidden />
                      <span className="grow">{s.name}</span>
                      <span className="dim small mono">{Math.round(d)} m</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3 className="section-title">
            {t.list} · <span className="dim">{t.listHint}</span>
          </h3>
          <ul className="tree">
            {network.routes.map((r) => {
              const open = openLine === r.id;
              const pats = network.patterns.filter((p) => p.routeId === r.id);
              const main = pats.filter((p) => p.dayType === dayType).sort((a, b) => b.trips.length - a.trips.length)[0] ?? pats[0];
              return (
                <li key={r.id}>
                  <button type="button" aria-expanded={open} onClick={() => setOpenLine(open ? null : r.id)} className="tree-head">
                    <RouteChip route={r} size="sm" dim={!engine.runsOn(r.id, dayType)} />
                    <span className="grow">{r.longName}</span>
                    {!engine.runsOn(r.id, dayType) && <span className="dim small">{t.notToday}</span>}
                  </button>
                  {open && main && (
                    <ol className="tree-stops">
                      {main.stopIds.map((id, i) => (
                        <li key={`${id}${i}`}>
                          <button type="button" className="linklike" onClick={() => goStop(id)}>
                            {engine.stops.get(id)?.name ?? id}
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
