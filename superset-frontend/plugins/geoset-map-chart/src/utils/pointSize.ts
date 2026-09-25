/**
 * Scale dynamically sized points as the map zooms in so small values remain
 * visible. The multiplier grows gradually above zoom 8 and is capped to keep
 * large points from overwhelming the map.
 */
export const getDynamicPointZoomScale = (zoom: number): number => {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(3.5, 1.175 ** Math.max(0, zoom - 8));
};
