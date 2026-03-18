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
  DataRecord,
  getSequentialSchemeRegistry,
  SequentialScheme,
} from '@superset-ui/core';
import {
  getBreakPoints,
  getBreakPointColorScaler,
  getBuckets,
  parseRawFeatures,
  normalizeNullCategory,
  getGeometryType,
} from '../../src/utils/dataProcessing';

// ---------------------------------------------------------------------------
// getBreakPoints
// ---------------------------------------------------------------------------
describe('getBreakPoints', () => {
  const accessor = (d: any) => d.value as number | undefined;

  it('returns empty array when features is falsy', () => {
    expect(
      getBreakPoints(
        { break_points: [], num_buckets: '5' },
        null as any,
        accessor,
      ),
    ).toEqual([]);
  });

  it('computes evenly spaced break points from data', () => {
    const features = [{ value: 0 }, { value: 100 }];
    const result = getBreakPoints(
      { break_points: [], num_buckets: '5' },
      features,
      accessor,
    );

    expect(result.length).toBeGreaterThan(0);
    // First break point should be at or near 0
    expect(parseFloat(result[0])).toBeLessThanOrEqual(0);
    // Last break point should be at or near 100
    expect(parseFloat(result[result.length - 1])).toBeGreaterThanOrEqual(100);
  });

  it('uses default 10 buckets when num_buckets is not provided', () => {
    const features = [{ value: 0 }, { value: 100 }];
    const result = getBreakPoints(
      { break_points: [], num_buckets: '' },
      features,
      accessor,
    );

    // 10 buckets → 11 break points (possibly +1 for extra bucket)
    expect(result.length).toBeGreaterThanOrEqual(11);
  });

  it('returns sorted break points when provided explicitly', () => {
    const features = [{ value: 0 }, { value: 100 }];
    const result = getBreakPoints(
      { break_points: ['50', '10', '90'], num_buckets: '3' },
      features,
      accessor,
    );

    expect(result).toEqual(['10', '50', '90']);
  });

  it('returns empty array when extent is undefined', () => {
    const features = [{ value: undefined }];
    const result = getBreakPoints(
      { break_points: [], num_buckets: '5' },
      features,
      accessor,
    );

    expect(result).toEqual([]);
  });

  it('handles single-value data (min === max)', () => {
    const features = [{ value: 42 }, { value: 42 }];
    const result = getBreakPoints(
      { break_points: [], num_buckets: '3' },
      features,
      accessor,
    );

    // Should not crash, break points should all be equal
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// parseRawFeatures
// ---------------------------------------------------------------------------
describe('parseRawFeatures', () => {
  it('returns empty array for empty input', () => {
    expect(parseRawFeatures([])).toEqual([]);
    expect(parseRawFeatures(null as any)).toEqual([]);
    expect(parseRawFeatures(undefined as any)).toEqual([]);
  });

  it('parses rows with object geometry', () => {
    const rawData = [
      {
        geojson: { type: 'Point', coordinates: [10, 20] },
        name: 'Location A',
      },
    ] as unknown as DataRecord[];
    const result = parseRawFeatures(rawData);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('Feature');
    expect(result[0].geometry.type).toBe('Point');
    expect(result[0].properties.name).toBe('Location A');
  });

  it('parses rows with stringified geometry', () => {
    const rawData = [
      {
        geojson: JSON.stringify({ type: 'Point', coordinates: [10, 20] }),
        name: 'Location B',
      },
    ];
    const result = parseRawFeatures(rawData);

    expect(result).toHaveLength(1);
    expect(result[0].geometry.type).toBe('Point');
  });

  it('filters out rows with null geometry when filterNulls=true', () => {
    const rawData = [
      { geojson: null, name: 'No Geo' },
      { geojson: { type: 'Point', coordinates: [0, 0] }, name: 'Has Geo' },
    ] as unknown as DataRecord[];
    const result = parseRawFeatures(rawData);

    expect(result).toHaveLength(1);
    expect(result[0].properties.name).toBe('Has Geo');
  });

  it('keeps rows with null geometry when filterNulls=false', () => {
    const rawData = [
      { geojson: null, name: 'No Geo' },
      { geojson: { type: 'Point', coordinates: [0, 0] }, name: 'Has Geo' },
    ] as unknown as DataRecord[];
    const result = parseRawFeatures(rawData, undefined, false);

    expect(result).toHaveLength(2);
  });

  it('adds extraProps for dimension', () => {
    const rawData = [
      {
        geojson: { type: 'Point', coordinates: [0, 0] },
        category: 'A',
      },
    ] as unknown as DataRecord[];
    const result = parseRawFeatures(rawData, 'category');

    expect(result[0].extraProps).toEqual({ category: 'A' });
  });

  it('handles invalid JSON strings gracefully', () => {
    const rawData = [{ geojson: 'not-valid-json' }];
    const result = parseRawFeatures(rawData);

    // Invalid JSON should be filtered out (or kept depending on filterNulls)
    // The catch block returns null which gets filtered
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// normalizeNullCategory
// ---------------------------------------------------------------------------
describe('normalizeNullCategory', () => {
  it.each([
    [null, '__NULL__'],
    [undefined, '__NULL__'],
    [42, '42'],
    ['hello', 'hello'],
  ])('normalizeNullCategory(%j) → %j', (input, expected) => {
    expect(normalizeNullCategory(input)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// getGeometryType
// ---------------------------------------------------------------------------
describe('getGeometryType', () => {
  it('returns type from object geometry', () => {
    expect(getGeometryType({ type: 'Point', coordinates: [0, 0] })).toBe(
      'Point',
    );
    expect(
      getGeometryType({ type: 'Polygon', coordinates: [[[0, 0]]] }),
    ).toBe('Polygon');
  });

  it('returns type from JSON string geometry', () => {
    const json = JSON.stringify({ type: 'LineString', coordinates: [[0, 0]] });
    expect(getGeometryType(json)).toBe('LineString');
  });

  it('returns undefined for null/undefined', () => {
    expect(getGeometryType(null)).toBeUndefined();
    expect(getGeometryType(undefined)).toBeUndefined();
  });

  it('returns undefined for invalid JSON', () => {
    expect(getGeometryType('not-json')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getGeometryType('')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getBreakPointColorScaler
// ---------------------------------------------------------------------------
describe('getBreakPointColorScaler', () => {
  const accessor = (d: any) => d.value as number | undefined;
  const features = [{ value: 0 }, { value: 50 }, { value: 100 }];

  // Register a sequential scheme so the registry lookup works
  beforeAll(() => {
    const registry = getSequentialSchemeRegistry();
    if (!registry.get('testScheme')) {
      registry.registerValue(
        'testScheme',
        new SequentialScheme({
          id: 'testScheme',
          colors: ['#000000', '#ffffff'],
        }),
      );
    }
  });

  it('returns a function for an unknown scheme when registry has a default', () => {
    const result = getBreakPointColorScaler(
      {
        break_points: [],
        num_buckets: '3',
        linear_color_scheme: 'nonExistentScheme',
        opacity: 100,
      },
      features,
      accessor,
    );
    // The superset registry falls back to a default scheme
    expect(typeof result).toBe('function');
  });

  it('returns a color scaler function with break points', () => {
    const scaler = getBreakPointColorScaler(
      {
        break_points: ['0', '50', '100'],
        num_buckets: '2',
        linear_color_scheme: 'testScheme',
        opacity: 100,
      },
      features,
      accessor,
    );
    expect(typeof scaler).toBe('function');
  });

  it('returned scaler returns [0,0,0,0] for falsy value', () => {
    const scaler = getBreakPointColorScaler(
      {
        break_points: ['0', '50', '100'],
        num_buckets: '2',
        linear_color_scheme: 'testScheme',
        opacity: 100,
      },
      features,
      accessor,
    );
    expect(scaler!({ value: 0 })).toEqual([0, 0, 0, 0]);
    expect(scaler!({ value: undefined })).toEqual([0, 0, 0, 0]);
  });

  it('returned scaler applies opacity to valid values', () => {
    const scaler = getBreakPointColorScaler(
      {
        break_points: ['0', '50', '100'],
        num_buckets: '2',
        linear_color_scheme: 'testScheme',
        opacity: 50,
      },
      features,
      accessor,
    );
    const result = scaler!({ value: 25 });
    // opacity 50% → alpha ≈ 127.5
    expect(result[3]).toBeCloseTo(127.5, 0);
  });

  it('masks points outside break point range', () => {
    const scaler = getBreakPointColorScaler(
      {
        break_points: ['10', '50', '90'],
        num_buckets: '2',
        linear_color_scheme: 'testScheme',
        opacity: 100,
      },
      features,
      accessor,
    );
    // Value 100 is above the last break point (90) → masked → alpha = 0
    const result = scaler!({ value: 100 });
    expect(result[3]).toBe(0);
  });

  it('uses linear interpolation when no break points provided', () => {
    const scaler = getBreakPointColorScaler(
      {
        break_points: [] as string[],
        num_buckets: '',
        linear_color_scheme: 'testScheme',
        opacity: 80,
      },
      features,
      accessor,
    );
    expect(typeof scaler).toBe('function');
    const result = scaler!({ value: 50 });
    // Should have opacity applied: (80/100) * 255 = 204
    expect(result[3]).toBeCloseTo(204, 0);
  });

  it('handles array color scheme', () => {
    const scaler = getBreakPointColorScaler(
      {
        break_points: [] as string[],
        num_buckets: '',
        linear_color_scheme: ['#ff0000', '#00ff00', '#0000ff'],
        opacity: 100,
      },
      features,
      accessor,
    );
    expect(typeof scaler).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// getBuckets
// ---------------------------------------------------------------------------
describe('getBuckets', () => {
  const accessor = (d: any) => d.value as number | undefined;
  const features = [{ value: 0 }, { value: 100 }];

  beforeAll(() => {
    const registry = getSequentialSchemeRegistry();
    if (!registry.get('testScheme')) {
      registry.registerValue(
        'testScheme',
        new SequentialScheme({
          id: 'testScheme',
          colors: ['#000000', '#ffffff'],
        }),
      );
    }
  });

  it('returns bucket ranges with colors', () => {
    const fd = {
      break_points: [] as string[],
      num_buckets: '3',
      linear_color_scheme: 'testScheme',
      opacity: 100,
      metric: 'value',
    } as any;

    const result = getBuckets(fd, features, accessor);
    const keys = Object.keys(result);
    expect(keys.length).toBeGreaterThan(0);

    // Each bucket should have color and enabled
    keys.forEach(key => {
      expect(result[key]).toHaveProperty('color');
      expect(result[key]).toHaveProperty('enabled', true);
    });
  });

  it('uses metric label when metric is an object', () => {
    const fd = {
      break_points: [] as string[],
      num_buckets: '2',
      linear_color_scheme: 'testScheme',
      opacity: 100,
      metric: { label: 'my_metric' },
    } as any;

    const result = getBuckets(fd, features, accessor);
    expect(Object.keys(result).length).toBeGreaterThan(0);
  });

  it('returns bucket range strings in "min - max" format', () => {
    const fd = {
      break_points: ['0', '50', '100'],
      num_buckets: '2',
      linear_color_scheme: 'testScheme',
      opacity: 100,
      metric: 'value',
    } as any;

    const result = getBuckets(fd, features, accessor);
    const keys = Object.keys(result);
    keys.forEach(key => {
      expect(key).toMatch(/\d+(\.\d+)?\s*-\s*\d+(\.\d+)?/);
    });
  });
});
