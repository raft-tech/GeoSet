/* eslint-disable dot-notation */
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
import { QueryFormData } from '@superset-ui/core';
import {
  hexToRGB,
  getCategories,
  RGBAColor,
  toRGBA,
  rgbaArrayToHex,
  DEFAULT_SUPERSET_COLOR,
  computeSizeScale,
  PointSizeConfig,
  normalizeCategoryColorMapping,
  applyColorMapping,
  computeMetricColorScaleUnified,
  ColorByValueConfig,
  getFeatureColor,
  isPercentString,
  percentile,
  resolvePercentOrNumber,
  lerpColorCss,
  lerpColorRgba,
  cssToRgbaArray,
  normalizeColorInput,
  addColor,
} from '../../src/utils/colors';
import { GeoJsonFeature } from '../../src/types';

// ---------------------------------------------------------------------------
// hexToRGB
// ---------------------------------------------------------------------------
describe('hexToRGB', () => {
  it('converts white hex to RGBA', () => {
    expect(hexToRGB('#ffffff')).toEqual([255, 255, 255, 255]);
  });

  it('converts black hex to RGBA', () => {
    expect(hexToRGB('#000000')).toEqual([0, 0, 0, 255]);
  });

  it('converts a color hex with custom alpha', () => {
    expect(hexToRGB('#ff8800', 128)).toEqual([255, 136, 0, 128]);
  });

  it('returns [0,0,0,alpha] for undefined input', () => {
    expect(hexToRGB(undefined)).toEqual([0, 0, 0, 255]);
    expect(hexToRGB(undefined, 100)).toEqual([0, 0, 0, 100]);
  });

  it('returns [0,0,0,alpha] for empty string', () => {
    expect(hexToRGB('')).toEqual([0, 0, 0, 255]);
  });
});

