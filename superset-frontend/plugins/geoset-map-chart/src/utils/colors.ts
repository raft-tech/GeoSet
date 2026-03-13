/* eslint-disable theme-colors/no-literal-colors */
/* eslint-disable no-plusplus */
/* eslint-disable no-console */
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import {
  CategoricalColorNamespace,
  DataRecord,
  QueryFormData,
} from '@superset-ui/core';
import { rgb } from 'd3-color';
import { GeoJsonFeature } from '../types';
import { normalizeRGBA, hasValidFill } from './colorsFallback';

const { getScale } = CategoricalColorNamespace;

export type RGBAColor = [number, number, number, number];
export const DEFAULT_SUPERSET_COLOR: RGBAColor = [0, 122, 135, 150];

export type CategoryState = {
  color: RGBAColor;
  enabled: boolean;
  legend_name?: string;
};

export type ColorByValueConfig = {
  valueColumn: string;
  lowerBound?: number;
  upperBound?: number;
  startColor: RGBAColor;
  endColor: RGBAColor;
  breakpoints?: number[];
};

/** Raw config from JSON — bounds may be percentage strings like "25%". */
export type ColorByValueConfigRaw = Omit<
  ColorByValueConfig,
  'lowerBound' | 'upperBound' | 'breakpoints'
> & {
  lowerBound?: number | string | null;
  upperBound?: number | string | null;
  breakpoints?: (number | string)[];
};

export type PointSizeConfig = {
  valueColumn: string;
  startSize: number; // pixel size at lowerBound
  endSize: number; // pixel size at upperBound
  lowerBound?: number | null;
  upperBound?: number | null;
};

/** Raw config from JSON — bounds may be percentage strings like "25%". */
export type PointSizeConfigRaw = Omit<
  PointSizeConfig,
  'lowerBound' | 'upperBound'
> & {
  lowerBound?: number | string | null;
  upperBound?: number | string | null;
};

export function computeSizeScale(
  config: PointSizeConfig,
  dataDomain: [number, number],
): (val: number) => number {
  const [min, max] = dataDomain;
  const lower = config.lowerBound ?? min;
  const upper = config.upperBound ?? max;
  const range = upper - lower;
  return (val: number) => {
    if (val == null || Number.isNaN(val) || range === 0)
      return config.startSize;
    const t = Math.max(0, Math.min(1, (val - lower) / range));
    return Math.round(
      config.startSize + t * (config.endSize - config.startSize),
    );
  };
}

export type MetricLegend = {
  min: number;
  max: number;
  startColor: RGBAColor;
  endColor: RGBAColor;
  legendName: string;
  usesPercentBounds?: boolean;
};

// eslint-disable-next-line import/prefer-default-export
/**
 * Converts a hex string (e.g. "#ff8800") to an RGBA array.
 */
export function hexToRGB(
  hex: string | undefined,
  alpha = 255,
): [number, number, number, number] {
  if (!hex) {
    return [0, 0, 0, alpha];
  }
  const { r, g, b } = rgb(hex);
  return [r, g, b, alpha];
}

export const toRGBA = (
  color?: number[],
  fallback: RGBAColor = DEFAULT_SUPERSET_COLOR,
): RGBAColor => {
  if (!Array.isArray(color)) return fallback;
  const out = color.slice(0, 4);
  while (out.length < 4) out.push(255);
  return out as RGBAColor;
};

/**
 * Converts an RGBA array [r, g, b, a] to a hex string #RRGGBBAA
 * Alpha is optional; defaults to FF if missing.
 */
export function rgbaArrayToHex(rgba: number[]): string {
  if (!Array.isArray(rgba) || rgba.length < 3) {
    console.warn('Invalid RGBA array:', rgba);
    return '#000000';
  }

  const r = Math.round(rgba[0]).toString(16).padStart(2, '0');
  const g = Math.round(rgba[1]).toString(16).padStart(2, '0');
  const b = Math.round(rgba[2]).toString(16).padStart(2, '0');
  const a =
    rgba.length === 4
      ? Math.round(rgba[3]).toString(16).padStart(2, '0')
      : 'ff';

  return `#${r}${g}${b}${a}`;
}

/**
 * Convert a CSS rgb/rgba string into an [r,g,b,a] array.
 * We only use this internally after interpolateRgb(),
 * which returns css color strings.
 */
