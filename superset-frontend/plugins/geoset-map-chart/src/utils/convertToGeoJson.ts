/* eslint-disable no-console */
import wellknown from 'wellknown';

// Accepts WKT strings or GeoJSON or even parsed PostGIS geometries
export function convertToGeoJSONFeature(input: any): GeoJSON.Feature | null {
  if (!input) return null;

  // Case 1: Already valid GeoJSON
  if (typeof input === 'object' && input.type && input.geometry) {
    return input as GeoJSON.Feature;
  }

  // Case 2: Stringified GeoJSON
  if (typeof input === 'string' && input.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(input);
      if (parsed.type && parsed.geometry) {
        return parsed;
      }
    } catch {
      // Fall through
    }
  }

  // Case 3: WKT
  if (typeof input === 'string') {
    try {
      const geometry = wellknown.parse(input);
      if (geometry) {
        return {
          type: 'Feature',
          geometry,
          properties: {},
        };
      }
    } catch (e) {
      console.warn('WKT parse failed:', e);
    }
  }

  return null;
}
