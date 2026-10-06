import type { Route, VehicleStatus } from '@bus/core';
import { BUS_GEOMETRY as G } from './busGeometry.ts';

export interface BusVehicleMarkerProps {
  route: Route | undefined;
  status?: VehicleStatus;
  /** rumbo en grados (0 = norte). Sin rumbo, el bus se dibuja de lado, mirando a la derecha. */
  heading?: number | null;
  /** etiqueta de vehicle (torn simulat o número real); opcional */
  vehicle?: string;
  destination?: string;
  selected?: boolean;
  followed?: boolean;
  size?: number;
  showLabel?: boolean;
  className?: string;
}

/**
 * Autobús vectorial reutilizable: misma silueta que el icono del mapa.
 * Estados: en ruta, en parada, cabecera, retrasado, desviado, retirada; seleccionado; seguido.
 */
export function BusVehicleMarker({
  route,
  status = 'EN_RUTA',
  heading = null,
  vehicle,
  destination,
  selected = false,
  followed = false,
  size = 28,
  showLabel = true,
  className = '',
}: BusVehicleMarkerProps) {
  const off = status === 'RETIRADA';
  const color = off ? '#5b616b' : route?.color ?? '#888';
  const rot = heading === null ? 90 : heading;
  const { body, glass, rear, roof, nose } = G;
  const label = [route?.ref, destination ? `→ ${destination}` : null, vehicle ? `· ${vehicle}` : null].filter(Boolean).join(' ');
  return (
    <span
      className={`bvm bvm-${status.toLowerCase()}${selected ? ' sel' : ''}${followed ? ' followed' : ''} ${className}`}
      role="img"
      aria-label={`Bus ${label}`}
      style={{ ['--c' as string]: color, ['--tc' as string]: route?.textColor ?? '#fff' }}
    >
      <svg viewBox={`0 0 ${G.w} ${G.h}`} width={(size * G.w) / G.h} height={size} style={{ transform: `rotate(${rot}deg)` }} aria-hidden>
        <rect x={body.x} y={body.y} width={body.w} height={body.h} rx={body.r} fill={color} stroke="#08090b" strokeWidth={2.4} />
        <rect x={body.x + 1.1} y={body.y + 1.1} width={body.w - 2.2} height={body.h - 2.2} rx={body.r - 1} fill="none" stroke="#fff" strokeOpacity={0.9} strokeWidth={1} />
        <rect x={glass.x} y={glass.y} width={glass.w} height={glass.h} rx={glass.r} fill="#0b0d10" />
        <rect x={rear.x} y={rear.y} width={rear.w} height={rear.h} rx={rear.r} fill="#0b0d10" />
        {roof.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={1.5} fill="#fff" fillOpacity={0.28} />
        ))}
        <path d={`M${nose.map((p) => p.join(' ')).join(' L')} Z`} fill="#fff" stroke="#08090b" strokeWidth={1} />
      </svg>
      {showLabel && route && <span className="bvm-code">{route.ref}</span>}
      {status === 'RETRASADO' && <span className="bvm-badge delay" aria-hidden />}
      {status === 'DESVIADO' && <span className="bvm-badge detour" aria-hidden />}
    </span>
  );
}
