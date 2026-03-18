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
import { convertToGeoJSONFeature } from '../../src/utils/convertToGeoJson';

describe('convertToGeoJSONFeature', () => {
  it('returns null for null/undefined/falsy input', () => {
    expect(convertToGeoJSONFeature(null)).toBeNull();
    expect(convertToGeoJSONFeature(undefined)).toBeNull();
    expect(convertToGeoJSONFeature('')).toBeNull();
    expect(convertToGeoJSONFeature(0)).toBeNull();
  });

  it('passes through a valid GeoJSON Feature object', () => {
    const feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10, 20] },
      properties: { name: 'test' },
    };
    const result = convertToGeoJSONFeature(feature);

    expect(result).toBe(feature); // same reference
    expect(result!.type).toBe('Feature');
  });

  it('parses a stringified GeoJSON Feature', () => {
    const feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10, 20] },
      properties: {},
    };
    const result = convertToGeoJSONFeature(JSON.stringify(feature));

    expect(result).toEqual(feature);
  });

  it('returns null for invalid JSON string starting with {', () => {
    const result = convertToGeoJSONFeature('{invalid json}');

    // Falls through to WKT parsing, which also fails → null
    expect(result).toBeNull();
  });

  it('parses WKT POINT string', () => {
    const result = convertToGeoJSONFeature('POINT(10 20)');

    expect(result).not.toBeNull();
    expect(result!.type).toBe('Feature');
    expect(result!.geometry.type).toBe('Point');
    expect((result!.geometry as any).coordinates).toEqual([10, 20]);
    expect(result!.properties).toEqual({});
  });

  it('parses WKT POLYGON string', () => {
    const result = convertToGeoJSONFeature(
      'POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))',
    );

    expect(result).not.toBeNull();
    expect(result!.type).toBe('Feature');
    expect(result!.geometry.type).toBe('Polygon');
  });

  it('parses WKT LINESTRING', () => {
    const result = convertToGeoJSONFeature('LINESTRING(0 0, 10 10, 20 20)');

    expect(result).not.toBeNull();
    expect(result!.geometry.type).toBe('LineString');
  });

  it('returns null for unrecognized string', () => {
    const result = convertToGeoJSONFeature('random text');
    expect(result).toBeNull();
  });

  it('parses WKT MULTIPOINT string', () => {
    const result = convertToGeoJSONFeature('MULTIPOINT(10 20, 30 40)');

    expect(result).not.toBeNull();
    expect(result!.type).toBe('Feature');
    expect(result!.geometry.type).toBe('MultiPoint');
  });

  it('parses WKT MULTILINESTRING string', () => {
    const result = convertToGeoJSONFeature(
      'MULTILINESTRING((0 0, 1 1), (2 2, 3 3))',
    );

    expect(result).not.toBeNull();
    expect(result!.type).toBe('Feature');
    expect(result!.geometry.type).toBe('MultiLineString');
  });

  it('parses WKT MULTIPOLYGON string', () => {
    const result = convertToGeoJSONFeature(
      'MULTIPOLYGON(((0 0, 1 0, 1 1, 0 0)))',
    );

    expect(result).not.toBeNull();
    expect(result!.type).toBe('Feature');
    expect(result!.geometry.type).toBe('MultiPolygon');
  });

  it('returns null for a JSON string that is valid JSON but not a Feature', () => {
    // Valid JSON but no type/geometry
    const result = convertToGeoJSONFeature('{"name": "test"}');
    // Falls through JSON check (no .type/.geometry), then WKT fails → null
    expect(result).toBeNull();
  });
});
