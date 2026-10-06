/**
 * Geometría del autobús visto desde arriba (morro hacia arriba), en px lógicos.
 * La comparten el icono del mapa (canvas) y el componente SVG de la interfaz,
 * así el bus se ve igual en el mapa, en la ficha y en la línea temporal.
 */
export const BUS_GEOMETRY = {
  w: 26,
  h: 50,
  body: { x: 4, y: 8, w: 18, h: 39, r: 5.5 },
  glass: { x: 6.2, y: 10.6, w: 13.6, h: 6.2, r: 2.6 },
  rear: { x: 7.5, y: 42.6, w: 11, h: 2.4, r: 1.2 },
  roof: [
    { x: 8.5, y: 20.5, w: 9, h: 6 },
    { x: 8.5, y: 30, w: 9, h: 5 },
  ],
  /** flecha del morro (triángulo) */
  nose: [
    [13, 0.8],
    [18.2, 6.8],
    [7.8, 6.8],
  ] as [number, number][],
} as const;
