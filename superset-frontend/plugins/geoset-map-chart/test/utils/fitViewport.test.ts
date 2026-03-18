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
import fitViewport, {
  isValidViewport,
  toNumericViewport,
  Viewport,
  calculateAutozoomViewport,
} from '../../src/utils/fitViewport';

// ---------------------------------------------------------------------------
// isValidViewport
// ---------------------------------------------------------------------------
describe('isValidViewport', () => {
  it('returns true for a valid viewport', () => {
    expect(
      isValidViewport({ longitude: -77.0, latitude: 38.9, zoom: 10 }),
    ).toBe(true);
  });

  it('returns true at boundary values', () => {
    expect(
      isValidViewport({ longitude: -180, latitude: -90, zoom: 0 }),
    ).toBe(true);
    expect(
      isValidViewport({ longitude: 180, latitude: 90, zoom: 24 }),
    ).toBe(true);
  });

  it('returns false for out-of-range longitude', () => {
    expect(
      isValidViewport({ longitude: -181, latitude: 0, zoom: 5 }),
    ).toBe(false);
    expect(
      isValidViewport({ longitude: 181, latitude: 0, zoom: 5 }),
    ).toBe(false);
  });

  it('returns false for out-of-range latitude', () => {
    expect(
      isValidViewport({ longitude: 0, latitude: -91, zoom: 5 }),
    ).toBe(false);
    expect(
      isValidViewport({ longitude: 0, latitude: 91, zoom: 5 }),
    ).toBe(false);
  });

  it('returns false for out-of-range zoom', () => {
    expect(
      isValidViewport({ longitude: 0, latitude: 0, zoom: -1 }),
    ).toBe(false);
    expect(
      isValidViewport({ longitude: 0, latitude: 0, zoom: 25 }),
    ).toBe(false);
  });

  it('returns false for null/undefined/non-object', () => {
    expect(isValidViewport(null)).toBe(false);
    expect(isValidViewport(undefined)).toBe(false);
    expect(isValidViewport('string')).toBe(false);
    expect(isValidViewport(42)).toBe(false);
  });

  it('returns false for NaN values', () => {
    expect(
      isValidViewport({ longitude: NaN, latitude: 0, zoom: 5 }),
    ).toBe(false);
  });

  it('coerces string numbers', () => {
    // Number("10") is 10, which is valid
    expect(
      isValidViewport({ longitude: '10' as any, latitude: '20' as any, zoom: '5' as any }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// toNumericViewport
// ---------------------------------------------------------------------------
describe('toNumericViewport', () => {
  it('coerces string values to numbers', () => {
    const vp = {
      longitude: '10' as any,
      latitude: '20' as any,
      zoom: '5' as any,
      bearing: '45' as any,
      pitch: '30' as any,
    };
    const result = toNumericViewport(vp);

    expect(result).toEqual({
      longitude: 10,
      latitude: 20,
      zoom: 5,
      bearing: 45,
      pitch: 30,
    });
  });

  it('defaults bearing and pitch to 0 when falsy', () => {
    const vp: Viewport = { longitude: 0, latitude: 0, zoom: 10 };
    const result = toNumericViewport(vp);

    expect(result.bearing).toBe(0);
    expect(result.pitch).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// fitViewport
// ---------------------------------------------------------------------------
describe('fitViewport', () => {
  const baseViewport: Viewport = {
    longitude: 0,
    latitude: 0,
    zoom: 1,
    bearing: 45,
    pitch: 30,
  };

  it('returns a viewport fitted to points', () => {
    const result = fitViewport(baseViewport, {
      points: [
        [-10, -10],
        [10, 10],
      ],
      width: 800,
      height: 600,
    });

    expect(result.longitude).toBeCloseTo(0, 0);
    expect(result.latitude).toBeCloseTo(0, 0);
    expect(result.zoom).toBeGreaterThan(0);
  });

  it('preserves bearing and pitch from original viewport', () => {
    const result = fitViewport(baseViewport, {
      points: [
        [-10, -10],
        [10, 10],
      ],
      width: 800,
      height: 600,
    });

    expect(result.bearing).toBe(45);
    expect(result.pitch).toBe(30);
  });

  it('respects maxZoom option', () => {
    const result = fitViewport(baseViewport, {
      points: [
        [0, 0],
        [0.001, 0.001],
      ],
      width: 800,
      height: 600,
      maxZoom: 12,
    });

    expect(result.zoom).toBeLessThanOrEqual(12);
  });

  it('returns original viewport on error', () => {
    // Points that might cause issues — empty area
    const result = fitViewport(baseViewport, {
      points: [],
      width: 0,
      height: 0,
    });

    // Should fall back gracefully
    expect(result).toBeDefined();
    expect(typeof result.longitude).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// calculateAutozoomViewport
// ---------------------------------------------------------------------------
describe('calculateAutozoomViewport', () => {
  const baseViewport: Viewport = {
    longitude: 0,
    latitude: 0,
    zoom: 1,
  };

  it('returns baseViewport when features is empty', () => {
    expect(calculateAutozoomViewport([], baseViewport, 800, 600)).toBe(
      baseViewport,
    );
  });

  it('returns baseViewport when features is null', () => {
    expect(
      calculateAutozoomViewport(null as any, baseViewport, 800, 600),
    ).toBe(baseViewport);
  });

  it('computes viewport from feature geometries', () => {
    const features = [
      { geometry: { type: 'Point', coordinates: [-77.0, 38.9] } },
      { geometry: { type: 'Point', coordinates: [-122.4, 37.8] } },
    ];
    const result = calculateAutozoomViewport(
      features,
      baseViewport,
      800,
      600,
    );

    expect(result.zoom).toBeGreaterThanOrEqual(0);
    // Should center roughly between DC and SF
    expect(result.longitude).toBeGreaterThan(-130);
    expect(result.longitude).toBeLessThan(-70);
  });

  it('handles nested geojson.geometry format', () => {
    const features = [
      {
        geojson: {
          geometry: { type: 'Point', coordinates: [10, 20] },
        },
      },
    ];
    const result = calculateAutozoomViewport(
      features,
      baseViewport,
      800,
      600,
    );

    expect(result).toBeDefined();
    expect(typeof result.longitude).toBe('number');
  });

  it('handles geojson property directly', () => {
    const features = [
      {
        geojson: { type: 'Point', coordinates: [10, 20] },
      },
    ];
    const result = calculateAutozoomViewport(
      features,
      baseViewport,
      800,
      600,
    );

    expect(result).toBeDefined();
  });

  it('returns baseViewport when no coordinates can be extracted', () => {
    const features = [{ geometry: {} }, { properties: { name: 'test' } }];
    const result = calculateAutozoomViewport(
      features,
      baseViewport,
      800,
      600,
    );

    expect(result).toBe(baseViewport);
  });

  it('handles polygon geometries', () => {
    const features = [
      {
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
              [0, 0],
            ],
          ],
        },
      },
    ];
    const result = calculateAutozoomViewport(
      features,
      baseViewport,
      800,
      600,
    );

    expect(result.zoom).toBeGreaterThanOrEqual(0);
  });

  it('ensures zoom is at least 0', () => {
    // Single point should still result in zoom >= 0
    const features = [
      { geometry: { type: 'Point', coordinates: [0, 0] } },
    ];
    const result = calculateAutozoomViewport(
      features,
      baseViewport,
      800,
      600,
    );

    expect(result.zoom).toBeGreaterThanOrEqual(0);
  });
});