// ---------------------------------------------------------------------------
// toRGBA
// ---------------------------------------------------------------------------
describe('toRGBA', () => {
  it('returns fallback when input is not an array', () => {
    expect(toRGBA(undefined)).toEqual(DEFAULT_SUPERSET_COLOR);
    expect(toRGBA(null as any)).toEqual(DEFAULT_SUPERSET_COLOR);
    expect(toRGBA('string' as any)).toEqual(DEFAULT_SUPERSET_COLOR);
  });

  it('pads short arrays to 4 elements with 255', () => {
    expect(toRGBA([10, 20, 30])).toEqual([10, 20, 30, 255]);
    expect(toRGBA([10, 20])).toEqual([10, 20, 255, 255]);
  });

  it('truncates arrays longer than 4', () => {
    expect(toRGBA([10, 20, 30, 40, 50])).toEqual([10, 20, 30, 40]);
  });

  it('passes through a valid 4-element array', () => {
    expect(toRGBA([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });

  it('uses custom fallback', () => {
    const fb: RGBAColor = [99, 99, 99, 99];
    expect(toRGBA(undefined, fb)).toEqual(fb);
  });
});

// ---------------------------------------------------------------------------
// rgbaArrayToHex
// ---------------------------------------------------------------------------
describe('rgbaArrayToHex', () => {
  it('converts RGBA to hex with alpha', () => {
    expect(rgbaArrayToHex([255, 255, 255, 255])).toBe('#ffffffff');
  });

  it('converts RGBA to hex with low alpha', () => {
    expect(rgbaArrayToHex([0, 0, 0, 0])).toBe('#00000000');
  });

  it('converts RGB (no alpha) to hex with ff suffix', () => {
    expect(rgbaArrayToHex([255, 128, 0])).toBe('#ff8000ff');
  });

  it('returns #000000 for invalid input', () => {
    expect(rgbaArrayToHex(null as any)).toBe('#000000');
    expect(rgbaArrayToHex([] as any)).toBe('#000000');
    expect(rgbaArrayToHex([1] as any)).toBe('#000000');
  });
});

// ---------------------------------------------------------------------------
// computeSizeScale
// ---------------------------------------------------------------------------
describe('computeSizeScale', () => {
  const config: PointSizeConfig = {
    valueColumn: 'pop',
    startSize: 5,
    endSize: 50,
    lowerBound: 0,
    upperBound: 100,
  };

  it('returns startSize at lowerBound', () => {
    const scale = computeSizeScale(config, [0, 100]);
    expect(scale(0)).toBe(5);
  });

  it('returns endSize at upperBound', () => {
    const scale = computeSizeScale(config, [0, 100]);
    expect(scale(100)).toBe(50);
  });

  it('returns midpoint size at midpoint value', () => {
    const scale = computeSizeScale(config, [0, 100]);
    // Linear interpolation: 5 + 0.5 * (50 - 5) = 27.5
    // The implementation rounds to the nearest integer.
    const mid = scale(50);
    expect(mid).toBeGreaterThanOrEqual(27);
    expect(mid).toBeLessThanOrEqual(28);
  });

  it('clamps below lowerBound', () => {
    const scale = computeSizeScale(config, [0, 100]);
    expect(scale(-50)).toBe(5);
  });

  it('clamps above upperBound', () => {
    const scale = computeSizeScale(config, [0, 100]);
    expect(scale(200)).toBe(50);
  });

  it('returns startSize when range is 0', () => {
    const scale = computeSizeScale(
      { ...config, lowerBound: 50, upperBound: 50 },
      [50, 50],
    );
    expect(scale(50)).toBe(5);
  });

  it('returns startSize for null value', () => {
    const scale = computeSizeScale(config, [0, 100]);
    expect(scale(null as any)).toBe(5);
  });

  it('falls back to dataDomain when bounds are null', () => {
    const noBoundsConfig: PointSizeConfig = {
      valueColumn: 'pop',
      startSize: 10,
      endSize: 40,
      lowerBound: null,
      upperBound: null,
    };
    const scale = computeSizeScale(noBoundsConfig, [20, 80]);
    expect(scale(20)).toBe(10);
    expect(scale(80)).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// normalizeCategoryColorMapping
// ---------------------------------------------------------------------------
describe('normalizeCategoryColorMapping', () => {
  it('normalizes array of entries to flat mapping', () => {
    const input: Array<
      Record<string, { fillColor?: RGBAColor; legend_entry_name?: string }>
    > = [
      {
        Apple: {
          fillColor: [255, 0, 0, 255],
          legend_entry_name: 'Red Apple',
        },
      },
      { Banana: { fillColor: [255, 255, 0, 255] } },
    ];
    const result = normalizeCategoryColorMapping(input);

    expect(result['apple']).toBeDefined();
    expect(result['apple'].legend_name).toBe('Red Apple');
    expect(result['apple'].fillColor).toEqual([255, 0, 0, 255]);

    expect(result['banana']).toBeDefined();
    expect(result['banana'].legend_name).toBe('Banana');
  });

  it('returns empty object for null/undefined input', () => {
    expect(normalizeCategoryColorMapping(null as any)).toEqual({});
    expect(normalizeCategoryColorMapping(undefined as any)).toEqual({});
  });

  it('normalizes keys to lowercase', () => {
    const input = [{ 'UPPER CASE': { fillColor: [1, 2, 3, 4] as RGBAColor } }];
    const result = normalizeCategoryColorMapping(input);
    expect(result['upper case']).toBeDefined();
  });

  it('omits fillColor when not valid', () => {
    const input = [{ item: { fillColor: [] as any } }];
    const result = normalizeCategoryColorMapping(input);
    expect(result['item'].fillColor).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// applyColorMapping
// ---------------------------------------------------------------------------
describe('applyColorMapping', () => {
  const createFeature = (category: string | null): GeoJsonFeature => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: { kind: category },
  });

  const mapping = {
    apple: { fillColor: [255, 0, 0, 255] as RGBAColor, legend_name: 'Apple' },
    mango: { fillColor: [0, 255, 0, 255] as RGBAColor, legend_name: 'Mango' },
  };

  it('applies mapped fill colors to features', () => {
    const features = [createFeature('apple'), createFeature('mango')];
    const result = applyColorMapping(features, 'kind', mapping);

    expect(result[0].color![0]).toBe(255); // red channel
    expect(result[0].properties.legendName).toBe('Apple');
    expect(result[1].color![1]).toBe(255); // green channel
    expect(result[1].properties.legendName).toBe('Mango');
  });

  it('applies global fallback to unmapped categories', () => {
    const features = [createFeature('unknown')];
    const fallback: RGBAColor = [50, 50, 50, 255];
    const result = applyColorMapping(
      features,
      'kind',
      mapping,
      [0, 0, 0, 255],
      150,
      255,
      fallback,
    );

    expect(result[0].color![0]).toBe(50);
    expect(result[0].properties.legendName).toBe('Other');
  });

  it('returns empty array for empty features', () => {
    expect(applyColorMapping([], 'kind', mapping)).toEqual([]);
    expect(applyColorMapping(null as any, 'kind', mapping)).toEqual([]);
  });

  it('applies alpha override to fill colors', () => {
    const features = [createFeature('apple')];
    const result = applyColorMapping(features, 'kind', mapping, undefined, 200);

    expect(result[0].color![3]).toBe(200);
  });

  it('uses defaultLegendNames for unmapped null categories', () => {
    const features = [createFeature(null)];
    const result = applyColorMapping(
      features,
      'kind',
      {},
      undefined,
      150,
      255,
      undefined,
      ['No Category'],
    );

    expect(result[0].properties.legendName).toBe('No Category');
  });

  it('applies stroke color and alpha', () => {
    const features = [createFeature('apple')];
    const stroke: RGBAColor = [10, 20, 30, 255];
    const result = applyColorMapping(
      features,
      'kind',
      mapping,
      stroke,
      150,
      128,
    );

    expect(result[0].properties.strokeColor).toEqual([10, 20, 30, 128]);
  });
});

// ---------------------------------------------------------------------------
// computeMetricColorScaleUnified
// ---------------------------------------------------------------------------
describe('computeMetricColorScaleUnified', () => {
  const start: RGBAColor = [0, 0, 0, 255];
  const end: RGBAColor = [255, 255, 255, 255];

  const spec: ColorByValueConfig = {
    valueColumn: 'metric',
    startColor: start,
    endColor: end,
  };

  it('returns startColor at min', () => {
    const scale = computeMetricColorScaleUnified(spec, [0, 100]);
    expect(scale(0)).toEqual([0, 0, 0, 255]);
  });

  it('returns endColor at max', () => {
    const scale = computeMetricColorScaleUnified(spec, [0, 100]);
    expect(scale(100)).toEqual([255, 255, 255, 255]);
  });

  it('interpolates at midpoint', () => {
    const scale = computeMetricColorScaleUnified(spec, [0, 100]);
    const mid = scale(50);
    expect(mid[0]).toBe(128); // ~half of 255
  });

  it('clamps values below min', () => {
    const scale = computeMetricColorScaleUnified(spec, [0, 100]);
    expect(scale(-50)).toEqual([0, 0, 0, 255]);
  });

  it('clamps values above max', () => {
    const scale = computeMetricColorScaleUnified(spec, [0, 100]);
    expect(scale(200)).toEqual([255, 255, 255, 255]);
  });

  it('returns startColor for null value', () => {
    const scale = computeMetricColorScaleUnified(spec, [0, 100]);
    expect(scale(null as any)).toEqual([0, 0, 0, 255]);
  });

  it('returns startColor when domain range is 0', () => {
    const scale = computeMetricColorScaleUnified(spec, [50, 50]);
    expect(scale(50)).toEqual([0, 0, 0, 255]);
  });

  it('uses explicit bounds when provided', () => {
    const bounded: ColorByValueConfig = {
      ...spec,
      lowerBound: 10,
      upperBound: 90,
    };
    const scale = computeMetricColorScaleUnified(bounded, [0, 100]);
    // value 10 should be at start
    expect(scale(10)).toEqual([0, 0, 0, 255]);
    // value 90 should be at end
    expect(scale(90)).toEqual([255, 255, 255, 255]);
  });

  describe('with breakpoints', () => {
    it('creates discrete color segments', () => {
      const withBreakpoints: ColorByValueConfig = {
        ...spec,
        breakpoints: [50],
      };
      const scale = computeMetricColorScaleUnified(withBreakpoints, [0, 100]);

      // Values at boundaries should produce defined colors
      const atStart = scale(0);
      const atEnd = scale(100);
      expect(atStart[0]).toBeLessThan(atEnd[0]);
    });

    it('returns startColor for null with breakpoints', () => {
      const withBreakpoints: ColorByValueConfig = {
        ...spec,
        breakpoints: [25, 50, 75],
      };
      const scale = computeMetricColorScaleUnified(withBreakpoints, [0, 100]);
      expect(scale(null as any)).toEqual([0, 0, 0, 255]);
    });
  });
});

// ---------------------------------------------------------------------------
// getFeatureColor
// ---------------------------------------------------------------------------
describe('getFeatureColor', () => {
  it('returns metric-based color when usingMetric', () => {
    const feature = { properties: { metric: 50 } };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const metricScale = (_val: number) => [100, 150, 200, 255];
    const result = getFeatureColor(feature, 'metric', metricScale, true);

    expect(result).toEqual([100, 150, 200, 255]);
  });

  it('returns dimension-based color when usingDimension', () => {
    const feature = { color: [10, 20, 30, 40] };
    const result = getFeatureColor(feature, undefined, undefined, false, true);

    expect(result).toEqual([10, 20, 30, 40]);
  });

  it('pads dimension color to 4 elements', () => {
    const feature = { color: [10, 20, 30] };
    const result = getFeatureColor(
      feature,
      undefined,
      undefined,
      false,
      true,
      [0, 0, 0, 150],
      150,
    );

    expect(result).toEqual([10, 20, 30, 150]);
  });

  it('returns fallback fill color when neither metric nor dimension', () => {
    const feature = { properties: {} };
    const fill = [50, 60, 70, 80];
    const result = getFeatureColor(
      feature,
      undefined,
      undefined,
      false,
      false,
      fill,
    );

    expect(result).toEqual([50, 60, 70, 80]);
  });

  it('returns DEFAULT_SUPERSET_COLOR when fillColorArray is null', () => {
    const feature = { properties: {} };
    const result = getFeatureColor(
      feature,
      undefined,
      undefined,
      false,
      false,
      null as any,
    );

    expect(result).toEqual([...DEFAULT_SUPERSET_COLOR]);
  });

  it('pads fallback color to 4 elements', () => {
    const feature = { properties: {} };
    const result = getFeatureColor(
      feature,
      undefined,
      undefined,
      false,
      false,
      [10, 20, 30],
      200,
    );

    expect(result).toEqual([10, 20, 30, 200]);
  });

  it('uses metricScale fallback when val is undefined', () => {
    const feature = { properties: {} };
    const fill = [99, 88, 77, 66];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const metricScale = (_val: number) => null as any;
    const result = getFeatureColor(
      feature,
      'metric',
      metricScale,
      true,
      false,
      fill,
    );

    expect(result).toEqual([99, 88, 77, 66]);
  });
});

// ---------------------------------------------------------------------------
// isPercentString
// ---------------------------------------------------------------------------
describe('isPercentString', () => {
  it('returns true for valid percent strings', () => {
    expect(isPercentString('25%')).toBe(true);
    expect(isPercentString('0%')).toBe(true);
    expect(isPercentString('100%')).toBe(true);
    expect(isPercentString('33.5%')).toBe(true);
    expect(isPercentString(' 50% ')).toBe(true); // trimmed
  });

  it('returns false for non-percent strings', () => {
    expect(isPercentString('25')).toBe(false);
    expect(isPercentString('abc%')).toBe(false);
    expect(isPercentString('%50')).toBe(false);
    expect(isPercentString('')).toBe(false);
  });

  it('returns false for non-string types', () => {
    expect(isPercentString(25)).toBe(false);
    expect(isPercentString(null)).toBe(false);
    expect(isPercentString(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// percentile
// ---------------------------------------------------------------------------
describe('percentile', () => {
  it('returns 0 for empty array', () => {
    expect(percentile([], 0.5)).toBe(0);
  });

  it('returns single element for single-element array', () => {
    expect(percentile([42], 0.5)).toBe(42);
  });

  it('returns first element at p=0', () => {
    expect(percentile([10, 20, 30, 40], 0)).toBe(10);
  });

  it('returns last element at p=1', () => {
    expect(percentile([10, 20, 30, 40], 1)).toBe(40);
  });

  it('interpolates at p=0.5', () => {
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
  });

  it('clamps negative p to first element', () => {
    expect(percentile([10, 20, 30], -0.5)).toBe(10);
  });

  it('clamps p > 1 to last element', () => {
    expect(percentile([10, 20, 30], 1.5)).toBe(30);
  });

  it('handles p=0.25', () => {
    // [10,20,30,40] → index=0.75 → lo=0, hi=1, weight=0.75
    // 10*(0.25) + 20*(0.75) = 2.5 + 15 = 17.5
    expect(percentile([10, 20, 30, 40], 0.25)).toBe(17.5);
  });
});

// ---------------------------------------------------------------------------
// resolvePercentOrNumber
// ---------------------------------------------------------------------------
describe('resolvePercentOrNumber', () => {
  const sorted = [10, 20, 30, 40, 50];

  it('returns the number directly if a number is provided', () => {
    expect(resolvePercentOrNumber(25, sorted, 0)).toBe(25);
  });

  it('returns fallback for null', () => {
    expect(resolvePercentOrNumber(null, sorted, 99)).toBe(99);
  });

  it('returns fallback for undefined', () => {
    expect(resolvePercentOrNumber(undefined, sorted, 99)).toBe(99);
  });

  it('resolves a percent string to a percentile value', () => {
    // 50% of [10,20,30,40,50] → percentile at 0.5 → 30
    expect(resolvePercentOrNumber('50%', sorted, 0)).toBe(30);
  });

  it('returns fallback for non-percent string', () => {
    expect(resolvePercentOrNumber('abc', sorted, 42)).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// lerpColorCss
// ---------------------------------------------------------------------------
describe('lerpColorCss', () => {
  const c1: RGBAColor = [0, 0, 0, 255];
  const c2: RGBAColor = [255, 255, 255, 255];

  it('returns start color CSS at t=0', () => {
    expect(lerpColorCss(c1, c2, 0)).toBe('rgba(0,0,0,0.8)');
  });

  it('returns end color CSS at t=1', () => {
    expect(lerpColorCss(c1, c2, 1)).toBe('rgba(255,255,255,0.8)');
  });

  it('returns midpoint CSS at t=0.5', () => {
    expect(lerpColorCss(c1, c2, 0.5)).toBe('rgba(128,128,128,0.8)');
  });
});

// ---------------------------------------------------------------------------
// lerpColorRgba
// ---------------------------------------------------------------------------
describe('lerpColorRgba', () => {
  const c1: RGBAColor = [0, 0, 0, 255];
  const c2: RGBAColor = [200, 100, 50, 255];

  it('returns start color at t=0 with fixed alpha 204', () => {
    expect(lerpColorRgba(c1, c2, 0)).toEqual([0, 0, 0, 204]);
  });

  it('returns end color at t=1 with fixed alpha 204', () => {
    expect(lerpColorRgba(c1, c2, 1)).toEqual([200, 100, 50, 204]);
  });

  it('interpolates at t=0.5', () => {
    const result = lerpColorRgba(c1, c2, 0.5);
    expect(result).toEqual([100, 50, 25, 204]);
  });
});

// ---------------------------------------------------------------------------
// getCategories
// ---------------------------------------------------------------------------
describe('getCategories', () => {
  const mockFormData = {
    datasource: '1__table',
    viz_type: 'geoset_layer',
    dimension: 'category',
  } as unknown as QueryFormData;

  const fallbackColor: RGBAColor = [100, 100, 100, 255];

  const createFeature = (category: string | null): GeoJsonFeature => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: { category },
    color: [255, 0, 0, 255],
  });

  it('should return categories in customMapping order', () => {
    const features: GeoJsonFeature[] = [
      createFeature('zebra'),
      createFeature('apple'),
      createFeature('mango'),
    ];

    const customMapping = {
      apple: { fillColor: '#ff0000', legend_name: 'Apple' },
      mango: { fillColor: '#00ff00', legend_name: 'Mango' },
      zebra: { fillColor: '#0000ff', legend_name: 'Zebra' },
    };

    const result = getCategories(
      mockFormData,
      'category',
      fallbackColor,
      features,
      customMapping,
    );

    const keys = Object.keys(result);
    expect(keys).toEqual(['apple', 'mango', 'zebra']);
  });

  it('should place categories not in customMapping at the end', () => {
    const features: GeoJsonFeature[] = [
      createFeature('zebra'),
      createFeature('apple'),
      createFeature('unknown'),
      createFeature('mango'),
    ];

    const customMapping = {
      apple: { fillColor: '#ff0000', legend_name: 'Apple' },
      mango: { fillColor: '#00ff00', legend_name: 'Mango' },
    };

    const result = getCategories(
      mockFormData,
      'category',
      fallbackColor,
      features,
      customMapping,
    );

    const keys = Object.keys(result);
    expect(keys.slice(0, 2)).toEqual(['apple', 'mango']);
    expect(keys.slice(2)).toContain('zebra');
    expect(keys.slice(2)).toContain('unknown');
  });

  it('should handle case-insensitive category matching', () => {
    const features: GeoJsonFeature[] = [
      createFeature('APPLE'),
      createFeature('Mango'),
      createFeature('zebra'),
    ];

    const customMapping = {
      apple: { fillColor: '#ff0000', legend_name: 'Apple' },
      MANGO: { fillColor: '#00ff00', legend_name: 'Mango' },
      Zebra: { fillColor: '#0000ff', legend_name: 'Zebra' },
    };

    const result = getCategories(
      mockFormData,
      'category',
      fallbackColor,
      features,
      customMapping,
    );

    const keys = Object.keys(result);
    expect(keys).toEqual(['apple', 'mango', 'zebra']);
  });

  it('should handle null categories with defaultLegendNames', () => {
    const features: GeoJsonFeature[] = [
      createFeature('apple'),
      createFeature(null),
    ];

    const customMapping = {
      apple: { fillColor: '#ff0000', legend_name: 'Apple' },
    };

    const result = getCategories(
      mockFormData,
      'category',
      fallbackColor,
      features,
      customMapping,
      ['Unknown Category'],
    );

    expect(result['__null__']).toBeDefined();
    expect(result['__null__'].legend_name).toBe('Unknown Category');
  });

  it('should return empty object when dimension is undefined', () => {
    const features: GeoJsonFeature[] = [createFeature('apple')];

    const result = getCategories(
      { ...mockFormData, dimension: undefined } as unknown as QueryFormData,
      undefined,
      fallbackColor,
      features,
    );

    expect(result).toEqual({});
  });

  it('should handle features with extraProps dimension values', () => {
    const featureWithExtraProps: GeoJsonFeature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { category: 'fromProperties' },
      extraProps: { category: 'fromExtraProps' },
      color: [255, 0, 0, 255],
    };

    const features: GeoJsonFeature[] = [featureWithExtraProps];

    const customMapping = {
      fromextraprops: { fillColor: '#ff0000', legend_name: 'Extra Props' },
    };

    const result = getCategories(
      mockFormData,
      'category',
      fallbackColor,
      features,
      customMapping,
    );

    expect(Object.keys(result)).toContain('fromextraprops');
    expect(Object.keys(result)).not.toContain('fromproperties');
  });

  it('should deduplicate categories from multiple features', () => {
    const features: GeoJsonFeature[] = [
      createFeature('apple'),
      createFeature('apple'),
      createFeature('mango'),
      createFeature('apple'),
    ];

    const customMapping = {
      mango: { fillColor: '#00ff00', legend_name: 'Mango' },
      apple: { fillColor: '#ff0000', legend_name: 'Apple' },
    };

    const result = getCategories(
      mockFormData,
      'category',
      fallbackColor,
      features,
      customMapping,
    );

    const keys = Object.keys(result);
    expect(keys).toEqual(['mango', 'apple']);
    expect(keys.length).toBe(2);
  });

  it('should skip customMapping entries not present in features', () => {
    const features: GeoJsonFeature[] = [createFeature('apple')];

    const customMapping = {
      apple: { fillColor: '#ff0000', legend_name: 'Apple' },
      mango: { fillColor: '#00ff00', legend_name: 'Mango' },
      zebra: { fillColor: '#0000ff', legend_name: 'Zebra' },
    };

    const result = getCategories(
      mockFormData,
      'category',
      fallbackColor,
      features,
      customMapping,
    );

    const keys = Object.keys(result);
    expect(keys).toEqual(['apple']);
    expect(keys).not.toContain('mango');
    expect(keys).not.toContain('zebra');
  });

  it('should work without customMapping', () => {
    const features: GeoJsonFeature[] = [
      createFeature('zebra'),
      createFeature('apple'),
      createFeature('mango'),
    ];

    const result = getCategories(
      mockFormData,
      'category',
      fallbackColor,
      features,
      undefined,
    );

    const keys = Object.keys(result);
    expect(keys.length).toBe(3);
    expect(keys).toContain('apple');
    expect(keys).toContain('mango');
    expect(keys).toContain('zebra');
  });
});

// ---------------------------------------------------------------------------
// cssToRgbaArray
// ---------------------------------------------------------------------------
/*
 * These tests mock the canvas 2D context because jsdom does not implement
 * the Canvas API.  The mocks simulate how a real browser canvas normalises
 * CSS colour strings into `rgb()` / `rgba()` format via `fillStyle`, so we
 * can verify the parsing logic in isolation from actual browser behaviour.
 */
describe('cssToRgbaArray', () => {
  it('returns [0,0,0,255] when canvas context returns unparseable style', () => {
    // jsdom canvas getContext returns null, so we mock it
    const mockCtx = { fillStyle: '' };
    jest
      .spyOn(document, 'createElement')
      .mockReturnValueOnce({ getContext: () => mockCtx } as any);
    mockCtx.fillStyle = 'not-a-color';
    const result = cssToRgbaArray('red');
    expect(result).toEqual([0, 0, 0, 255]);
  });

  it('parses rgba string when canvas normalizes it', () => {
    const mockCtx = { fillStyle: '' };
    jest
      .spyOn(document, 'createElement')
      .mockReturnValueOnce({ getContext: () => mockCtx } as any);
    // Simulate what a real canvas does: normalize to rgba()
    Object.defineProperty(mockCtx, 'fillStyle', {
      get: () => 'rgba(255, 0, 128, 0.5)',
      set: () => {},
    });
    const result = cssToRgbaArray('rgba(255,0,128,0.5)');
    expect(result).toEqual([255, 0, 128, 128]);
  });

  it('parses rgb string (no alpha)', () => {
    const mockCtx = { fillStyle: '' };
    jest
      .spyOn(document, 'createElement')
      .mockReturnValueOnce({ getContext: () => mockCtx } as any);
    Object.defineProperty(mockCtx, 'fillStyle', {
      get: () => 'rgb(100, 200, 50)',
      set: () => {},
    });
    const result = cssToRgbaArray('rgb(100,200,50)');
    expect(result).toEqual([100, 200, 50, 255]);
  });
});

// ---------------------------------------------------------------------------
// normalizeColorInput
// ---------------------------------------------------------------------------
describe('normalizeColorInput', () => {
  it('normalizes an array input via toRGBA', () => {
    expect(normalizeColorInput([255, 0, 128])).toEqual([255, 0, 128, 255]);
    expect(normalizeColorInput([10, 20, 30, 100])).toEqual([10, 20, 30, 100]);
  });

  it('normalizes a hex string', () => {
    const result = normalizeColorInput('#ff0000');
    expect(result).toEqual([255, 0, 0, 255]);
  });

  it('returns DEFAULT_SUPERSET_COLOR for non-string, non-array input', () => {
    expect(normalizeColorInput(null)).toEqual(DEFAULT_SUPERSET_COLOR);
    expect(normalizeColorInput(undefined)).toEqual(DEFAULT_SUPERSET_COLOR);
    expect(normalizeColorInput(42)).toEqual(DEFAULT_SUPERSET_COLOR);
    expect(normalizeColorInput({})).toEqual(DEFAULT_SUPERSET_COLOR);
  });
});

// ---------------------------------------------------------------------------
// normalizeCategoryColorMapping — object branch (lines 330-345)
// ---------------------------------------------------------------------------
describe('normalizeCategoryColorMapping (object input)', () => {
  it('normalizes an object mapping with fillColor and legend_entry_name', () => {
    const input = {
      Apple: { fillColor: [255, 0, 0, 255] as RGBAColor, legend_entry_name: 'Red Apple' },
      Banana: { fillColor: [255, 255, 0, 255] as RGBAColor },
    };
    const result = normalizeCategoryColorMapping(input as any);
    expect(result.apple).toBeDefined();
    expect(result.apple.fillColor).toEqual([255, 0, 0, 255]);
    expect(result.apple.legend_name).toBe('Red Apple');
    expect(result.banana.legend_name).toBe('Banana');
  });

  it('handles entries without fillColor', () => {
    const input = { grape: { legend_entry_name: 'Grape' } };
    const result = normalizeCategoryColorMapping(input as any);
    expect(result.grape.fillColor).toBeUndefined();
    expect(result.grape.legend_name).toBe('Grape');
  });
});

// ---------------------------------------------------------------------------
// addColor
// ---------------------------------------------------------------------------
describe('addColor', () => {
  const mockFd = {
    datasource: '1__table',
    viz_type: 'geoset_layer',
    colorScheme: 'supersetColors',
  } as unknown as import('@superset-ui/core').QueryFormData;

  const fillColor: RGBAColor = [100, 200, 50, 200];

  const makeFeature = (
    cat: string | null,
    extraCat?: string,
  ): GeoJsonFeature => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: { category: cat },
    color: [0, 0, 0, 255],
    ...(extraCat ? { extraProps: { category: extraCat } } : {}),
  });

  it('applies custom mapping array color', () => {
    const features = [makeFeature('apple')];
    const mapping = { apple: [255, 0, 0, 255] as RGBAColor };
    const result = addColor(mockFd, 'category', fillColor, features, mapping);
    expect(result[0].color).toEqual([255, 0, 0, 255]);
  });

  it('applies custom mapping object with fillColor', () => {
    const features = [makeFeature('apple')];
    const mapping = { apple: { fillColor: [0, 255, 0, 200] as RGBAColor } };
    const result = addColor(mockFd, 'category', fillColor, features, mapping);
    expect(result[0].color).toEqual([0, 255, 0, 200]);
  });

  it('uses fillColor fallback when no mapping match', () => {
    const features = [makeFeature('unknown')];
    const result = addColor(mockFd, 'category', fillColor, features, {});
    // Falls back to superset categorical scale or fillColor
    expect(result[0].color).toBeDefined();
    expect(result[0].color!.length).toBe(4);
  });

  it('uses fillColor fallback when category is null', () => {
    const features = [makeFeature(null)];
    const result = addColor(mockFd, 'category', fillColor, features, {});
    expect(result[0].color).toEqual(fillColor);
  });

  it('prefers extraProps over properties for dimension lookup', () => {
    const features = [makeFeature('fromProps', 'fromExtra')];
    const mapping = {
      fromExtra: [10, 20, 30, 255] as RGBAColor,
      fromProps: [40, 50, 60, 255] as RGBAColor,
    };
    const result = addColor(mockFd, 'category', fillColor, features, mapping);
    expect(result[0].color).toEqual([10, 20, 30, 255]);
  });
});

// ---------------------------------------------------------------------------
// computeMetricColorScaleUnified — breakpoint fallthrough (line 506)
// ---------------------------------------------------------------------------
describe('computeMetricColorScaleUnified (breakpoint edge cases)', () => {
  const startColor: RGBAColor = [0, 0, 0, 255];
  const endColor: RGBAColor = [200, 200, 200, 255];

  it('returns endColor when value exceeds all breakpoint stops', () => {
    const spec: ColorByValueConfig = {
      valueColumn: 'val',
      startColor,
      endColor,
      breakpoints: [25, 50, 75],
      lowerBound: 0,
      upperBound: 100,
    };
    const scale = computeMetricColorScaleUnified(spec, [0, 100]);
    // Value at upper bound should use the last segment
    const result = scale(100);
    // Each channel should be close to endColor (interpolated at t=1 of last segment)
    expect(result[0]).toBeGreaterThan(150);
  });

  it('handles breakpoint with zero-width segment', () => {
    const spec: ColorByValueConfig = {
      valueColumn: 'val',
      startColor,
      endColor,
      breakpoints: [50, 50], // duplicate breakpoint creates zero-width segment
      lowerBound: 0,
      upperBound: 100,
    };
    const scale = computeMetricColorScaleUnified(spec, [0, 100]);
    // Should not crash on zero division
    expect(scale(50)).toBeDefined();
    expect(scale(50).length).toBe(4);
  });
});
