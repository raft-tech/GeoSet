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
import area from '@turf/area';
import booleanIntersects from '@turf/boolean-intersects';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import centroid from '@turf/centroid';
import intersect from '@turf/intersect';
import { polygon as turfPolygon, point as turfPoint } from '@turf/helpers';
import unkinkPolygon from '@turf/unkink-polygon';
import { WebMercatorViewport } from '@math.gl/web-mercator';
import type { Coordinate } from './measureDistance';
import type { GeoJsonFeature } from '../types';

/** Minimum overlap ratio (0–1) for a polygon to be captured by the lasso. */
const POLYGON_OVERLAP_THRESHOLD = 0.5;

/** Vertical pixel offset applied to the results-bar anchor position. */
const ANCHOR_VERTICAL_OFFSET = 12;

/**
 * Normalize a category value to a consistent string key.
 * Used for matching category visibility across single- and multi-layer views.
 */
export function normalizeCategoryKey(raw: unknown): string {
  if (raw == null) return '';
  const str = typeof raw === 'string' ? raw : String(raw);
  return str.trim().toLowerCase();
}

/**
 * Get a representative [lng, lat] for any GeoJSON geometry type.
 * Used for point features and as a fallback for export coordinates.
 */
export function getRepresentativePoint(
  feature: GeoJsonFeature,
): [number, number] | null {
  const { geometry } = feature;
  if (!geometry || !geometry.type) return null;

  switch (geometry.type) {
    case 'Point':
      return geometry.coordinates as [number, number];
    case 'MultiPoint':
      return (geometry.coordinates?.[0] as [number, number]) ?? null;
    default: {
      try {
        const c = centroid(feature as any);
        return c.geometry.coordinates as [number, number];
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('getRepresentativePoint: centroid failed', err);
        return null;
      }
    }
  }
}

/**
 * Ensure a polygon coordinate ring is closed (first point == last point).
 */
export function closeRing(coords: Coordinate[]): Coordinate[] {
  if (coords.length < 3) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return coords;
  return [...coords, first];
}

const SQ_METERS_PER_ACRE = 4046.86;
const SQ_METERS_PER_SQ_MILE = 2_589_988;
const SQ_METERS_PER_SQ_KM = 1_000_000;

/**
 * Calculate the area of a lasso polygon and return a human-readable string.
 * Returns `null` when the polygon has fewer than 3 coordinates.
 *
 * - < 1 km²: displayed in acres
 * - >= 1 km²: displayed in square miles
 */
export function calculateLassoArea(
  coords: Coordinate[],
): string | null {
  if (coords.length < 3) return null;

  const closed = closeRing(coords);
  const poly = turfPolygon([closed]);
  const sqMeters = area(poly);

  if (sqMeters < SQ_METERS_PER_SQ_KM) {
    const acres = sqMeters / SQ_METERS_PER_ACRE;
    return `${acres < 0.1 ? acres.toFixed(2) : acres.toFixed(1)} acres`;
  }
  const sqMiles = sqMeters / SQ_METERS_PER_SQ_MILE;
  return `${sqMiles.toFixed(1)} sq mi`;
}

/**
 * Test whether a feature intersects the lasso polygon.
 *
 * - Point / MultiPoint: direct point-in-polygon test (fast)
 * - Polygon / MultiPolygon: selected if >= 50% area overlap
 * - LineString / MultiLineString: selected if any vertex is inside
 */
