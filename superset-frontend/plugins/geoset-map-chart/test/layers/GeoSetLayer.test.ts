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
import { GeoJsonFeature } from '../../src/types';

// Import after mocks
import {
  getLayer,
  getLayerStates,
} from '../../src/layers/GeoSetLayer/GeoSetLayer';

// ── DeckGL layer mocks ──
// jest.mock factories can only reference variables prefixed with "mock".
function mockMakeLayer(name: string) {
  return class {
    static __mockName = name;

    id: string;

    props: any;

    constructor(props: any) {
      this.id = props.id;
      this.props = props;
    }
  };
}

jest.mock('@deck.gl/layers', () => ({
  GeoJsonLayer: mockMakeLayer('GeoJsonLayer'),
  ScatterplotLayer: mockMakeLayer('ScatterplotLayer'),
  IconLayer: mockMakeLayer('IconLayer'),
  LineLayer: mockMakeLayer('LineLayer'),
  PathLayer: mockMakeLayer('PathLayer'),
}));

jest.mock('@deck.gl/extensions', () => ({
  PathStyleExtension: class {
    opts: any;

    constructor(opts: any) {
      this.opts = opts;
    }
  },
}));

jest.mock('../../src/layers/PointClusterLayer', () => ({
  PointClusterLayer: mockMakeLayer('PointClusterLayer'),
}));

jest.mock('../../src/layers/common', () => ({
  commonLayerProps: () => ({ pickable: true, onHover: jest.fn() }),
}));

jest.mock('../../src/DeckGLContainer', () => ({
  DeckGLContainerHandle: {},
  DeckGLContainerStyledWrapper: 'div',
}));

jest.mock('react-map-gl', () => ({}));
jest.mock('@deck.gl/react', () => ({ __esModule: true, default: 'div' }));
jest.mock('@deck.gl/core', () => ({ Layer: class {} }));

jest.mock('../../src/utils/sandbox', () => ({
  __esModule: true,
  default: (code: string) => () => code,
}));

// Shared SVG icon mocks — see test/mocks/svgIcons.ts
import '../mocks/svgIcons';

jest.mock('../../src/utils/layerBuilders/buildTextOverlayLayer', () => ({
  buildTextOverlayLayer: (opts: any) => ({
    type: 'TextOverlayLayer',
    ...opts,
  }),
}));

jest.mock('../../src/utils/layerBuilders/expandPolygonFeatures', () => ({
  expandPolygonFeatures: (features: any) => ({
    expanded: true,
    features,
  }),
}));

jest.mock('../../src/utils/layerBuilders/buildPolygonLayers', () => ({
  buildPolygonLayers: (data: any, _raw: any, opts: any) => ({
    type: 'PolygonLayers',
    data,
    opts,
  }),
  polygonDataCache: new Map(),
}));

jest.mock('../../src/utils/mapboxApi', () => ({
  fetchMapboxApiKey: jest.fn(),
  getCachedMapboxApiKey: jest.fn(),
}));

jest.mock('../../src/utils/migrationApi', () => ({
  handleSchemaCheck: jest.fn(),
}));

jest.mock('../../src/utils/liveViewportStore', () => ({
  setLiveViewport: jest.fn(),
}));

// ── Helpers ──
function makeFeature(
  category: string | null,
  id: string,
  geometryType = 'Point',
  coords: any = [0, 0],
): GeoJsonFeature {
  return {
    type: 'Feature',
    geometry: { type: geometryType, coordinates: coords },
    properties: { category, id },
    color: [255, 0, 0, 255],
  };
}

function makePayload(features: GeoJsonFeature[] = []) {
  return {
    data: {
      type: 'FeatureCollection',
      features,
    },
  };
}

const baseFd: Partial<QueryFormData> = {
  slice_id: 1,
  filled: true,
  stroked: true,
  extruded: false,
  lineWidth: 1,
  geoJsonLayer: 'GeoJSON',
};

const baseCategories: Record<string, { color: number[]; enabled: boolean }> = {
  apple: { color: [255, 0, 0, 255], enabled: true },
  mango: { color: [0, 255, 0, 255], enabled: true },
};

const noopSetTooltip = jest.fn();
const noopOnAddFilter = jest.fn();

// ── Tests ──

describe('getLayerStates', () => {
  it('returns empty array for null layers', () => {
    expect(getLayerStates(null, { minZoom: 0, maxZoom: 22 })).toEqual([]);
  });

  it('wraps a single layer in an array', () => {
    const layer = { id: 'test-layer' } as any;
    const result = getLayerStates(layer, { minZoom: 2, maxZoom: 18 });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'test-layer',
      layer,
      options: { minZoom: 2, maxZoom: 18 },
    });
  });

  it('handles an array of layers', () => {
    const layers = [{ id: 'a' }, { id: 'b' }] as any[];
    const result = getLayerStates(layers, { minZoom: 0, maxZoom: 22 });
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a');
    expect(result[1].id).toBe('b');
  });
});

