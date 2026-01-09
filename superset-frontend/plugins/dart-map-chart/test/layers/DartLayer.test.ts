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
import { GeoJsonFeature } from '../../src/types';

/**
 * Helper function that replicates the sorting logic from DartLayer.tsx
 * for testing purposes. This matches the implementation at lines 332-357.
 */
function sortFeaturesByCategoryOrder(
  features: GeoJsonFeature[],
  categories: Record<string, unknown>,
  dimension: string | undefined,
  isMetric: boolean,
): GeoJsonFeature[] {
  const categoryKeys = Object.keys(categories);
  const UNCATEGORIZED_INDEX = Number.MAX_SAFE_INTEGER;

  return [...features].sort((a, b) => {
    if (isMetric) return 0; // Don't sort in metric mode

    const getCategoryIndex = (f: GeoJsonFeature): number => {
      const categoryRaw =
        (f as any).categoryName ?? f.properties?.[dimension as string];
      if (categoryRaw == null) return UNCATEGORIZED_INDEX; // Put uncategorized at bottom (drawn first)

      const lookupKey =
        typeof categoryRaw === 'string'
          ? categoryRaw.trim().toLowerCase()
          : String(categoryRaw).trim().toLowerCase();

      const idx = categoryKeys.indexOf(lookupKey);
      return idx === -1 ? UNCATEGORIZED_INDEX : idx; // Unknown categories also at bottom
    };

    // Reverse order: higher index drawn first (bottom), lower index drawn last (top)
    return getCategoryIndex(b) - getCategoryIndex(a);
  });
}