export function cssToRgbaArray(css: string): [number, number, number, number] {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.fillStyle = css;
  const computed = ctx.fillStyle as string; // normalized "rgba(r,g,b,a)"
  const m = computed.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
  if (!m) return [0, 0, 0, 255];

  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const a = m[4] !== undefined ? Math.round(Number(m[4]) * 255) : 255;

  return [r, g, b, a];
}

/**
 * Convert any color input to RGBA array.
 * Accepts hex, CSS rgba(), or RGBA array.
 */
export function normalizeColorInput(input: any): RGBAColor {
  if (Array.isArray(input)) return toRGBA(input);

  if (typeof input === 'string') {
    if (input.startsWith('#'))
      return toRGBA(hexToRGB(input), DEFAULT_SUPERSET_COLOR);
    return toRGBA(cssToRgbaArray(input), DEFAULT_SUPERSET_COLOR);
  }

  return DEFAULT_SUPERSET_COLOR;
}

/**
 * Builds the category color map with enabled state for legends.
 * @param fallbackColor - The fallback color to use when no custom mapping exists.
 *                        For Line/LineString geometries, pass strokeColor instead of fillColor.
 *
 * The order of categories in the returned object is determined by:
 * 1. First, categories from customMapping in their defined order (controls z-order rendering)
 * 2. Then, any additional categories found in features but not in customMapping
 */
export function getCategories(
  fd: QueryFormData,
  dimension: string | undefined,
  fallbackColor: RGBAColor,
  features: GeoJsonFeature[],
  customMapping?: Record<
    string,
    { fillColor?: string | number[]; legend_name?: string }
  >,
  defaultLegendNames: string[] = ['Other'],
): Record<string, CategoryState> {
  const dim = dimension ?? fd.dimension;

  const categories: Record<string, CategoryState> = {};
  if (!dim) return categories;

  // Track index for assigning defaultLegendNames to null categories
  let nullCategoryIndex = 0;

  // Collect all unique category keys from features
  const featureCategoryKeys = new Set<string>();
  const featureCategoryMap = new Map<
    string,
    { rawCategory: any; feature: GeoJsonFeature; isNullCategory: boolean }
  >();

  for (const feature of features) {
    const rawCategory =
      feature.extraProps?.[dim] !== undefined
        ? feature.extraProps[dim]
        : feature.properties?.[dim];

    const isNullCategory =
      rawCategory === null ||
      rawCategory === undefined ||
      String(rawCategory) === '__NULL__' ||
      String(rawCategory).trim().toLowerCase() === '__null__';

    const lookupKey = isNullCategory
      ? '__null__'
      : String(rawCategory).trim().toLowerCase();

    if (!featureCategoryKeys.has(lookupKey)) {
      featureCategoryKeys.add(lookupKey);
      featureCategoryMap.set(lookupKey, {
        rawCategory,
        feature,
        isNullCategory,
      });
    }
  }

  // Helper to add a category to the result
  const addCategory = (lookupKey: string) => {
    if (categories[lookupKey]) return; // Already added

    const featureData = featureCategoryMap.get(lookupKey);
    if (!featureData) return; // Category not found in features

    const { rawCategory, feature, isNullCategory } = featureData;
    const entry = customMapping ? customMapping[lookupKey] : undefined;

    const featureRGBA: RGBAColor =
      (Array.isArray(feature.color) && feature.color.length === 4
        ? toRGBA(feature.color)
        : entry?.fillColor !== undefined
          ? normalizeColorInput(entry.fillColor)
          : fallbackColor) ?? fallbackColor;

    let legendName: string;
    if (typeof entry === 'object' && entry.legend_name) {
      legendName = entry.legend_name;
    } else if (isNullCategory) {
      legendName =
        defaultLegendNames[nullCategoryIndex % defaultLegendNames.length] ||
        'Other';
      nullCategoryIndex++;
    } else {
      legendName = String(rawCategory);
    }

    categories[lookupKey] = {
      color: featureRGBA,
      enabled: true,
      legend_name: legendName,
    };
  };

  // First, add categories in the order they appear in customMapping
  // This determines the z-order: first in mapping = rendered first (bottom)
  if (customMapping) {
    for (const mappingKey of Object.keys(customMapping)) {
      const normalizedKey = mappingKey.trim().toLowerCase();
      if (featureCategoryKeys.has(normalizedKey)) {
        addCategory(normalizedKey);
      }
    }
  }

  // Then, add any remaining categories from features not in customMapping
  for (const lookupKey of featureCategoryKeys) {
    addCategory(lookupKey);
  }

  return categories;
}

