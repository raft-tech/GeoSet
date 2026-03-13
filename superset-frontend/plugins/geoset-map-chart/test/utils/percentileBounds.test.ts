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

// Mock @superset-ui/core to avoid d3-time ESM transform issues in Jest
jest.mock('@superset-ui/core', () => ({
  CategoricalColorNamespace: { getScale: jest.fn(() => jest.fn()) },
}));

import {
  isPercentString,
  percentile,
  resolvePercentOrNumber,
  resolveNumericBounds,
  computeMetricColorScaleUnified,
  computeSizeScale,
  RGBAColor,
  ColorByValueConfig,
} from '../../src/utils/colors';

// ─── isPercentString ────────────────────────────────────────────────────────

describe('isPercentString', () => {
  it('returns true for valid percentage strings', () => {
    expect(isPercentString('25%')).toBe(true);
    expect(isPercentString('0%')).toBe(true);
    expect(isPercentString('100%')).toBe(true);
    expect(isPercentString('33.5%')).toBe(true);
  });

  it('returns true for strings with whitespace', () => {
    expect(isPercentString('  25%  ')).toBe(true);
  });

  it('returns false for non-percentage strings', () => {
    expect(isPercentString('25')).toBe(false);
    expect(isPercentString('hello')).toBe(false);
    expect(isPercentString('%25')).toBe(false);
    expect(isPercentString('')).toBe(false);
  });

  it('returns false for non-string types', () => {
    expect(isPercentString(25)).toBe(false);
    expect(isPercentString(null)).toBe(false);
    expect(isPercentString(undefined)).toBe(false);
  });
});

// ─── percentile ─────────────────────────────────────────────────────────────

describe('percentile', () => {
  it('returns 0 for empty array', () => {
    expect(percentile([], 0.5)).toBe(0);
  });

  it('returns the single element for single-element array', () => {
    expect(percentile([42], 0.5)).toBe(42);
  });

  it('returns first element at p=0', () => {
    expect(percentile([10, 20, 30, 40, 50], 0)).toBe(10);
  });

  it('returns last element at p=1', () => {
    expect(percentile([10, 20, 30, 40, 50], 1)).toBe(50);
  });

  it('computes median (p=0.5) correctly', () => {
    expect(percentile([10, 20, 30, 40, 50], 0.5)).toBe(30);
  });

  it('interpolates between elements for fractional indices', () => {
    // p=0.25 → index = 0.25 * 4 = 1.0 → exactly element[1] = 20
    expect(percentile([10, 20, 30, 40, 50], 0.25)).toBe(20);
  });

  it('handles p=0.1 with linear interpolation', () => {
    // sorted: [10, 20, 30, 40, 50], p=0.1 → index = 0.1 * 4 = 0.4
    // lo=0, hi=1, weight=0.4 → 10*(0.6) + 20*(0.4) = 6 + 8 = 14
    expect(percentile([10, 20, 30, 40, 50], 0.1)).toBe(14);
  });

  it('clamps below 0', () => {
    expect(percentile([10, 20, 30], -0.5)).toBe(10);
  });

  it('clamps above 1', () => {
    expect(percentile([10, 20, 30], 1.5)).toBe(30);
  });
});

// ─── resolvePercentOrNumber ─────────────────────────────────────────────────

describe('resolvePercentOrNumber', () => {
  const sorted = [10, 20, 30, 40, 50];

  it('returns fallback for null', () => {
    expect(resolvePercentOrNumber(null, sorted, 99)).toBe(99);
  });

  it('returns fallback for undefined', () => {
    expect(resolvePercentOrNumber(undefined, sorted, 99)).toBe(99);
  });

  it('returns number as-is', () => {
    expect(resolvePercentOrNumber(42, sorted, 99)).toBe(42);
  });

  it('resolves percentage string to percentile', () => {
    // 50% of [10, 20, 30, 40, 50] → median = 30
    expect(resolvePercentOrNumber('50%', sorted, 99)).toBe(30);
  });

  it('resolves 0% to first element', () => {
    expect(resolvePercentOrNumber('0%', sorted, 99)).toBe(10);
  });

  it('resolves 100% to last element', () => {
    expect(resolvePercentOrNumber('100%', sorted, 99)).toBe(50);
  });

  it('returns fallback for non-percent string', () => {
    expect(resolvePercentOrNumber('hello', sorted, 99)).toBe(99);
  });
});

// ─── resolveNumericBounds ───────────────────────────────────────────────────

