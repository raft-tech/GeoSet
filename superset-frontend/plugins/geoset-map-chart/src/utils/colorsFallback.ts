// src/utils/colorFallback.ts
import { DEFAULT_SUPERSET_COLOR, RGBAColor } from './colors';

export function hasValidFill(color: RGBAColor): boolean {
  return Array.isArray(color) && color.length >= 3;
}

/**
 * Ensures a color array has exactly 4 elements (RGBA) and fills missing values with fallback.
 */
export function normalizeRGBA(
  color?: number[],
  fallback: RGBAColor = DEFAULT_SUPERSET_COLOR,
): RGBAColor {
  if (!Array.isArray(color)) return [...fallback];
  return [
    color[0] ?? fallback[0],
    color[1] ?? fallback[1],
    color[2] ?? fallback[2],
    color[3] ?? fallback[3],
  ];
}

/**
 * Normalizes any color input into a consistent Hex value:
 * - Missing → returns #000000
 */
export function normalizeColorToHex(
  color:
    | string
    | number[]
    | { r: number; g: number; b: number; a?: number }
    | undefined,
  defaultColor = '#000000',
): string {
  if (typeof color === 'string') return color;
  if (Array.isArray(color)) {
    const [r, g, b] = color;
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }
  if (color && typeof color === 'object') {
    const { r, g, b } = color;
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }
  return defaultColor;
}

/**
 * Converts an RGBA array [r, g, b, a] to a CSS string: "rgba(r,g,b,a)"
 * Assumes alpha in 0–255 range, converts to 0–1 for CSS.
 */
export function rgbaArrayToCssString(color: [number, number, number, number]) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
}

/**
 * Converts an RGBA object to an RGBA array DeckGL can use directly.
 */
export function rgbaObjectToArray({
  r,
  g,
  b,
  a,
}: {
  r: number;
  g: number;
  b: number;
  a?: number;
}): [number, number, number, number] {
  return [r, g, b, Math.round(255 * (a ?? 1))];
}
