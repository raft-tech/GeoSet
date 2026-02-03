/* eslint-disable dot-notation */
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
import { QueryFormData } from '@superset-ui/core';
import { hexToRGB, getCategories, RGBAColor } from '../../src/utils/colors';
import { GeoJsonFeature } from '../../src/types';

describe('colors', () => {
  it('hexToRGB()', () => {
    expect(hexToRGB('#ffffff')).toEqual([255, 255, 255, 255]);
  });
});

describe('getCategories', () => {
  const mockFormData = {
    datasource: '1__table',
    viz_type: 'geoset_layer',
    dimension: 'category',
  } as unknown as QueryFormData;

  const fallbackColor: RGBAColor = [100, 100, 100, 255];

  const createFeature = (category: string | null): GeoJsonFeature => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: { category },
    color: [255, 0, 0, 255],
  });

  it('should return categories in customMapping order', () => {
    const features: GeoJsonFeature[] = [
      createFeature('zebra'),
      createFeature('apple'),
      createFeature('mango'),
    ];

    const customMapping = {
      apple: { fillColor: '#ff0000', legend_name: 'Apple' },
      mango: { fillColor: '#00ff00', legend_name: 'Mango' },
      zebra: { fillColor: '#0000ff', legend_name: 'Zebra' },
    };

    const result = getCategories(
      mockFormData,
      'category',
      fallbackColor,
      features,
      customMapping,
    );

    const keys = Object.keys(result);
    expect(keys).toEqual(['apple', 'mango', 'zebra']);
  });

  it('should place categories not in customMapping at the end', () => {
    const features: GeoJsonFeature[] = [
      createFeature('zebra'),
      createFeature('apple'),
      createFeature('unknown'),
      createFeature('mango'),
    ];

    const customMapping = {
      apple: { fillColor: '#ff0000', legend_name: 'Apple' },
      mango: { fillColor: '#00ff00', legend_name: 'Mango' },
      // zebra is NOT in customMapping, should appear at the end
    };

    const result = getCategories(
      mockFormData,
      'category',
      fallbackColor,
      features,
      customMapping,
    );

    const keys = Object.keys(result);
    // apple and mango first (in customMapping order), then zebra and unknown
    expect(keys.slice(0, 2)).toEqual(['apple', 'mango']);
    expect(keys.slice(2)).toContain('zebra');
    expect(keys.slice(2)).toContain('unknown');
  });

  it('should handle case-insensitive category matching', () => {
    const features: GeoJsonFeature[] = [
      createFeature('APPLE'),
      createFeature('Mango'),
      createFeature('zebra'),
    ];

    const customMapping = {
      apple: { fillColor: '#ff0000', legend_name: 'Apple' },
      MANGO: { fillColor: '#00ff00', legend_name: 'Mango' },
      Zebra: { fillColor: '#0000ff', legend_name: 'Zebra' },
    };

    const result = getCategories(
      mockFormData,
      'category',
      fallbackColor,
      features,
      customMapping,
    );

    const keys = Object.keys(result);
    expect(keys).toEqual(['apple', 'mango', 'zebra']);
  });

  it('should handle null categories with defaultLegendNames', () => {
    const features: GeoJsonFeature[] = [
      createFeature('apple'),
      createFeature(null),
    ];

    const customMapping = {
      apple: { fillColor: '#ff0000', legend_name: 'Apple' },
    };

    const result = getCategories(
      mockFormData,
      'category',
      fallbackColor,
      features,
      customMapping,
      ['Unknown Category'],
    );

    expect(result['__null__']).toBeDefined();
    expect(result['__null__'].legend_name).toBe('Unknown Category');
  });

  it('should return empty object when dimension is undefined', () => {
    const features: GeoJsonFeature[] = [createFeature('apple')];

    const result = getCategories(
      { ...mockFormData, dimension: undefined } as unknown as QueryFormData,
      undefined,
      fallbackColor,
      features,
    );

    expect(result).toEqual({});
  });

  it('should handle features with extraProps dimension values', () => {
    const featureWithExtraProps: GeoJsonFeature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { category: 'fromProperties' },
      extraProps: { category: 'fromExtraProps' },
      color: [255, 0, 0, 255],
    };

    const features: GeoJsonFeature[] = [featureWithExtraProps];

    const customMapping = {
      fromextraprops: { fillColor: '#ff0000', legend_name: 'Extra Props' },
    };

    const result = getCategories(
      mockFormData,
      'category',
      fallbackColor,
      features,
      customMapping,
    );

    // extraProps should take precedence over properties
    expect(Object.keys(result)).toContain('fromextraprops');
    expect(Object.keys(result)).not.toContain('fromproperties');
  });

  it('should deduplicate categories from multiple features', () => {
    const features: GeoJsonFeature[] = [
      createFeature('apple'),
      createFeature('apple'),
      createFeature('mango'),
      createFeature('apple'),
    ];

    const customMapping = {
      mango: { fillColor: '#00ff00', legend_name: 'Mango' },
      apple: { fillColor: '#ff0000', legend_name: 'Apple' },
    };

    const result = getCategories(
      mockFormData,
      'category',
      fallbackColor,
      features,
      customMapping,
    );

    const keys = Object.keys(result);
    expect(keys).toEqual(['mango', 'apple']);
    expect(keys.length).toBe(2);
  });

  it('should skip customMapping entries not present in features', () => {
    const features: GeoJsonFeature[] = [createFeature('apple')];

    const customMapping = {
      apple: { fillColor: '#ff0000', legend_name: 'Apple' },
      mango: { fillColor: '#00ff00', legend_name: 'Mango' }, // Not in features
      zebra: { fillColor: '#0000ff', legend_name: 'Zebra' }, // Not in features
    };

    const result = getCategories(
      mockFormData,
      'category',
      fallbackColor,
      features,
      customMapping,
    );

    const keys = Object.keys(result);
    expect(keys).toEqual(['apple']);
    expect(keys).not.toContain('mango');
    expect(keys).not.toContain('zebra');
  });

  it('should work without customMapping', () => {
    const features: GeoJsonFeature[] = [
      createFeature('zebra'),
      createFeature('apple'),
      createFeature('mango'),
    ];

    const result = getCategories(
      mockFormData,
      'category',
      fallbackColor,
      features,
      undefined,
    );

    const keys = Object.keys(result);
    // Without customMapping, order depends on feature iteration order
    expect(keys.length).toBe(3);
    expect(keys).toContain('apple');
    expect(keys).toContain('mango');
    expect(keys).toContain('zebra');
  });
});
