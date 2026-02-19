import { SolidPolygonLayer, LineLayer } from '@deck.gl/layers';
import { QueryFormData } from '@superset-ui/core';
import Layer from '@deck.gl/core/dist/lib/layer';
import { ExpandedPolygon } from './expandPolygonFeatures';

// Binary segment data for zero-allocation polygon border rendering via LineLayer.
// Typed arrays go straight to the GPU — no per-edge JS objects, no GC pressure.
export type BinarySegmentData = {
  length: number;
  sourcePositions: Float64Array;
  targetPositions: Float64Array;
  polygonIndices: Uint32Array;
};

// Module-level cache: keeps expanded polygon geometry stable across re-renders
// that only change category visibility or colors (not the underlying data).
// When data reference (payload.data) stays the same, cache hits avoid
// expensive polygon re-tessellation in deck.gl's SolidPolygonLayer.
export const polygonDataCache = new WeakMap<object, ExpandedPolygon[]>();

const binarySegmentCache = new WeakMap<object, BinarySegmentData>();

/**
 * Convert expanded polygon rings into binary typed arrays for LineLayer.
 * Each ring edge becomes a source/target position pair stored in flat arrays.
 * LineLayer renders ~33% fewer GPU vertices than PathLayer with no CPU tessellation.
 */
function polygonsToBinarySegments(
  polygons: ExpandedPolygon[],
): BinarySegmentData {
  // First pass: count total segments to pre-allocate arrays
  let count = 0;
  for (const poly of polygons) {
    for (const ring of poly.polygon) {
      if (ring.length < 2) continue;
      count += ring.length - 1;
      // Closing edge if ring isn't already closed
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        count += 1;
      }
    }
  }

  const src = new Float64Array(count * 2);
  const tgt = new Float64Array(count * 2);
  const idx = new Uint32Array(count);
  let offset = 0;

  for (let pi = 0; pi < polygons.length; pi += 1) {
    for (const ring of polygons[pi].polygon) {
      const len = ring.length;
      if (len < 2) continue;
      for (let i = 0; i < len - 1; i += 1) {
        const o2 = offset * 2;
        src[o2] = ring[i][0];
        src[o2 + 1] = ring[i][1];
        tgt[o2] = ring[i + 1][0];
        tgt[o2 + 1] = ring[i + 1][1];
        idx[offset] = pi;
        offset += 1;
      }
      // Close the ring if first and last point differ
      const first = ring[0];
      const last = ring[len - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        const o2 = offset * 2;
        src[o2] = last[0];
        src[o2 + 1] = last[1];
        tgt[o2] = first[0];
        tgt[o2 + 1] = first[1];
        idx[offset] = pi;
        offset += 1;
      }
    }
  }

  return {
    length: offset,
    sourcePositions: src.subarray(0, offset * 2),
    targetPositions: tgt.subarray(0, offset * 2),
    polygonIndices: idx.subarray(0, offset),
  };
}

/**
 * Build SolidPolygonLayer (fill) + optional LineLayer (binary stroke) for polygon data.
 * Shared by both the cached fast path and the standard Polygon case.
 */
export function buildPolygonLayers(
  polygonData: ExpandedPolygon[],
  cacheKey: object,
  opts: {
    fd: QueryFormData;
    filled: boolean | undefined;
    stroked: boolean | undefined;
    lineWidth: number | undefined;
    fillColorArray: number[];
    strokeColorArray: number[];
    isMetric: boolean;
    categories: Record<string, { color: number[]; enabled: boolean }>;
    dimension: string | undefined;
    baseLayerProps: Record<string, any>;
  },
): Layer[] {
  const {
    fd,
    filled,
    stroked,
    lineWidth,
    fillColorArray,
    strokeColorArray,
    isMetric,
    categories,
    dimension,
    baseLayerProps,
  } = opts;

  const effectiveStroked =
    (lineWidth ?? fd.lineWidth ?? 1) > 0 ? (stroked ?? fd.stroked) : false;

  const disabledCategories = new Set<string>();
  if (!isMetric) {
    for (const [key, state] of Object.entries(categories)) {
      if (!(state as any).enabled) disabledCategories.add(key);
    }
  }
  const hasDisabled = disabledCategories.size > 0;

  // SolidPolygonLayer for fill (no stroke overhead)
  const fillLayer = new SolidPolygonLayer<ExpandedPolygon>({
    id: `polygon-fill-${fd.slice_id}`,
    data: polygonData,
    positionFormat: 'XY',
    filled: filled ?? fd.filled,
    getPolygon: ((d: ExpandedPolygon) => d.polygon) as any,
    getFillColor: (d: ExpandedPolygon): [number, number, number, number] => {
      if (hasDisabled && dimension) {
        const cat = d.properties?.[dimension];
        if (cat != null) {
          const key = String(cat).trim().toLowerCase();
          if (disabledCategories.has(key)) return [0, 0, 0, 0];
        }
      }
      const c = d.color || fillColorArray;
      return [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, c[3] ?? 255];
    },
    updateTriggers: {
      getFillColor: [fillColorArray, categories],
    },
    ...baseLayerProps,
  });

  if (!effectiveStroked) return [fillLayer];

  // LineLayer with binary data for borders — zero JS object allocation,
  // ~33% fewer GPU vertices than PathLayer, no CPU tessellation.
  let segments = binarySegmentCache.get(cacheKey);
  if (!segments) {
    segments = polygonsToBinarySegments(polygonData);
    binarySegmentCache.set(cacheKey, segments);
  }

  const strokeLayer = new LineLayer({
    id: `polygon-stroke-${fd.slice_id}`,
    data: {
      length: segments.length,
      attributes: {
        getSourcePosition: { value: segments.sourcePositions, size: 2 },
        getTargetPosition: { value: segments.targetPositions, size: 2 },
      },
    },
    getColor: hasDisabled
      ? (
          _: null,
          info: { index: number },
        ): [number, number, number, number] => {
          if (dimension) {
            const pi = segments!.polygonIndices[info.index];
            const poly = polygonData[pi];
            const cat = poly?.properties?.[dimension];
            if (cat != null) {
              const key = String(cat).trim().toLowerCase();
              if (disabledCategories.has(key)) return [0, 0, 0, 0];
            }
          }
          return strokeColorArray as [number, number, number, number];
        }
      : (strokeColorArray as [number, number, number, number]),
    getWidth: lineWidth ?? (fd.lineWidth || 1),
    widthUnits: 'pixels',
    widthScale: 1,
    widthMinPixels: 0,
    updateTriggers: {
      getColor: [strokeColorArray, categories],
    },
    pickable: false,
  });

  return [fillLayer, strokeLayer];
}
