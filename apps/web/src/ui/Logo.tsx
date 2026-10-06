/**
 * Marca de NextMobility Sabadell: una "N" dibuixada com un recorregut de bus, amb una
 * parada al vèrtex i un bus (punt ambre) circulant per la diagonal.
 * És la mateixa forma que public/icons/icon.svg.
 */
export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden>
      <defs>
        <linearGradient id="nm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1d2230" />
          <stop offset="1" stopColor="#0b0d12" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#nm-bg)" />
      <path d="M19 47 V17 L45 47 V17" fill="none" stroke="#f4f5f7" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="19" cy="17" r="5.2" fill="#0b0d12" stroke="#f4f5f7" strokeWidth="3" />
      <circle cx="34.5" cy="35" r="5" fill="#ffb224" stroke="#0b0d12" strokeWidth="2" />
    </svg>
  );
}

export function Logo({ size = 30, withName = true, compact = false }: { size?: number; withName?: boolean; compact?: boolean }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      {withName && (
        <span className="logo-name">
          NextMobility{!compact && <span className="logo-city"> Sabadell</span>}
        </span>
      )}
    </span>
  );
}
