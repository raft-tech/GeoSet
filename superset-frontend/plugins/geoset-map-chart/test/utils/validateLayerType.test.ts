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
import { validateLayerType } from '../../src/utils/validateLayerType';

describe('validateLayerType', () => {
  it('returns userLayerType when geometryType is undefined', () => {
    expect(validateLayerType('Polygon')).toBe('Polygon');
    expect(validateLayerType('GeoJSON')).toBe('GeoJSON');
  });

  it('returns TextOverlay regardless of geometry', () => {
    expect(validateLayerType('TextOverlay', 'Point')).toBe('TextOverlay');
    expect(validateLayerType('TextOverlay', 'Polygon')).toBe('TextOverlay');
  });

  it('returns GeoJSON when user selected GeoJSON', () => {
    expect(validateLayerType('GeoJSON', 'Point')).toBe('GeoJSON');
    expect(validateLayerType('GeoJSON', 'Polygon')).toBe('GeoJSON');
  });

  it('maps Point and MultiPoint to Point', () => {
    expect(validateLayerType('anything', 'Point')).toBe('Point');
    expect(validateLayerType('anything', 'MultiPoint')).toBe('Point');
  });

  it('maps Line geometry to Line', () => {
    expect(validateLayerType('anything', 'Line')).toBe('Line');
  });

  it('maps LineString and MultiLineString to LineString', () => {
    expect(validateLayerType('anything', 'LineString')).toBe('LineString');
    expect(validateLayerType('anything', 'MultiLineString')).toBe('LineString');
  });

  it('maps Polygon and MultiPolygon to Polygon', () => {
    expect(validateLayerType('anything', 'Polygon')).toBe('Polygon');
    expect(validateLayerType('anything', 'MultiPolygon')).toBe('Polygon');
  });

  it('maps GeometryCollection and FeatureCollection to GeoJSON', () => {
    expect(validateLayerType('anything', 'GeometryCollection')).toBe('GeoJSON');
    expect(validateLayerType('anything', 'FeatureCollection')).toBe('GeoJSON');
  });

  it('returns userLayerType for unknown geometry types', () => {
    expect(validateLayerType('Custom', 'Unknown')).toBe('Custom');
  });
});