describe('DartLayer feature sorting by category order', () => {
  const createFeature = (
    category: string | null,
    id: string,
  ): GeoJsonFeature => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: { category, id },
    color: [255, 0, 0, 255],
  });

  describe('sortFeaturesByCategoryOrder', () => {
    it('should sort features so earlier categories in config render on top (last in array)', () => {
      // Categories ordered: apple, mango, zebra
      // Features should be sorted so zebra comes first (bottom), apple comes last (top)
      const categories = {
        apple: { enabled: true },
        mango: { enabled: true },
        zebra: { enabled: true },
      };

      const features: GeoJsonFeature[] = [
        createFeature('mango', '1'),
        createFeature('apple', '2'),
        createFeature('zebra', '3'),
      ];

      const sorted = sortFeaturesByCategoryOrder(
        features,
        categories,
        'category',
        false,
      );

      // zebra (index 2) should be first (drawn first = bottom)
      // mango (index 1) should be second
      // apple (index 0) should be last (drawn last = top)
      expect(sorted[0].properties.category).toBe('zebra');
      expect(sorted[1].properties.category).toBe('mango');
      expect(sorted[2].properties.category).toBe('apple');
    });

    it('should place uncategorized features at the beginning (drawn first = bottom)', () => {
      // Uncategorized items get MAX_SAFE_INTEGER index, so they sort to the
      // BEGINNING of the array (highest index = drawn first = visually at bottom).
      const categories = {
        apple: { enabled: true },
        mango: { enabled: true },
      };

      const features: GeoJsonFeature[] = [
        createFeature('apple', '1'),
        createFeature(null, '2'), // uncategorized
        createFeature('mango', '3'),
      ];

      const sorted = sortFeaturesByCategoryOrder(
        features,
        categories,
        'category',
        false,
      );

      // Uncategorized (MAX_SAFE_INTEGER) should be first (drawn first = bottom)
      expect(sorted[0].properties.category).toBe(null);
      // mango (index 1) should be second
      expect(sorted[1].properties.category).toBe('mango');
      // apple (index 0) should be last (drawn last = top)
      expect(sorted[2].properties.category).toBe('apple');
    });

    it('should not sort features in metric mode', () => {
      const categories = {
        apple: { enabled: true },
        mango: { enabled: true },
        zebra: { enabled: true },
      };

      const features: GeoJsonFeature[] = [
        createFeature('mango', '1'),
        createFeature('apple', '2'),
        createFeature('zebra', '3'),
      ];

      const sorted = sortFeaturesByCategoryOrder(
        features,
        categories,
        'category',
        true, // isMetric = true
      );

      // Order should be preserved (stable sort with all 0 comparisons)
      expect(sorted[0].properties.id).toBe('1');
      expect(sorted[1].properties.id).toBe('2');
      expect(sorted[2].properties.id).toBe('3');
    });

    it('should handle case-insensitive category matching', () => {
      const categories = {
        apple: { enabled: true },
        mango: { enabled: true },
      };

      const features: GeoJsonFeature[] = [
        createFeature('APPLE', '1'),
        createFeature('Mango', '2'),
      ];

      const sorted = sortFeaturesByCategoryOrder(
        features,
        categories,
        'category',
        false,
      );

      // mango (index 1) should be first (bottom)
      // apple (index 0) should be last (top)
      expect(sorted[0].properties.category).toBe('Mango');
      expect(sorted[1].properties.category).toBe('APPLE');
    });

    it('should handle features not in categories at the beginning (drawn first = bottom)', () => {
      // Features not found in categories get MAX_SAFE_INTEGER index, same as uncategorized.
      // They sort to the beginning of the array (drawn first = visually at bottom).
      const categories = {
        apple: { enabled: true },
        mango: { enabled: true },
      };

      const features: GeoJsonFeature[] = [
        createFeature('apple', '1'),
        createFeature('unknown', '2'), // Not in categories, gets MAX_SAFE_INTEGER
        createFeature('mango', '3'),
      ];

      const sorted = sortFeaturesByCategoryOrder(
        features,
        categories,
        'category',
        false,
      );

      // unknown (MAX_SAFE_INTEGER) should be first (bottom)
      expect(sorted[0].properties.category).toBe('unknown');
      // mango (index 1) should be second
      expect(sorted[1].properties.category).toBe('mango');
      // apple (index 0) should be last (top)
      expect(sorted[2].properties.category).toBe('apple');
    });

    it('should use categoryName property if available', () => {
      const categories = {
        apple: { enabled: true },
        mango: { enabled: true },
      };

      const featureWithCategoryName: GeoJsonFeature = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: { category: 'mango', id: '1' },
        color: [255, 0, 0, 255],
      };
      (featureWithCategoryName as any).categoryName = 'apple'; // Override

      const features: GeoJsonFeature[] = [
        featureWithCategoryName,
        createFeature('mango', '2'),
      ];

      const sorted = sortFeaturesByCategoryOrder(
        features,
        categories,
        'category',
        false,
      );

      // Feature 1 should be treated as 'apple' (from categoryName), which is index 0
      // Feature 2 is 'mango', which is index 1
      // mango should be first (bottom), apple last (top)
      expect(sorted[0].properties.id).toBe('2'); // mango
      expect(sorted[1].properties.id).toBe('1'); // apple (via categoryName)
    });

    it('should handle empty features array', () => {
      const categories = {
        apple: { enabled: true },
      };

      const features: GeoJsonFeature[] = [];

      const sorted = sortFeaturesByCategoryOrder(
        features,
        categories,
        'category',
        false,
      );

      expect(sorted).toEqual([]);
    });

    it('should handle empty categories object', () => {
      const categories = {};

      const features: GeoJsonFeature[] = [
        createFeature('apple', '1'),
        createFeature('mango', '2'),
      ];

      const sorted = sortFeaturesByCategoryOrder(
        features,
        categories,
        'category',
        false,
      );

      // All features have index -1, so order depends on stable sort
      expect(sorted.length).toBe(2);
    });

    it('should maintain relative order of features in the same category', () => {
      const categories = {
        apple: { enabled: true },
        mango: { enabled: true },
      };

      const features: GeoJsonFeature[] = [
        createFeature('apple', '1'),
        createFeature('apple', '2'),
        createFeature('mango', '3'),
        createFeature('apple', '4'),
      ];

      const sorted = sortFeaturesByCategoryOrder(
        features,
        categories,
        'category',
        false,
      );

      // mango should come first (bottom)
      expect(sorted[0].properties.id).toBe('3');

      // All apple features should come after, maintaining relative order (stable sort)
      const appleFeatures = sorted.filter(
        f => f.properties.category === 'apple',
      );
      expect(appleFeatures.map(f => f.properties.id)).toEqual(['1', '2', '4']);
    });

    it('should handle whitespace in category names', () => {
      const categories = {
        apple: { enabled: true },
        mango: { enabled: true },
      };

      const features: GeoJsonFeature[] = [
        createFeature('  apple  ', '1'),
        createFeature('mango', '2'),
      ];

      const sorted = sortFeaturesByCategoryOrder(
        features,
        categories,
        'category',
        false,
      );

      // '  apple  ' should match 'apple' after trim
      expect(sorted[0].properties.category).toBe('mango');
      expect(sorted[1].properties.category).toBe('  apple  ');
    });
  });
});
