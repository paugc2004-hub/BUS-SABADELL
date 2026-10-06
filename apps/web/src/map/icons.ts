/**
 * Iconos de bus dibujados en canvas (no dependen de las fuentes del mapa base,
 * así funcionan también sin conexión).
 *  - drop-<línea>: gota con el color de la línea; la punta indica el sentido (rota con el rumbo)
 *  - lbl-<línea>: código de línea, siempre derecho
 */
import type { Map as MLMap } from 'maplibre-gl';
import type { Route } from '@bus/core';

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

export function dropImage(color: string, size = 34) {
  const { ctx } = canvas(size, size);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.33;
  // sombra suave
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  // gota apuntando hacia arriba (norte); MapLibre la rota con el rumbo
  ctx.moveTo(cx, cy - r - size * 0.17);
  ctx.quadraticCurveTo(cx + r * 0.9, cy - r * 0.9, cx + r, cy);
  ctx.arc(cx, cy, r, 0, Math.PI, false);
  ctx.quadraticCurveTo(cx - r * 0.9, cy - r * 0.9, cx, cy - r - size * 0.17);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(8,9,11,0.95)';
  ctx.stroke();
  return toImage(ctx, size, size);
}

export function labelImage(text: string, textColor: string, size = 34) {
  const { ctx } = canvas(size, size);
  ctx.fillStyle = textColor;
  const fs = text.length >= 3 ? 9.5 : 11;
  ctx.font = `700 ${fs}px "Inter Variable", Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2 + 0.5);
  return toImage(ctx, size, size);
}

export function haloImage(size = 64) {
  const { ctx } = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.35)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
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
  ctx.fillStyle = '#4da3ff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  return toImage(ctx, size, size);
}

export function addBusImages(map: MLMap, routes: Route[]) {
  const add = (id: string, img: ReturnType<typeof dropImage>) => {
    if (map.hasImage(id)) map.removeImage(id);
    map.addImage(id, img, { pixelRatio: PR });
  };
  for (const r of routes) {
    add(`drop-${r.id}`, dropImage(r.color));
    add(`lbl-${r.id}`, labelImage(r.ref, r.textColor));
  }
  add('halo', haloImage());
  add('user', userImage());
}
