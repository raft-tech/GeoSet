import {
  Feature,
  Geometry,
  GeoJsonProperties,
  Polygon,
  MultiPolygon,
} from 'geojson';
import getPointsFromPolygon from './getPointsFromPolygon';

export type ExpandedPolygon = {
  polygon: number[][][];
  properties: GeoJsonProperties;
  color?: number[];
  strokeColor?: number[];
  extraProps?: Record<string, unknown>;
};

// Cache for expanded polygon features - uses WeakMap to allow GC when features change
const expandedPolygonsCache = new WeakMap<
  Feature<Geometry, GeoJsonProperties>[],
  ExpandedPolygon[]
>();

/**
 * Flattens MultiPolygon features into individual polygon records,
 * preserving all properties for Deck.gl's SolidPolygonLayer.
 * Results are cached per features array reference for performance.
 */
export function expandPolygonFeatures(
  features: Feature<Geometry, GeoJsonProperties>[],
): ExpandedPolygon[] {
  // Check cache first
  const cached = expandedPolygonsCache.get(features);
  if (cached) {
    return cached;
  }

  // Create result array
  const polygons: ExpandedPolygon[] = [];

  features.forEach(feature => {
    const geom = feature.geometry;
    if (!geom) return;

    // Use the helper you already have
    const coords = getPointsFromPolygon(
      feature as Feature<Polygon | MultiPolygon>,
    );

    if (!Array.isArray(coords) || !coords.length) return;

    // Extract properties once, avoid repeated spread
    const props = feature.properties || {};
    const featureColor = (feature as any).color;
    const featureStrokeColor = (feature as any).strokeColor;
    const featureExtraProps = (feature as any).extraProps;

    // If it's a MultiPolygon (4D array), split it up
    if (Array.isArray(coords[0]?.[0]?.[0])) {
      const multiCoords = coords as number[][][][];
      multiCoords.forEach(polygon => {
        polygons.push({
          polygon,
          properties: props,
          color: featureColor,
          strokeColor: featureStrokeColor,
          extraProps: featureExtraProps,
        });
      });
    } else {
      polygons.push({
        polygon: coords as number[][][],
        properties: props,
        color: featureColor,
        strokeColor: featureStrokeColor,
        extraProps: featureExtraProps,
      });
    }
  });

  // Cache the result
  expandedPolygonsCache.set(features, polygons);

  return polygons;
}

