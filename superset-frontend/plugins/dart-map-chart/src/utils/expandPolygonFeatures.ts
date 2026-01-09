import {
  Feature,
  Geometry,
  GeoJsonProperties,
  Polygon,
  MultiPolygon,
} from 'geojson';
import getPointsFromPolygon from './getPointsFromPolygon';

/**
 * Flattens MultiPolygon features into individual polygon records,
 * preserving all properties for Deck.gl’s PolygonLayer.
 */
export function expandPolygonFeatures(
  features: Feature<Geometry, GeoJsonProperties>[],
) {
  const polygons: { polygon: number[][][]; properties: GeoJsonProperties }[] =
    [];

  for (const feature of features) {
    const geom = feature.geometry;
    if (!geom) continue;

    // Use the helper you already have
    const coords = getPointsFromPolygon(
      feature as Feature<Polygon | MultiPolygon>,
    );

    if (!Array.isArray(coords) || !coords.length) continue;

    const base = {
      ...feature, // keep color, strokeColor, extraProps, etc.
      properties: feature.properties || {},
    };

    // If it's a MultiPolygon (4D array), split it up
    if (Array.isArray(coords[0][0][0])) {
      for (const polygon of coords as number[][][][]) {
        polygons.push({
          ...base,
          polygon,
        });
      }
    } else {
      polygons.push({
        ...base,
        polygon: coords as number[][][],
      });
    }
  }

  return polygons;
}