/**
 * Normalizes user-provided categorical color mappings.
 * Converts an array of { CategoryName: { fillColor, legend_entry_name } } objects
 * into a flat Record<string, { fillColor?: string; legend_name?: string }>
 */
export function normalizeCategoryColorMapping(
  categoricalColors: Array<
    Record<
      string,
      {
        fillColor?: RGBAColor;
        legend_entry_name?: string;
      }
    >
  >,
): Record<string, { fillColor?: RGBAColor; legend_name?: string }> {
  if (!categoricalColors) return {};

  const mapping: Record<
    string,
    { fillColor?: RGBAColor; legend_name?: string }
  > = {};

  if (Array.isArray(categoricalColors)) {
    categoricalColors.forEach(entry => {
      const [key, val] = Object.entries(entry)[0];
      const normKey = String(key).trim().toLowerCase();

      const fill: RGBAColor | undefined =
        val.fillColor && hasValidFill(val.fillColor)
          ? toRGBA(val.fillColor)
          : undefined;
      const legendName = val.legend_entry_name || key;

      mapping[normKey] = {
        fillColor: fill,
        legend_name: legendName,
      };
    });
    return mapping;
  }

  // Normalize object mapping (already in dictionary form)
  if (typeof categoricalColors === 'object' && categoricalColors !== null) {
    for (const [key, val] of Object.entries<any>(categoricalColors)) {
      const normKey = key.trim().toLowerCase();

      const fill: RGBAColor | undefined = val.fillColor
        ? toRGBA(val.fillColor)
        : undefined;
      const legendName = val.legend_entry_name || key;

      mapping[normKey] = {
        fillColor: fill,
        legend_name: legendName,
      };
    }
  }
  return mapping;
}

export function applyColorMapping(
  features: GeoJsonFeature[],
  dimension: string,
  mapping: Record<string, { fillColor?: RGBAColor; legend_name?: string }>,
  strokeColor: RGBAColor = [0, 0, 0, 255],
  alpha = 150,
  strokeAlpha = 255,
  globalFallback: RGBAColor = [0, 122, 135, 255],
  defaultLegendNames: string[] = ['Other'],
): GeoJsonFeature[] {
  if (!Array.isArray(features) || !features.length) return [];

  // Precompute normalized stroke color once
  const strokeRGBA: RGBAColor = [...strokeColor].slice(0, 4) as RGBAColor;
  strokeRGBA[3] = strokeAlpha;

  // Normalize mapping keys to lowercase
  const normalizedMapping: Record<
    string,
    { fillColor: RGBAColor; legendName: string }
  > = {};
  for (const [key, value] of Object.entries(mapping)) {
    const lowerKey = key.trim().toLowerCase();
    const fill: RGBAColor = value.fillColor
      ? toRGBA(value.fillColor, globalFallback)
      : [...globalFallback];
    normalizedMapping[lowerKey] = {
      fillColor: fill,
      legendName: value.legend_name ?? key,
    };
  }

  // Track unmapped categories to assign consistent legend names per unique category
  const unmappedCategoryLegendNames: Record<string, string> = {};
  let defaultNameIndex = 0;

  return features.map(feature => {
    const key =
      feature.extraProps?.[dimension] || feature.properties?.[dimension];
    const lookupKey = key ? String(key).trim().toLowerCase() : '__null__';
    const category = normalizedMapping[lookupKey];

    // Determine legend name
    let legendName: string;
    let fillRGBA: RGBAColor;

    if (category) {
      const { legendName: catLegendName, fillColor } = category;
      legendName = catLegendName;
      // Ensure fillRGBA is always RGBAColor (length 4)
      fillRGBA = [...fillColor].slice(0, 4) as RGBAColor;
      fillRGBA[3] = alpha;
    } else {
      // Check if we've already assigned a legend name to this unmapped category
      if (unmappedCategoryLegendNames[lookupKey] === undefined) {
        // Assign the next defaultLegendName to this unique unmapped category
        unmappedCategoryLegendNames[lookupKey] =
          defaultLegendNames[defaultNameIndex % defaultLegendNames.length];
        defaultNameIndex++;
      }
      legendName = unmappedCategoryLegendNames[lookupKey];
      fillRGBA = [...globalFallback].slice(0, 4) as RGBAColor;
      fillRGBA[3] = alpha;
    }

    return {
      ...feature,
      color: fillRGBA,
      strokeColor: strokeRGBA,
      properties: {
        ...feature.properties,
        fillColor: fillRGBA,
        strokeColor: strokeRGBA,
        legendName,
      },
    };
  });
}

