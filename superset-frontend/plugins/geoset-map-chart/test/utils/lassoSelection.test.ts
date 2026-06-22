import {
  closeRing,
  filterFeaturesInLasso,
  normalizeCategoryKey,
} from '../../src/utils/lassoSelection';
import type { GeoJsonFeature } from '../../src/types';
import type { Coordinate } from '../../src/utils/measureDistance';

// Small square lasso polygon around [0,0]
const LASSO_SQUARE: Coordinate[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

function makePoint(lng: number, lat: number): GeoJsonFeature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {},
  };
}

function makeMultiPoint(coords: [number, number][]): GeoJsonFeature {
  return {
    type: 'Feature',
    geometry: { type: 'MultiPoint', coordinates: coords },
    properties: {},
  };
}

function makeLine(coords: [number, number][]): GeoJsonFeature {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: {},
  };
}

function makeMultiLine(lines: [number, number][][]): GeoJsonFeature {
  return {
    type: 'Feature',
    geometry: { type: 'MultiLineString', coordinates: lines },
    properties: {},
  };
}

function makePolygon(ring: [number, number][]): GeoJsonFeature {
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ring] },
    properties: {},
  };
}

function makeMultiPolygon(rings: [number, number][][]): GeoJsonFeature {
  return {
    type: 'Feature',
    geometry: {
      type: 'MultiPolygon',
      coordinates: rings.map(r => [r]),
    },
    properties: {},
  };
}

describe('closeRing', () => {
  it('returns input unchanged if already closed', () => {
    const ring: Coordinate[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ];
    expect(closeRing(ring)).toBe(ring);
  });

  it('appends first point if ring is not closed', () => {
    const ring: Coordinate[] = [
      [0, 0],
      [1, 0],
      [1, 1],
    ];
    const closed = closeRing(ring);
    expect(closed).toHaveLength(4);
    expect(closed[3]).toEqual([0, 0]);
  });

  it('returns input unchanged if fewer than 3 points', () => {
    const ring: Coordinate[] = [[0, 0]];
    expect(closeRing(ring)).toBe(ring);
  });
});

describe('normalizeCategoryKey', () => {
  it('trims and lowercases strings', () => {
    expect(normalizeCategoryKey('  Hello World  ')).toBe('hello world');
  });

  it('converts numbers to strings', () => {
    expect(normalizeCategoryKey(42)).toBe('42');
  });

  it('returns empty string for null/undefined', () => {
    expect(normalizeCategoryKey(null)).toBe('');
    expect(normalizeCategoryKey(undefined)).toBe('');
  });
});

describe('filterFeaturesInLasso', () => {
  it('returns empty array when no features provided', async () => {
    expect(await filterFeaturesInLasso([], LASSO_SQUARE)).toEqual([]);
  });

  it('returns empty array when polygon has fewer than 3 coords', async () => {
    const features = [makePoint(0, 0)];
    expect(
      await filterFeaturesInLasso(features, [
        [0, 0],
        [1, 1],
      ]),
    ).toEqual([]);
  });

  it('selects Point features inside the lasso', async () => {
    const inside = makePoint(0, 0);
    const outside = makePoint(5, 5);
    const result = await filterFeaturesInLasso(
      [inside, outside],
      LASSO_SQUARE,
    );
    expect(result).toEqual([inside]);
  });

  it('selects MultiPoint features if any point is inside', async () => {
    const mp = makeMultiPoint([
      [0, 0],
      [10, 10],
    ]);
    const result = await filterFeaturesInLasso([mp], LASSO_SQUARE);
    expect(result).toEqual([mp]);
  });

  it('rejects MultiPoint features if no point is inside', async () => {
    const mp = makeMultiPoint([
      [10, 10],
      [20, 20],
    ]);
    const result = await filterFeaturesInLasso([mp], LASSO_SQUARE);
    expect(result).toEqual([]);
  });

  it('selects LineString features if any vertex is inside', async () => {
    const line = makeLine([
      [0, 0],
      [10, 10],
    ]);
    const result = await filterFeaturesInLasso([line], LASSO_SQUARE);
    expect(result).toEqual([line]);
  });

  it('selects LineString features that pass through the lasso without a vertex inside', async () => {
    // Line from well outside on the left to well outside on the right,
    // passing through the [-1,1] x [-1,1] lasso square at y=0
    const line = makeLine([
      [-10, 0],
      [10, 0],
    ]);
    const result = await filterFeaturesInLasso([line], LASSO_SQUARE);
    expect(result).toEqual([line]);
  });

  it('rejects LineString features fully outside the lasso', async () => {
    const line = makeLine([
      [10, 10],
      [20, 20],
    ]);
    const result = await filterFeaturesInLasso([line], LASSO_SQUARE);
    expect(result).toEqual([]);
  });

  it('selects Polygon features with >= 50% overlap', async () => {
    // Small polygon fully inside the lasso square
    const inside = makePolygon([
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5],
      [-0.5, -0.5],
    ]);
    const result = await filterFeaturesInLasso([inside], LASSO_SQUARE);
    expect(result).toEqual([inside]);
  });

  it('rejects Polygon features with < 50% overlap', async () => {
    // Polygon mostly outside: only a small sliver overlaps the lasso
    const mostlyOutside = makePolygon([
      [0.5, 0.5],
      [5, 0.5],
      [5, 5],
      [0.5, 5],
      [0.5, 0.5],
    ]);
    const result = await filterFeaturesInLasso([mostlyOutside], LASSO_SQUARE);
    expect(result).toEqual([]);
  });

  it('selects MultiPolygon features with sufficient overlap', async () => {
    // One ring fully inside the lasso
    const mp = makeMultiPolygon([
      [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
        [-0.5, -0.5],
      ],
    ]);
    const result = await filterFeaturesInLasso([mp], LASSO_SQUARE);
    expect(result).toEqual([mp]);
  });

  it('selects MultiLineString features if any vertex is inside', async () => {
    const ml = makeMultiLine([
      [
        [10, 10],
        [20, 20],
      ],
      [
        [0, 0],
        [10, 10],
      ],
    ]);
    const result = await filterFeaturesInLasso([ml], LASSO_SQUARE);
    expect(result).toEqual([ml]);
  });

  it('rejects MultiLineString features if no vertex is inside', async () => {
    const ml = makeMultiLine([
      [
        [10, 10],
        [20, 20],
      ],
      [
        [30, 30],
        [40, 40],
      ],
    ]);
    const result = await filterFeaturesInLasso([ml], LASSO_SQUARE);
    expect(result).toEqual([]);
  });

  it('handles self-intersecting lasso polygons', async () => {
    // Bowtie / figure-eight polygon that crosses itself at the origin.
    // The valid parts should still select the point at (0.5, 0.5).
    const bowtie: Coordinate[] = [
      [-1, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
    ];
    const inside = makePoint(0.5, 0.5);
    const outside = makePoint(5, 5);
    const result = await filterFeaturesInLasso([inside, outside], bowtie);
    expect(result).toEqual([inside]);
  });

  it('handles features with missing geometry gracefully', async () => {
    const broken = {
      type: 'Feature',
      geometry: null,
      properties: {},
    } as unknown as GeoJsonFeature;
    expect(await filterFeaturesInLasso([broken], LASSO_SQUARE)).toEqual([]);
  });
});