describe('resolveNumericBounds', () => {
  const rawData = [
    { speed: 10 },
    { speed: 20 },
    { speed: 30 },
    { speed: 40 },
    { speed: 50 },
  ];

  it('returns null for empty data', () => {
    expect(resolveNumericBounds([], 'speed', null, null, 'test')).toBeNull();
  });

  it('returns null when column has no numeric values', () => {
    const data = [{ speed: 'abc' }, { speed: null }];
    expect(resolveNumericBounds(data, 'speed', null, null, 'test')).toBeNull();
  });

  it('resolves with data min/max when bounds are null', () => {
    const result = resolveNumericBounds(rawData, 'speed', null, null, 'test');
    expect(result).not.toBeNull();
    expect(result!.lower).toBe(10);
    expect(result!.upper).toBe(50);
    expect(result!.usesPercentBounds).toBe(false);
  });

  it('resolves numeric bounds as-is', () => {
    const result = resolveNumericBounds(rawData, 'speed', 15, 45, 'test');
    expect(result!.lower).toBe(15);
    expect(result!.upper).toBe(45);
    expect(result!.usesPercentBounds).toBe(false);
  });

  it('resolves percentage bounds to percentiles', () => {
    const result = resolveNumericBounds(
      rawData,
      'speed',
      '10%',
      '90%',
      'test',
    );
    expect(result).not.toBeNull();
    expect(result!.lower).toBeGreaterThan(10);
    expect(result!.upper).toBeLessThan(50);
    expect(result!.usesPercentBounds).toBe(true);
  });

  it('sets usesPercentBounds when only one bound is percentage', () => {
    const result = resolveNumericBounds(
      rawData,
      'speed',
      '10%',
      null,
      'test',
    );
    expect(result!.usesPercentBounds).toBe(true);
  });

  it('returns sorted values', () => {
    const unorderedData = [
      { speed: 50 },
      { speed: 10 },
      { speed: 30 },
    ];
    const result = resolveNumericBounds(
      unorderedData,
      'speed',
      null,
      null,
      'test',
    );
    expect(result!.sortedValues).toEqual([10, 30, 50]);
  });

  it('warns on inverted bounds but still returns', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const result = resolveNumericBounds(rawData, 'speed', 45, 15, 'test');
    expect(result).not.toBeNull();
    expect(result!.lower).toBe(45);
    expect(result!.upper).toBe(15);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('skips non-numeric values in the column', () => {
    const mixedData = [
      { speed: 10 },
      { speed: null },
      { speed: 'abc' },
      { speed: 50 },
    ];
    const result = resolveNumericBounds(
      mixedData,
      'speed',
      null,
      null,
      'test',
    );
    expect(result!.sortedValues).toEqual([10, 50]);
  });
});

// ─── computeMetricColorScaleUnified ─────────────────────────────────────────

describe('computeMetricColorScaleUnified', () => {
  const yellow: RGBAColor = [255, 255, 0, 255];
  const red: RGBAColor = [255, 0, 0, 255];

  describe('continuous mode (no breakpoints)', () => {
    const spec: ColorByValueConfig = {
      valueColumn: 'speed',
      startColor: yellow,
      endColor: red,
      lowerBound: 0,
      upperBound: 100,
    };

    it('returns startColor for values at lowerBound', () => {
      const scale = computeMetricColorScaleUnified(spec, [0, 100]);
      expect(scale(0)).toEqual([255, 255, 0, 255]);
    });

    it('returns endColor for values at upperBound', () => {
      const scale = computeMetricColorScaleUnified(spec, [0, 100]);
      expect(scale(100)).toEqual([255, 0, 0, 255]);
    });

    it('returns midpoint color at 50%', () => {
      const scale = computeMetricColorScaleUnified(spec, [0, 100]);
      const mid = scale(50);
      // Green channel should be ~128 (midpoint between 255 and 0)
      expect(mid[0]).toBe(255); // red stays 255
      expect(mid[1]).toBe(128); // green interpolated
      expect(mid[2]).toBe(0); // blue stays 0
    });

    it('clamps values below lowerBound to startColor', () => {
      const scale = computeMetricColorScaleUnified(spec, [0, 100]);
      expect(scale(-50)).toEqual([255, 255, 0, 255]);
    });

    it('clamps values above upperBound to endColor', () => {
      const scale = computeMetricColorScaleUnified(spec, [0, 100]);
      expect(scale(200)).toEqual([255, 0, 0, 255]);
    });

    it('returns startColor for null values', () => {
      const scale = computeMetricColorScaleUnified(spec, [0, 100]);
      expect(scale(null as any)).toEqual([255, 255, 0, 255]);
    });

    it('returns startColor when min equals max', () => {
      const singleValueSpec: ColorByValueConfig = {
        ...spec,
        lowerBound: 50,
        upperBound: 50,
      };
      const scale = computeMetricColorScaleUnified(singleValueSpec, [50, 50]);
      expect(scale(50)).toEqual([255, 255, 0, 255]);
    });
  });

  describe('breakpoints mode', () => {
    const spec: ColorByValueConfig = {
      valueColumn: 'speed',
      startColor: yellow,
      endColor: red,
      lowerBound: 0,
      upperBound: 100,
      breakpoints: [25, 50, 75],
    };

    it('maps value at lowerBound to startColor', () => {
      const scale = computeMetricColorScaleUnified(spec, [0, 100]);
      expect(scale(0)).toEqual([255, 255, 0, 255]);
    });

    it('maps value at upperBound to endColor', () => {
      const scale = computeMetricColorScaleUnified(spec, [0, 100]);
      expect(scale(100)).toEqual([255, 0, 0, 255]);
    });

    it('produces monotonically decreasing green channel across segments', () => {
      const scale = computeMetricColorScaleUnified(spec, [0, 100]);
      // Sample a value from each of the 4 segments
      const colors = [12, 37, 62, 87].map(v => scale(v));

      // Green channel should strictly decrease (yellow→red means G goes 255→0)
      for (let i = 1; i < colors.length; i++) {
        expect(colors[i][1]).toBeLessThan(colors[i - 1][1]);
      }
    });

    it('does NOT repeat the full gradient in each segment', () => {
      const scale = computeMetricColorScaleUnified(spec, [0, 100]);
      // Top of segment 1 (just below 25) and bottom of segment 2 (just above 25)
      // should have similar colors, NOT a reset to yellow
      const topSeg1 = scale(24);
      const bottomSeg2 = scale(26);

      // Green channels should be close (not a big jump back to 255)
      expect(Math.abs(topSeg1[1] - bottomSeg2[1])).toBeLessThan(30);
    });

    it('segment boundaries map to correct gradient positions', () => {
      const scale = computeMetricColorScaleUnified(spec, [0, 100]);
      // At breakpoint 50 (midpoint), should be at 50% of the gradient
      const atMidBreakpoint = scale(50);
      expect(atMidBreakpoint[0]).toBe(255); // red stays 255
      expect(atMidBreakpoint[1]).toBe(128); // green at midpoint
      expect(atMidBreakpoint[2]).toBe(0); // blue stays 0
    });

    it('returns startColor for null values', () => {
      const scale = computeMetricColorScaleUnified(spec, [0, 100]);
      expect(scale(null as any)).toEqual([255, 255, 0, 255]);
    });

    it('returns endColor for values above upperBound', () => {
      const scale = computeMetricColorScaleUnified(spec, [0, 100]);
      expect(scale(150)).toEqual([255, 0, 0, 255]);
    });
  });
});

// ─── computeSizeScale ───────────────────────────────────────────────────────

describe('computeSizeScale', () => {
  const config = {
    valueColumn: 'intensity',
    startSize: 4,
    endSize: 30,
    lowerBound: 0,
    upperBound: 100,
  };

  it('returns startSize at lowerBound', () => {
    const scale = computeSizeScale(config, [0, 100]);
    expect(scale(0)).toBe(4);
  });

  it('returns endSize at upperBound', () => {
    const scale = computeSizeScale(config, [0, 100]);
    expect(scale(100)).toBe(30);
  });

  it('returns midpoint size at 50%', () => {
    const scale = computeSizeScale(config, [0, 100]);
    expect(scale(50)).toBe(17);
  });

  it('clamps below lowerBound', () => {
    const scale = computeSizeScale(config, [0, 100]);
    expect(scale(-50)).toBe(4);
  });

  it('clamps above upperBound', () => {
    const scale = computeSizeScale(config, [0, 100]);
    expect(scale(200)).toBe(30);
  });

  it('returns startSize for null values', () => {
    const scale = computeSizeScale(config, [0, 100]);
    expect(scale(null as any)).toBe(4);
  });

  it('returns startSize when range is zero', () => {
    const zeroRange = { ...config, lowerBound: 50, upperBound: 50 };
    const scale = computeSizeScale(zeroRange, [50, 50]);
    expect(scale(50)).toBe(4);
  });

  it('uses data domain when bounds are null', () => {
    const noBounds = {
      valueColumn: 'intensity',
      startSize: 4,
      endSize: 30,
      lowerBound: null as number | null,
      upperBound: null as number | null,
    };
    const scale = computeSizeScale(noBounds, [10, 50]);
    expect(scale(10)).toBe(4);
    expect(scale(50)).toBe(30);
  });
});