/**
 * Applies categorical color to features using a precomputed color map.
 */
export function addColor(
  fd: QueryFormData,
  dimension: string,
  fillColor: RGBAColor,
  features: GeoJsonFeature[],
  customMapping?: Record<
    string,
    RGBAColor | { fillColor?: RGBAColor; legend_name?: string }
  >,
): GeoJsonFeature[] {
  const fallback = fillColor || DEFAULT_SUPERSET_COLOR;
  const colorFn = getScale(fd.colorScheme);

  return features.map(feature => {
    let color: RGBAColor = fallback;
    const cat =
      feature.extraProps?.[dimension] || feature.properties?.[dimension];
    if (cat != null) {
      const entry = customMapping?.[cat];
      if (Array.isArray(entry)) {
        color = toRGBA(entry, fallback);
      } else if (entry?.fillColor) {
        color = toRGBA(entry.fillColor, fallback);
      } else {
        // fallback to Superset categorical scale
        const defaultColor = colorFn(cat, fd.sliceId);
        color = Array.isArray(defaultColor)
          ? normalizeRGBA(defaultColor, fallback)
          : fallback;
      }
    }

    return { ...feature, color };
  });
}

/**
 * Returns a color scale function for a metric.
 * Handles both continuous ranges and optional breakpoints.
 */
export function computeMetricColorScaleUnified(
  spec: ColorByValueConfig,
  dataDomain: [number, number],
): (val: number) => RGBAColor {
  const { startColor, endColor, breakpoints, lowerBound, upperBound } = spec;
  const [min, max] = dataDomain;

  const lower = lowerBound ?? min;
  const upper = upperBound ?? max;

  // Helper: interpolate each channel linearly
  const interpolateRGBA = (start: RGBAColor, end: RGBAColor) => (t: number) =>
    start.map((s, i) => Math.round(s + t * (end[i] - s))) as RGBAColor;

  /**
   * Utility: clamp a value to the metric domain.
   */
  const clampToDomain = (v: number) => Math.max(lower, Math.min(v, upper));

  // If breakpoints are provided, create discrete segments
  if (Array.isArray(breakpoints) && breakpoints.length > 0) {
    // Precompute a linear fraction for each breakpoint
    const stops = [lower, ...breakpoints, upper];
    const interp = interpolateRGBA(startColor, endColor);
    const numSegments = stops.length - 1;

    return (val: number) => {
      if (val == null) return [...startColor];
      const clamped = clampToDomain(val);
      for (let i = 0; i < numSegments; i++) {
        if (clamped <= stops[i + 1]) {
          const segRange = stops[i + 1] - stops[i];
          const t = segRange === 0 ? 0 : (clamped - stops[i]) / segRange;
          return interp((i + t) / numSegments);
        }
      }
      return [...endColor];
    };
  }

  // Continuous metric coloring
  const lerp = interpolateRGBA(startColor, endColor);
  const range = upper - lower;
  return (val: number) => {
    if (val == null) return [...startColor];
    // When min === max (single value), avoid NaN from 0/0 division
    if (range === 0) return [...startColor];
    const clamped = clampToDomain(val);
    const t = (clamped - lower) / range;
    return lerp(t);
  };
}

