/**
 * On ets: una línia d'estat de la ubicació (detectant, ets aquí, activa-la, denegada, temps esgotat…)
 * amb l'acció que toca. Mai bloqueja l'app: sense ubicació, la ruta deixa triar des d'on surts.
 */
import type { ReactNode } from 'react';
import { useT } from '../i18n/index.ts';
import { locationService, useLocation } from '../location/location.ts';
import { useApp } from '../state/store.ts';
import { Icon } from '../ui/common.tsx';

const platform = () =>
  typeof navigator === 'undefined'
    ? 'other'
    : /iphone|ipad|ipod/i.test(navigator.userAgent)
      ? 'ios'
      : /android/i.test(navigator.userAgent)
        ? 'android'
        : 'other';

export function LocationStatus({
  okText,
  onFallback,
}: {
  okText?: ReactNode;
  onFallback?: () => void;
}) {
  const t = useT();
  const status = useLocation((s) => s.status);
  const userPos = useApp((s) => s.userPos);
  const retry = () => void locationService.retry();
  const fallback = onFallback && (
    <button type="button" className="text-btn" onClick={onFallback}>
      {t.loc.fallback}
    </button>
  );
  if (userPos)
    return (
      <div className="simple-loc" role="status" data-loc="ok">
        {Icon.locate}
        <span>{okText ?? t.loc.here}</span>
      </div>
    );
  if (status === 'locating' || status === 'idle')
    return (
      <div className="simple-loc" role="status" data-loc="locating">
        <span className="loc-pulse" aria-hidden />
        <span>{t.loc.locating}</span>
      </div>
    );
  if (status === 'denied') {
    const p = platform();
    return (
      <div className="simple-loc off loc-block" role="status" data-loc="denied">
        {Icon.locate}
        <span>
          <strong>{t.loc.denied}</strong> {t.loc.deniedHelp}
          <span className="dim small loc-help">
            {p === 'ios' ? t.loc.deniedIos : p === 'android' ? t.loc.deniedAndroid : null}
          </span>
        </span>
        <span className="loc-actions">
          <button type="button" className="text-btn" onClick={retry}>
            {t.loc.retry}
          </button>
          {fallback}
        </span>
      </div>
    );
  }
  const msg =
    status === 'timeout'
      ? t.loc.timeout
      : status === 'unavailable'
        ? t.loc.unavailable
        : status === 'unsupported'
          ? t.loc.unsupported
          : t.loc.promptText;
  return (
    <div className="simple-loc off loc-block" role="status" data-loc={status}>
      {Icon.locate}
      <span>{msg}</span>
      <span className="loc-actions">
        {status !== 'unsupported' && (
          <button type="button" className="text-btn" onClick={retry}>
            {status === 'prompt' ? t.loc.prompt : t.loc.retry}
          </button>
        )}
        {fallback}
      </span>
    </div>
  );
}
