/** Enllaços legals comuns (licitació 2024, PPT §2.1.2: privacitat, galetes i avís legal a totes les pàgines). */
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';

export function LegalLinks({ className = 'legal-links' }: { className?: string }) {
  const t = useT();
  const st = useApp.getState();
  return (
    <nav className={className} aria-label="Legal">
      <a href="/tarifes" onClick={(e) => (e.preventDefault(), st.navigate({ name: 'fares' }))}>
        {t.fares.nav}
      </a>
      <a href="/punts-de-venda" onClick={(e) => (e.preventDefault(), st.navigate({ name: 'sales' }))}>
        {t.fares.where}
      </a>
      {(['privacitat', 'avis-legal', 'galetes'] as const).map((p) => (
        <a key={p} href={`/${p}`} onClick={(e) => (e.preventDefault(), st.navigate({ name: 'legal', page: p }))}>
          {t.pub.legal[p]}
        </a>
      ))}
      <a href="/qr" onClick={(e) => (e.preventDefault(), st.navigate({ name: 'qr', id: null }))}>
        {t.pub.qrTitle}
      </a>
    </nav>
  );
}
