/**
 * Iconos del mapa dibujados en canvas (no dependen de las fuentes del mapa base,
 * así funcionan también sin conexión).
 *
 *  - bus-<línea>: silueta de autobús vista desde arriba con el color de la línea.
 *    Apunta al norte; MapLibre la rota con el rumbo, así el morro indica el sentido.
 *  - bus-off: la misma silueta en gris (retirada / fuera de servicio)
 *  - lbl-<línea>: etiqueta con el código de línea; nunca rota
 *  - badge-delay / badge-detour: solo los usa un proveedor real (la simulación no los genera)
 *  - arrow: flecha de sentido sobre el recorrido de la línea enfocada
 *
 * La geometría del bus es la misma que la del componente SVG `BusVehicleMarker`.
 */
import type { Map as MLMap } from 'maplibre-gl';
import type { Route } from '@bus/core';
import { BUS_GEOMETRY as G } from '../ui/busGeometry.ts';

const PR = 2; // pixel ratio de las imágenes

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w * PR;
  c.height = h * PR;
  const ctx = c.getContext('2d')!;
  ctx.scale(PR, PR);
  return { c, ctx };
}

function toImage(ctx: CanvasRenderingContext2D, w: number, h: number) {
  return { width: w * PR, height: h * PR, data: new Uint8Array(ctx.getImageData(0, 0, w * PR, h * PR).data.buffer) };
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Autobús visto desde arriba, morro hacia arriba. */
export function busImage(color: string) {
  const { ctx } = canvas(G.w, G.h);
  const { body, glass, rear, roof, nose } = G;
  // sombra
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  rr(ctx, body.x, body.y, body.w, body.h, body.r);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  // doble contorno: oscuro por fuera y blanco por dentro, se ve sobre cualquier color de línea y de mapa
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = 'rgba(8,9,11,0.95)';
  ctx.stroke();
  rr(ctx, body.x + 1.1, body.y + 1.1, body.w - 2.2, body.h - 2.2, body.r - 1);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.stroke();
  // parabrisas (delante), luneta (detrás) y equipos del techo
  rr(ctx, glass.x, glass.y, glass.w, glass.h, glass.r);
  ctx.fillStyle = '#0b0d10';
  ctx.fill();
  rr(ctx, rear.x, rear.y, rear.w, rear.h, rear.r);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  for (const r of roof) {
    rr(ctx, r.x, r.y, r.w, r.h, 1.5);
    ctx.fill();
  }
  // morro: flecha blanca delante del parabrisas (se lee aunque el icono sea pequeño)
  ctx.beginPath();
  ctx.moveTo(nose[0]![0], nose[0]![1]);
  ctx.lineTo(nose[1]![0], nose[1]![1]);
  ctx.lineTo(nose[2]![0], nose[2]![1]);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(8,9,11,0.9)';
  ctx.stroke();
  return toImage(ctx, G.w, G.h);
}

/** Etiqueta de línea (no rota): xip amb el color i el codi. */
export function labelImage(text: string, color: string, textColor: string) {
  const fs = 11;
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = `800 ${fs}px "Inter Variable", Inter, system-ui, sans-serif`;
  const w = Math.ceil(probe.measureText(text).width) + 12;
  const h = 17;
  const { ctx } = canvas(w + 2, h + 2);
  rr(ctx, 1, 1, w, h, 5);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(8,9,11,0.95)';
  ctx.stroke();
  ctx.fillStyle = textColor;
  ctx.font = `800 ${fs}px "Inter Variable", Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 1 + w / 2, 1 + h / 2 + 0.5);
  return toImage(ctx, w + 2, h + 2);
}

function badgeImage(bg: string, glyph: 'clock' | 'detour') {
  const s = 14;
  const { ctx } = canvas(s, s);
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#08090b';
  ctx.stroke();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (glyph === 'clock') {
    ctx.moveTo(7, 3.8);
    ctx.lineTo(7, 7.2);
    ctx.lineTo(9.4, 8.6);
  } else {
    ctx.moveTo(4, 10);
    ctx.lineTo(4, 6.5);
    ctx.quadraticCurveTo(4, 4.2, 6.5, 4.2);
    ctx.lineTo(10, 4.2);
    ctx.moveTo(8.4, 2.6);
    ctx.lineTo(10, 4.2);
    ctx.lineTo(8.4, 5.8);
  }
  ctx.stroke();
  return toImage(ctx, s, s);
}

/** Flecha de sentido (apunta a la derecha: con symbol-placement=line sigue el recorrido). */
function arrowImage(color: string) {
  const w = 14;
  const h = 12;
  const { ctx } = canvas(w, h);
  ctx.beginPath();
  ctx.moveTo(3, 2);
  ctx.lineTo(10.5, 6);
  ctx.lineTo(3, 10);
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(8,9,11,0.9)';
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = color;
  ctx.stroke();
  return toImage(ctx, w, h);
}

export function haloImage(size = 72) {
  const { ctx } = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
  // halo de selecció: blau suau (el mapa base és clar)
  g.addColorStop(0, 'rgba(37,99,235,0.34)');
  g.addColorStop(0.55, 'rgba(37,99,235,0.12)');
  g.addColorStop(1, 'rgba(37,99,235,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  return toImage(ctx, size, size);
}

export function userImage(size = 28) {
  const { ctx } = canvas(size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#2563eb';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  return toImage(ctx, size, size);
}

export function addBusImages(map: MLMap, routes: Route[]) {
  const add = (id: string, img: ReturnType<typeof busImage>) => {
    if (map.hasImage(id)) map.removeImage(id);
    map.addImage(id, img, { pixelRatio: PR });
  };
  for (const r of routes) {
    add(`bus-${r.id}`, busImage(r.color));
    add(`lbl-${r.id}`, labelImage(r.ref, r.color, r.textColor));
  }
  add('arrow', arrowImage('#ffffff'));
  add('bus-off', busImage('#5b616b'));
  add('badge-delay', badgeImage('#ffb224', 'clock'));
  add('badge-detour', badgeImage('#fb923c', 'detour'));
  add('halo', haloImage());
  add('user', userImage());
}
