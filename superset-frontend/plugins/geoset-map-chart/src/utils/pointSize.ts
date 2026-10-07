/**
 * Scale dynamically sized points as the map zooms in so small values remain
 * visible. Keep the configured size through zoom 4, then grow by 1 per zoom
 * level up to an 8x cap.
 */
export const getDynamicPointZoomScale = (zoom: number): number => {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(8, 1 + Math.max(0, zoom - 4));
};