describe('getLayer', () => {
  describe('returns null for empty/missing features', () => {
    it('returns null when payload has no features', () => {
      const result = getLayer(
        baseFd as QueryFormData,
        { data: {} },
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
      );
      expect(result).toBeNull();
    });

    it('returns null when features array is empty', () => {
      const result = getLayer(
        baseFd as QueryFormData,
        makePayload([]),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
      );
      expect(result).toBeNull();
    });
  });

  describe('GeoJSON layer (default)', () => {
    it('creates a GeoJsonLayer for default layer type', () => {
      const features = [makeFeature('apple', '1')];
      const result = getLayer(
        baseFd as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
      );
      // eslint-disable-next-line no-underscore-dangle
      expect((result as any).constructor.__mockName).toBe('GeoJsonLayer');
      expect((result as any).id).toContain('geojson-layer');
    });

    it('passes fill and stroke color accessors', () => {
      const features = [makeFeature('apple', '1')];
      const result = getLayer(
        baseFd as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
      ) as any;
      expect(typeof result.props.getFillColor).toBe('function');
      expect(typeof result.props.getLineColor).toBe('function');
    });

    it('getFillColor returns feature color when present', () => {
      const features = [makeFeature('apple', '1')];
      const result = getLayer(
        baseFd as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
      ) as any;
      const feature = { color: [10, 20, 30, 255] };
      expect(result.props.getFillColor(feature)).toEqual([10, 20, 30, 255]);
    });
  });

  describe('Point layer', () => {
    const pointFd = { ...baseFd, geoJsonLayer: 'Point' };

    it('creates ScatterplotLayer for points without icon or clustering', () => {
      const features = [makeFeature('apple', '1', 'Point')];
      const result = getLayer(
        pointFd as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
        { dimension: 'category' },
      );
      // eslint-disable-next-line no-underscore-dangle
      expect((result as any).constructor.__mockName).toBe('ScatterplotLayer');
    });

    it('creates IconLayer when pointType is provided', () => {
      const features = [makeFeature('apple', '1', 'Point')];
      const result = getLayer(
        pointFd as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
        { pointType: 'star-icon', dimension: 'category' },
      );
      // eslint-disable-next-line no-underscore-dangle
      expect((result as any).constructor.__mockName).toBe('IconLayer');
    });

    it('creates PointClusterLayer when clustering is enabled', () => {
      const features = [makeFeature('apple', '1', 'Point')];
      const result = getLayer(
        { ...pointFd, enableClustering: true } as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
        { dimension: 'category' },
      );
      // eslint-disable-next-line no-underscore-dangle
      expect((result as any).constructor.__mockName).toBe('PointClusterLayer');
    });

    it('uses pointSize for scatterplot radius', () => {
      const features = [makeFeature('apple', '1', 'Point')];
      const result = getLayer(
        pointFd as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
        { pointSize: 10, dimension: 'category' },
      ) as any;
      // getRadius returns a static function when no dynamic sizes
      expect(result.props.getRadius()).toBe(10);
    });

    it('skips clustering in metric mode', () => {
      const features = [makeFeature('apple', '1', 'Point')];
      const result = getLayer(
        { ...pointFd, enableClustering: true } as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
        { metric: { valueColumn: 'val' } as any, dimension: 'category' },
      );
      // In metric mode, clustering is skipped — falls through to ScatterplotLayer
      // eslint-disable-next-line no-underscore-dangle
      expect((result as any).constructor.__mockName).toBe('ScatterplotLayer');
    });
  });

  describe('Line layer', () => {
    it('creates LineLayer for Line geometry type', () => {
      const features = [
        makeFeature('apple', '1', 'Line', [
          [0, 0],
          [1, 1],
        ]),
      ];
      const result = getLayer(
        { ...baseFd, geoJsonLayer: 'Line' } as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
      );
      // eslint-disable-next-line no-underscore-dangle
      expect((result as any).constructor.__mockName).toBe('LineLayer');
    });

    it('applies dashed style when lineStyle is dashed', () => {
      const features = [
        makeFeature('apple', '1', 'Line', [
          [0, 0],
          [1, 1],
        ]),
      ];
      const result = getLayer(
        { ...baseFd, geoJsonLayer: 'Line' } as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
        { lineStyle: 'dashed' },
      ) as any;
      expect(result.props.getDashArray).toEqual([10, 5]);
    });
  });

  describe('LineString layer', () => {
    it('creates PathLayer for LineString type', () => {
      const features = [
        makeFeature('apple', '1', 'LineString', [
          [0, 0],
          [1, 1],
          [2, 2],
        ]),
      ];
      const result = getLayer(
        { ...baseFd, geoJsonLayer: 'LineString' } as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
      );
      // eslint-disable-next-line no-underscore-dangle
      expect((result as any).constructor.__mockName).toBe('PathLayer');
    });
  });

  describe('Polygon layer', () => {
    it('delegates to buildPolygonLayers', () => {
      const features = [
        makeFeature('apple', '1', 'Polygon', [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ]),
      ];
      const result = getLayer(
        { ...baseFd, geoJsonLayer: 'Polygon' } as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
      ) as any;
      expect(result.type).toBe('PolygonLayers');
      expect(result.data.expanded).toBe(true);
    });
  });

  describe('TextOverlay layer', () => {
    it('delegates to buildTextOverlayLayer', () => {
      const features = [makeFeature('apple', '1')];
      const result = getLayer(
        { ...baseFd, geoJsonLayer: 'TextOverlay' } as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
      ) as any;
      expect(result.type).toBe('TextOverlayLayer');
    });
  });

  describe('unrecognized layer type (default branch)', () => {
    it('falls back to GeoJsonLayer for an unrecognized geoJsonLayer value', () => {
      // Use an unrecognized geometry type so validateLayerType passes
      // the layer type through unchanged (rather than overriding to Point, etc.)
      const features = [makeFeature('apple', '1', 'Custom', [0, 0])];
      const result = getLayer(
        { ...baseFd, geoJsonLayer: 'Heatmap' } as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
      );
      // eslint-disable-next-line no-underscore-dangle
      expect((result as any).constructor.__mockName).toBe('GeoJsonLayer');
    });
  });

  describe('category filtering', () => {
    it('filters out features with disabled categories', () => {
      const features = [
        makeFeature('apple', '1'),
        makeFeature('mango', '2'),
        makeFeature('apple', '3'),
      ];
      const categories = {
        apple: { color: [255, 0, 0, 255], enabled: true },
        mango: { color: [0, 255, 0, 255], enabled: false },
      };
      const result = getLayer(
        baseFd as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        categories,
        { dimension: 'category' },
      ) as any;

      // The GeoJsonLayer should only receive features with enabled categories
      const { data } = result.props;
      expect(data.every((f: any) => f.properties.category !== 'mango')).toBe(
        true,
      );
      expect(data).toHaveLength(2);
    });

    it('returns null when all features are filtered out', () => {
      const features = [makeFeature('apple', '1')];
      const categories = {
        apple: { color: [255, 0, 0, 255], enabled: false },
      };
      const result = getLayer(
        baseFd as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        categories,
        { dimension: 'category' },
      );
      expect(result).toBeNull();
    });

    it('keeps uncategorized features when some categories are disabled', () => {
      const features = [
        makeFeature('apple', '1'),
        makeFeature(null, '2'), // uncategorized
      ];
      const categories = {
        apple: { color: [255, 0, 0, 255], enabled: false },
      };
      const result = getLayer(
        baseFd as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        categories,
        { dimension: 'category' },
      ) as any;
      // Uncategorized features are kept
      expect(result.props.data).toHaveLength(1);
      expect(result.props.data[0].properties.category).toBeNull();
    });
  });

  describe('category sorting', () => {
    // deck.gl draws features in array order: index 0 is drawn first (bottom
    // of the visual stack) and the last element is drawn on top.  Sorting
    // places higher-priority categories (lower config index) at the END of
    // the array so they render on top of lower-priority ones.
    it('sorts features so earlier categories render on top (last in array)', () => {
      const features = [makeFeature('mango', '1'), makeFeature('apple', '2')];
      const result = getLayer(
        baseFd as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
        { dimension: 'category' },
      ) as any;

      const { data } = result.props;
      // mango (index 1) should come first (drawn at bottom)
      // apple (index 0) should come last (drawn on top)
      expect(data[0].properties.category).toBe('mango');
      expect(data[1].properties.category).toBe('apple');
    });
  });

  describe('metric mode', () => {
    it('skips category sorting and filtering in metric mode', () => {
      const features = [makeFeature('mango', '1'), makeFeature('apple', '2')];
      const categories = {
        apple: { color: [255, 0, 0, 255], enabled: false },
        mango: { color: [0, 255, 0, 255], enabled: true },
      };
      const result = getLayer(
        baseFd as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        categories,
        { metric: { valueColumn: 'val' } as any, dimension: 'category' },
      ) as any;

      // In metric mode, all features are preserved regardless of enabled state
      expect(result.props.data).toHaveLength(2);
      // Order is preserved (no sorting)
      expect(result.props.data[0].properties.id).toBe('1');
      expect(result.props.data[1].properties.id).toBe('2');
    });
  });

  describe('picking and tooltips', () => {
    it('enables picking when hover columns are provided', () => {
      const features = [makeFeature('apple', '1')];
      const result = getLayer(
        baseFd as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
        {},
        ['category', 'id'],
      ) as any;
      expect(result.props.pickable).toBe(true);
    });

    it('enables picking when onFeatureClick is provided', () => {
      const features = [makeFeature('apple', '1')];
      const onFeatureClick = jest.fn();
      const result = getLayer(
        baseFd as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
        {},
        undefined,
        onFeatureClick,
      ) as any;
      expect(result.props.pickable).toBe(true);
      expect(result.props.onClick).toBe(onFeatureClick);
    });
  });

  describe('recurseGeoJson (tested through getLayer)', () => {
    it('flattens nested FeatureCollection', () => {
      const payload = {
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [1, 2] },
              properties: { name: 'A' },
            },
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [3, 4] },
              properties: { name: 'B' },
            },
          ],
        },
      };
      const result = getLayer(
        baseFd as QueryFormData,
        payload,
        noopOnAddFilter,
        noopSetTooltip,
        {},
      ) as any;
      expect(result.props.data).toHaveLength(2);
    });

    it('applies fillColor propOverride to features', () => {
      const payload = {
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [0, 0] },
              properties: {},
            },
          ],
        },
      };
      const result = getLayer(
        {
          ...baseFd,
          fillColorPicker: { r: 100, g: 200, b: 50, a: 1 },
        } as QueryFormData,
        payload,
        noopOnAddFilter,
        noopSetTooltip,
        {},
        { fillColor: [100, 200, 50, 255] },
      ) as any;
      // Feature should get the fillColor as its color
      const feature = result.props.data[0];
      expect(feature.color).toBeDefined();
    });

    it('handles deeply nested FeatureCollections', () => {
      const payload = {
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: { type: 'Point', coordinates: [0, 0] },
                  properties: { nested: true },
                },
              ],
            },
          ],
        },
      };
      const result = getLayer(
        baseFd as QueryFormData,
        payload,
        noopOnAddFilter,
        noopSetTooltip,
        {},
      ) as any;
      expect(result.props.data).toHaveLength(1);
      expect(result.props.data[0].properties.nested).toBe(true);
    });
  });

  describe('alterProps (tested through getLayer)', () => {
    it('maps color property aliases to fillColor', () => {
      const payload = {
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [0, 0] },
              properties: { color: [10, 20, 30, 255] },
            },
          ],
        },
      };
      const result = getLayer(
        baseFd as QueryFormData,
        payload,
        noopOnAddFilter,
        noopSetTooltip,
        {},
      ) as any;
      const props = result.props.data[0].properties;
      // 'color' should be remapped to 'fillColor'
      expect(props.fillColor).toBeDefined();
      expect(props.color).toBeUndefined();
    });

    it('maps stroke-color alias to strokeColor', () => {
      const payload = {
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [0, 0] },
              properties: { 'stroke-color': [50, 60, 70, 255] },
            },
          ],
        },
      };
      const result = getLayer(
        baseFd as QueryFormData,
        payload,
        noopOnAddFilter,
        noopSetTooltip,
        {},
      ) as any;
      const props = result.props.data[0].properties;
      expect(props.strokeColor).toBeDefined();
      expect(props['stroke-color']).toBeUndefined();
    });
  });

  describe('line color behavior', () => {
    it('uses fillColor for lines when dimension is set', () => {
      const features = [
        makeFeature('apple', '1', 'Line', [
          [0, 0],
          [1, 1],
        ]),
      ];
      const result = getLayer(
        { ...baseFd, geoJsonLayer: 'Line' } as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
        { dimension: 'category' },
      ) as any;
      const { getColor } = result.props;
      const feature = {
        color: [10, 20, 30, 255],
        strokeColor: [50, 60, 70, 255],
      };
      // With dimension set, should use feature.color (fillColor), not strokeColor
      expect(getColor(feature)).toEqual([10, 20, 30, 255]);
    });

    it('uses strokeColor for lines when no dimension or metric', () => {
      const features = [
        makeFeature('apple', '1', 'Line', [
          [0, 0],
          [1, 1],
        ]),
      ];
      const result = getLayer(
        { ...baseFd, geoJsonLayer: 'Line' } as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
        {},
      ) as any;
      const { getColor } = result.props;
      const feature = {
        color: [10, 20, 30, 255],
        strokeColor: [50, 60, 70, 255],
      };
      expect(getColor(feature)).toEqual([50, 60, 70, 255]);
    });
  });

  describe('dynamic sizing', () => {
    it('uses dynamic getRadius when features have sizeValue', () => {
      const features = [
        { ...makeFeature('apple', '1', 'Point'), sizeValue: 20 },
      ];
      const result = getLayer(
        { ...baseFd, geoJsonLayer: 'Point' } as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
        { pointSize: 5, dimension: 'category' },
      ) as any;
      // With sizeValue present, getRadius should be dynamic
      expect(result.props.getRadius(features[0])).toBe(20);
    });

    it('uses dynamic getSize for icons when features have sizeValue', () => {
      const features = [
        { ...makeFeature('apple', '1', 'Point'), sizeValue: 15 },
      ];
      const result = getLayer(
        { ...baseFd, geoJsonLayer: 'Point' } as QueryFormData,
        makePayload(features),
        noopOnAddFilter,
        noopSetTooltip,
        baseCategories,
        { pointType: 'star-icon', pointSize: 5, dimension: 'category' },
      ) as any;
      expect(result.props.getSize(features[0])).toBe(15);
    });
  });
});