function isFeatureInLasso(
  feature: GeoJsonFeature,
  lassoPoly: ReturnType<typeof turfPolygon>,
): boolean {
  const { geometry } = feature;
  if (!geometry || !geometry.type) return false;

  try {
    switch (geometry.type) {
      case 'Point': {
        const pt = geometry.coordinates as [number, number];
        return booleanPointInPolygon(turfPoint(pt), lassoPoly);
      }
      case 'MultiPoint': {
        // Selected if any point in the multi-point is inside
        return (geometry.coordinates as [number, number][]).some(pt =>
          booleanPointInPolygon(turfPoint(pt), lassoPoly),
        );
      }
      case 'Polygon':
      case 'MultiPolygon': {
        // Selected if >= 50% of the polygon's area is inside the lasso
        const featureArea = area(feature as any);
        if (featureArea === 0) return false;
        const overlap = intersect({
          type: 'FeatureCollection',
          features: [feature as any, lassoPoly],
        });
        if (!overlap) return false;
        return area(overlap) / featureArea >= POLYGON_OVERLAP_THRESHOLD;
      }
      case 'LineString':
      case 'MultiLineString': {
        // Use full geometric intersection — catches lines that pass through
        // the lasso even when no vertex lies inside the polygon.
        return booleanIntersects(
          { type: 'Feature', geometry, properties: {} } as any,
          lassoPoly,
        );
      }
      default:
        // eslint-disable-next-line no-console
        console.warn(
          `isFeatureInLasso: unsupported geometry type "${geometry.type}"`,
        );
        return false;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('isFeatureInLasso: geometry test failed', err);
    return false;
  }
}

/** Number of features to process before yielding to the main thread. */
const FILTER_BATCH_SIZE = 2000;

/** Datasets at or below this size run synchronously (no yield overhead). */
const SYNC_THRESHOLD = 5000;

/**
 * Yield to the main thread so long-running spatial filtering doesn't freeze
 * the UI.  Uses `setTimeout(0)` as a universal fallback.
 */
function yieldToMain(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Prepare lasso polygon(s) for spatial testing.
 * Handles closing the ring and splitting self-intersecting polygons.
 */
function prepareLassoPolygons(
  lassoCoords: Coordinate[],
): ReturnType<typeof turfPolygon>[] {
  const closed = closeRing(lassoCoords);
  const rawPoly = turfPolygon([closed]);

  // Split self-intersecting polygons into valid parts so turf.js spatial
  // operations produce correct results.  For valid polygons this returns a
  // single-element collection, so the overhead is negligible.
  try {
    const unkinked = unkinkPolygon(rawPoly);
    return unkinked.features as ReturnType<typeof turfPolygon>[];
  } catch {
    // If unkinking fails (degenerate geometry), fall back to the raw polygon
    return [rawPoly];
  }
}

/**
 * Filter features that intersect the lasso polygon.
 *
 * Self-intersecting polygons (common with freehand drawing) are automatically
 * split into valid parts via `unkinkPolygon`.  Small datasets run synchronously
 * for instant results; large datasets are batched to avoid blocking the UI.
 */
export async function filterFeaturesInLasso(
  features: GeoJsonFeature[],
  lassoCoords: Coordinate[],
): Promise<GeoJsonFeature[]> {
  if (!features.length || lassoCoords.length < 3) return [];

  const polys = prepareLassoPolygons(lassoCoords);
  if (polys.length === 0) return [];

  const results: GeoJsonFeature[] = [];

  // Run synchronously for small-to-medium datasets to avoid async overhead
  if (features.length <= SYNC_THRESHOLD) {
    for (let i = 0; i < features.length; i++) {
      if (polys.some(p => isFeatureInLasso(features[i], p))) {
        results.push(features[i]);
      }
    }
    return results;
  }

  // Batch with yields for large datasets to keep the UI responsive
  for (let i = 0; i < features.length; i++) {
    if (polys.some(p => isFeatureInLasso(features[i], p))) {
      results.push(features[i]);
    }
    if ((i + 1) % FILTER_BATCH_SIZE === 0 && i + 1 < features.length) {
      await yieldToMain();
    }
  }

  return results;
}

/**
 * Filter features by category visibility, run lasso spatial selection,
 * and compute an anchor position for the results bar.
 *
 * Shared between Multi.tsx and GeoSetLayer.tsx to avoid duplication.
 */
/**
 * Project a geo coordinate to screen pixel position for the results bar anchor.
 * Call on every render so the bar tracks the polygon through pan/zoom.
 */
export function projectAnchorToScreen(
  geoCoord: Coordinate,
  viewport: { longitude: number; latitude: number; zoom: number },
  width: number,
  height: number,
): { x: number; y: number } {
  const wmv = new WebMercatorViewport({ ...viewport, width, height });
  const [px, py] = wmv.project(geoCoord);
  return { x: px, y: py + ANCHOR_VERTICAL_OFFSET };
}

export async function buildLassoResult(
  allFeatures: GeoJsonFeature[],
  polygon: Coordinate[],
  opts: {
    dimension?: string;
    hiddenCategoryKeys?: Set<string>;
  },
): Promise<{ selected: GeoJsonFeature[]; anchorGeoCoord: Coordinate | null }> {
  const { dimension, hiddenCategoryKeys } = opts;

  // Filter out features whose category is hidden in the legend
  const visibleFeatures =
    hiddenCategoryKeys && hiddenCategoryKeys.size > 0 && dimension
      ? allFeatures.filter(f => {
          const raw = f.categoryName ?? f.properties?.[dimension];
          if (raw == null) return true;
          return !hiddenCategoryKeys.has(normalizeCategoryKey(raw));
        })
      : allFeatures;

  const selected = await filterFeaturesInLasso(visibleFeatures, polygon);

  // Return the last polygon coordinate as the anchor — callers project it
  // to screen space on every render so the bar tracks pan/zoom.
  const anchorGeoCoord: Coordinate | null = polygon[polygon.length - 1] ?? null;

  return { selected, anchorGeoCoord };
}

/**
 * Shared handler for the onPolygonComplete callback used by both Multi.tsx
 * and GeoSetLayer.tsx.  Runs `buildLassoResult` with staleness protection
 * so a reset during async filtering is safe.
 */
export async function handleLassoPolygonComplete(
  polygon: Coordinate[],
  features: GeoJsonFeature[],
  opts: { dimension?: string; hiddenCategoryKeys?: Set<string> },
  requestIdRef: { current: number },
  callbacks: {
    setSelectedFeatures: (features: GeoJsonFeature[]) => void;
    setAnchorGeoCoord: (coord: Coordinate | null) => void;
  },
): Promise<void> {
  const requestId = ++requestIdRef.current;

  const { selected, anchorGeoCoord } = await buildLassoResult(
    features,
    polygon,
    opts,
  );

  // Discard if the user reset the lasso while filtering was in progress
  if (requestIdRef.current !== requestId) return;

  callbacks.setSelectedFeatures(selected);
  if (anchorGeoCoord) callbacks.setAnchorGeoCoord(anchorGeoCoord);
}