export function getFeatureColor(
  feature: any,
  metricKey: string | undefined,
  metricScale: ((val: number) => number[]) | undefined,
  usingMetric = false,
  usingDimension = false,
  fillColorArray = [0, 122, 135, 150],
  defaultAlpha = 150,
): RGBAColor {
  // METRIC-BASED COLORING
  if (usingMetric && metricKey && metricScale) {
    const val = feature.properties[metricKey];
    // metricScale(val) now returns [r, g, b, a]
    const rgba = metricScale(val) ?? fillColorArray;

    // Ensure 4-length array
    const arr = rgba.slice(0, 4) as RGBAColor;
    if (arr.length < 4) arr.push(defaultAlpha);

    return arr;
  }
  // DIMENSION-BASED COLORING
  if (usingDimension && Array.isArray(feature?.color)) {
    const c = feature.color.slice(0, 4);
    while (c.length < 4) c.push(defaultAlpha);
    return c as RGBAColor;
  }
  // FALLBACK
  // Ensure the returned array has exactly 4 elements
  const arr = (fillColorArray ?? DEFAULT_SUPERSET_COLOR).slice(0, 4);
  while (arr.length < 4) arr.push(defaultAlpha); // Default alpha if missing
  return arr as RGBAColor;
}

/**
 * Check if a value is a percentage string (e.g. "25%").
 */
export function isPercentString(value: unknown): value is string {
  return typeof value === 'string' && /^\d+(\.\d+)?%$/.test(value.trim());
}

/**
 * Compute the p-th percentile of a sorted array using linear interpolation.
 * @param sorted Array of numbers, must be sorted ascending.
 * @param p Percentile as a fraction (0 to 1). E.g. 0.25 for 25th percentile.
 */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  if (p <= 0) return sorted[0];
  if (p >= 1) return sorted[sorted.length - 1];
  const index = p * (sorted.length - 1);
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  const weight = index - lo;
  return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

/**
 * Resolve a bound or breakpoint value. If it's a percentage string like "25%",
 * compute the percentile from sortedValues. If it's a number, return as-is.
 * If null/undefined, return the provided fallback.
 */
export function resolvePercentOrNumber(
  value: number | string | null | undefined,
  sortedValues: number[],
  fallback: number,
): number {
  if (value == null) return fallback;
  if (typeof value === 'number') return value;
  if (isPercentString(value)) {
    const pct = parseFloat(value) / 100;
    return percentile(sortedValues, pct);
  }
  return fallback;
}

export type ResolvedBounds = {
  sortedValues: number[];
  lower: number;
  upper: number;
  usesPercentBounds: boolean;
};

/**
 * Extract numeric values from rawData for a column, sort them, and resolve
 * percentage-or-number bounds. Shared by metric coloring and point sizing.
 */
export function resolveNumericBounds(
  rawData: DataRecord[],
  valueColumn: string,
  lowerBound: number | string | null | undefined,
  upperBound: number | string | null | undefined,
  warnLabel: string,
): ResolvedBounds | null {
  const values = rawData
    .map(d => {
      const value = d[valueColumn];
      return value != null && !Number.isNaN(Number(value))
        ? Number(value)
        : null;
    })
    .filter((v): v is number => v !== null);

  if (values.length === 0) return null;

  const sortedValues = [...values].sort((a, b) => a - b);
  const lower = resolvePercentOrNumber(
    lowerBound,
    sortedValues,
    sortedValues[0],
  );
  const upper = resolvePercentOrNumber(
    upperBound,
    sortedValues,
    sortedValues[sortedValues.length - 1],
  );
  if (lower > upper) {
    console.warn(
      `[GeoSet] Resolved ${warnLabel} lowerBound (%s) is greater than upperBound (%s). Scaling may behave unexpectedly.`,
      lower,
      upper,
    );
  }
  const usesPercentBounds =
    isPercentString(lowerBound) || isPercentString(upperBound);

  return { sortedValues, lower, upper, usesPercentBounds };
}

export function lerpColorCss(c1: RGBAColor, c2: RGBAColor, t: number): string {
  const r = Math.round(c1[0] + t * (c2[0] - c1[0]));
  const g = Math.round(c1[1] + t * (c2[1] - c1[1]));
  const b = Math.round(c1[2] + t * (c2[2] - c1[2]));
  return `rgba(${r},${g},${b},0.8)`;
}

export function lerpColorRgba(
  c1: RGBAColor,
  c2: RGBAColor,
  t: number,
): RGBAColor {
  return [
    Math.round(c1[0] + t * (c2[0] - c1[0])),
    Math.round(c1[1] + t * (c2[1] - c1[1])),
    Math.round(c1[2] + t * (c2[2] - c1[2])),
    204,
  ];
}