// ── Sorting helper tests (existing) ──

/**
 * Helper function that replicates the sorting logic from GeoSetLayer.tsx
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

describe('GeoSetLayer feature sorting by category order', () => {
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
    // Category index in the config object determines draw priority:
    //   - Lower index → drawn last → visually on top
    //   - Higher index → drawn first → visually on bottom
    // The sort reverses by index so the highest-priority category ends up
    // at the end of the array (drawn last by deck.gl).
    it('should sort features so earlier categories in config render on top (last in array)', () => {
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

      expect(sorted[0].properties.category).toBe('zebra');
      expect(sorted[1].properties.category).toBe('mango');
      expect(sorted[2].properties.category).toBe('apple');
    });

    // Uncategorized features receive MAX_SAFE_INTEGER as their sort index,
    // which places them at the beginning of the sorted array (drawn first
    // by deck.gl = bottom of the visual stack).
    it('should place uncategorized features at the beginning (drawn first = bottom)', () => {
      const categories = {
        apple: { enabled: true },
        mango: { enabled: true },
      };

      const features: GeoJsonFeature[] = [
        createFeature('apple', '1'),
        createFeature(null, '2'),
        createFeature('mango', '3'),
      ];

      const sorted = sortFeaturesByCategoryOrder(
        features,
        categories,
        'category',
        false,
      );

      expect(sorted[0].properties.category).toBe(null);
      expect(sorted[1].properties.category).toBe('mango');
      expect(sorted[2].properties.category).toBe('apple');
    });

    // In metric mode, sorting is skipped entirely — features stay in their
    // original order.  This preserves whatever ordering the backend returned.
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
        true,
      );

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

      expect(sorted[0].properties.category).toBe('Mango');
      expect(sorted[1].properties.category).toBe('APPLE');
    });

    it('should handle features not in categories at the beginning (drawn first = bottom)', () => {
      const categories = {
        apple: { enabled: true },
        mango: { enabled: true },
      };

      const features: GeoJsonFeature[] = [
        createFeature('apple', '1'),
        createFeature('unknown', '2'),
        createFeature('mango', '3'),
      ];

      const sorted = sortFeaturesByCategoryOrder(
        features,
        categories,
        'category',
        false,
      );

      expect(sorted[0].properties.category).toBe('unknown');
      expect(sorted[1].properties.category).toBe('mango');
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
      (featureWithCategoryName as any).categoryName = 'apple';

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

      expect(sorted[0].properties.id).toBe('2');
      expect(sorted[1].properties.id).toBe('1');
    });

    it('should handle empty features array', () => {
      const categories = {
        apple: { enabled: true },
      };

      const sorted = sortFeaturesByCategoryOrder(
        [],
        categories,
        'category',
        false,
      );
      expect(sorted).toEqual([]);
    });

    it('should handle empty categories object', () => {
      const features: GeoJsonFeature[] = [
        createFeature('apple', '1'),
        createFeature('mango', '2'),
      ];

      const sorted = sortFeaturesByCategoryOrder(
        features,
        {},
        'category',
        false,
      );
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

      expect(sorted[0].properties.id).toBe('3');
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

      expect(sorted[0].properties.category).toBe('mango');
      expect(sorted[1].properties.category).toBe('  apple  ');
    });
  });
});
