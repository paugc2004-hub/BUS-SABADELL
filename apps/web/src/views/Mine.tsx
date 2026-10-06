/** Els meus (/meus): viatge actiu i parades desades. Tot al navegador; sense compte. */
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { HomeStops } from './Home.tsx';

export function MinePanel() {
  const t = useT();
  const trip = useApp((s) => s.trip);
  return (
    <aside className="home mine" aria-label={t.minePage.title}>
      <h1 className="page-title">{t.minePage.title}</h1>
      <section className="home-sec">
        <h2 className="sec-title">{t.minePage.trip}</h2>
        {/* la targeta del viatge es mostra sempre a sobre del mapa; aquí, si no n'hi ha, com començar-ne un */}
        {!trip && <p className="dim">{t.minePage.noTrip}</p>}
      </section>
      <HomeStops />
    </aside>
  );
}
