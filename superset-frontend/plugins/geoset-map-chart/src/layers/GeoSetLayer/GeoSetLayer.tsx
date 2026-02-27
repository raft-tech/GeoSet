/* eslint-disable no-console */
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
import { memo, useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  GeoJsonLayer,
  IconLayer,
  LineLayer,
  PathLayer,
  ScatterplotLayer,
} from '@deck.gl/layers';
import { PathStyleExtension } from '@deck.gl/extensions';
// ignoring the eslint error below since typescript prefers 'geojson' to '@types/geojson'
// eslint-disable-next-line import/no-unresolved
import { Feature, Geometry, GeoJsonProperties } from 'geojson';
import {
  t,
  styled,
  HandlerFunction,
  JsonObject,
  JsonValue,
  QueryFormData,
} from '@superset-ui/core';
import { Alert } from 'antd';
import Layer from '@deck.gl/core/dist/lib/layer';
import {
  DeckGLContainerHandle,
  DeckGLContainerStyledWrapper,
} from '../../DeckGLContainer';
import {
  ColorByValueConfig,
  getCategories,
  MetricLegend,
  normalizeCategoryColorMapping,
} from '../../utils/colors';
import sandboxedEval from '../../utils/sandbox';
import { commonLayerProps } from '../common';
import TooltipRow from '../../TooltipRow';
import { calculateAutozoomViewport, Viewport } from '../../utils/fitViewport';
import { TooltipProps } from '../../components/Tooltip';
import Legend from '../../components/Legend';
import MapControls from '../../components/MapControls';
import { GeoJsonFeature, LayerState } from '../../types';
import { useDebouncedValue } from '../../utils/hooks';
import { normalizeRGBA } from '../../utils/colorsFallback';
import { getColoredSvgUrl } from '../../utils/svgIcons';
import { PointClusterLayer } from '../PointClusterLayer';
import { validateLayerType } from '../../utilities/utils';
import { buildTextOverlayLayer } from '../../utils/layerBuilders/buildTextOverlayLayer';
import { expandPolygonFeatures } from '../../utils/layerBuilders/expandPolygonFeatures';
import {
  buildPolygonLayers,
  polygonDataCache,
} from '../../utils/layerBuilders/buildPolygonLayers';
import {
  fetchMapboxApiKey,
  getCachedMapboxApiKey,
} from '../../utils/mapboxApi';
import { handleSchemaCheck } from '../../utils/migrationApi';
import MeasureOverlay, { MeasureState } from '../../components/MeasureOverlay';
import { Coordinate } from '../../utils/measureDistance';
import { setLiveViewport } from '../../utils/liveViewportStore';
import ClickPopupBox, {
  ClickedFeatureInfo,
} from '../../components/ClickPopupBox';

const LimitWarning = styled.div`
  background-color: ${({ theme }) => theme.colorWarningBg};
  border: 1px solid ${({ theme }) => theme.colorWarning};
  border-radius: ${({ theme }) => theme.sizeUnit}px;
  color: ${({ theme }) => theme.colorWarningText};
  padding: 8px 12px;
  margin-top: 8px;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 2px 4px ${({ theme }) => theme.colorText}1A;

  &::before {
    content: '⚠';
    font-size: 16px;
  }
`;

const propertyMap = {
  fillColor: 'fillColor',
  color: 'fillColor',
  fill: 'fillColor',
  'fill-color': 'fillColor',
  fill_color_picker: 'fillColor',
  strokeColor: 'strokeColor',
  'stroke-color': 'strokeColor',
  stroke_color_picker: 'strokeColor',
  'stroke-width': 'strokeWidth',
};

const alterProps = (props: JsonObject = {}, propOverrides: JsonObject = {}) => {
  const newProps: JsonObject = {};
  Object.keys(props).forEach(k => {
    if (k in propertyMap) {
      newProps[propertyMap[k as keyof typeof propertyMap]] = props[k];
    } else {
      newProps[k] = props[k];
    }
  });
  // Normalize fillColor and strokeColor to RGBA arrays
  if (newProps.fillColor !== undefined) {
    newProps.fillColor = normalizeRGBA(newProps.fillColor);
  }
  if (newProps.strokeColor !== undefined) {
    newProps.strokeColor = normalizeRGBA(newProps.strokeColor);
  }

  return {
    ...newProps,
    ...propOverrides,
  };
};

const recurseGeoJson = (
  node: any,
  propOverrides: Record<string, any>,
  extraProps?: Record<string, any>,
): GeoJsonFeature[] => {
  const localFeatures: GeoJsonFeature[] = [];

  // Handle Features
  if (node?.features && Array.isArray(node.features)) {
    node.features.forEach((obj: any) => {
      const result = recurseGeoJson(
        obj,
        propOverrides,
        node.extraProps || extraProps,
      );
      if (Array.isArray(result)) {
        localFeatures.push(...result);
      } else {
        localFeatures.push(result);
      }
    });
    return localFeatures;
  }

  if (node?.type === 'Feature' && node?.geometry) {
    const alteredProps = alterProps(node.properties || {}, propOverrides);
    const enrichedFeature: GeoJsonFeature = {
      ...node,
      type: 'Feature',
      geometry: node.geometry as Geometry,
      color: node.color ?? propOverrides.fillColor,
      strokeColor: node.strokeColor ?? propOverrides.strokeColor,
      properties: alteredProps as GeoJsonProperties,
      extraProps,
    };
    // save dimension/category so we don't lose it in metric mode
    if (propOverrides.dimensionColumn) {
      (enrichedFeature as any).categoryName =
        alteredProps[propOverrides.dimensionColumn];
    }

    return [enrichedFeature];
  }
  return localFeatures;
};

function setTooltipContent(o: JsonObject, hoverColumnNames?: string[]) {
  const props = o.object?.properties;
  if (!props) return null;

  // If no hover columns specified, don't show tooltip
  if (!hoverColumnNames || hoverColumnNames.length === 0) {
    return null;
  }

  const content: JSX.Element[] = [];

  // Show only the columns the user selected in hover data
  Object.keys(props)
    .filter(key => hoverColumnNames.includes(key))
    .forEach((prop, index) => {
      content.push(
        <TooltipRow
          key={`prop-${index}`}
          label={`${prop}: `}
          value={`${props[prop]}`}
        />,
      );
    });

  return content.length === 0 ? null : (
    <div className="geoset-map-deckgl-tooltip">{content}</div>
  );
}

export function getLayer(
  formData: QueryFormData,
  payload: JsonObject,
  onAddFilter: HandlerFunction,
  setTooltip: (tooltip: TooltipProps['tooltip']) => void,
  categories: Record<string, { color: number[]; enabled: boolean }>,
  visualConfig: {
    dimension?: string;
    metric?: ColorByValueConfig;
    filled?: boolean;
    stroked?: boolean;
    extruded?: boolean;
    lineWidth?: number;
    fillColor?:
      | string
      | number[]
      | { r: number; g: number; b: number; a: number };
    strokeColor?:
      | string
      | number[]
      | { r: number; g: number; b: number; a: number };
    pointType?: string;
    pointSize?: number | string;
    lineStyle?: string;
    categoryColorMapping?: {};
    strokeColorMapping?: {};
  } = {},
  hoverColumnNames?: string[],
  onFeatureClick?: (info: any) => void,
) {
  const {
    filled,
    stroked,
    extruded,
    lineWidth,
    fillColor,
    strokeColor,
    pointType,
    pointSize,
    lineStyle,
    metric,
    dimension,
  } = visualConfig;

  const fd = formData;
  // Use JSON-config colors first
  const isMetric = Boolean(metric?.valueColumn);

  const fillColorArray = normalizeRGBA(fillColor || fd.fillColorPicker);
  const strokeColorArray = normalizeRGBA(strokeColor || fd.strokeColorPicker);

  const isDashed = lineStyle === 'dashed';

  // Create tooltip content generator with hover column filtering
  const tooltipContentGenerator = (o: JsonObject) =>
    setTooltipContent(o, hoverColumnNames);

  const hasHoverData =
    (hoverColumnNames && hoverColumnNames.length > 0) || Boolean(fd.js_tooltip);

  // Only enable picking when something actually needs it (hover tooltips or
  // click popup).  When pickable is false, deck.gl skips GPU picking entirely
  // — a significant per-frame saving for complex polygon layers.
  const needsPicking = hasHoverData || Boolean(onFeatureClick);
  const baseLayerProps = {
    ...commonLayerProps(fd, setTooltip, tooltipContentGenerator),
    pickable: needsPicking,
    // Only pick the exact pixel under the cursor (no search radius)
    pickingRadius: 0,
    ...(onFeatureClick ? { onClick: onFeatureClick } : {}),
    ...(hasHoverData ? {} : { onHover: undefined }),
  };

  // --- Fast path for Polygon layers with cached geometry ---
  // When only categories/colors change (not underlying data), we can skip ALL
  // expensive feature processing (recurseGeoJson, visibility map, sort, expand)
  // and reuse the cached polygon geometry with accessor-based coloring.
  const requestedLayerType = fd.geoJsonLayer || 'GeoJSON';
  const cachedPolygonData =
    requestedLayerType === 'Polygon'
      ? polygonDataCache.get(payload.data)
      : null;

  if (cachedPolygonData) {
    return buildPolygonLayers(cachedPolygonData, payload.data, {
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
    });
  }

  // --- Standard path: process features for all layer types ---
  const propOverrides: JsonObject = {};
  if (fillColorArray[3] > 0) propOverrides.fillColor = fillColorArray;
  if (strokeColorArray[3] > 0) propOverrides.strokeColor = strokeColorArray;

  const features =
    (recurseGeoJson(payload.data, propOverrides) as GeoJsonFeature[]) || [];
  if (!features.length) {
    return null;
  }

  let processedFeatures = features;
  if (fd.jsDataMutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.jsDataMutator);
    processedFeatures = jsFnMutator(processedFeatures) || processedFeatures;
  }

  // In metric mode, skip category visibility and sorting — color comes from
  // the metric value, not categories, so these operations are pure overhead.
  let sortedFeatures: GeoJsonFeature[];

  if (isMetric) {
    sortedFeatures = processedFeatures;
  } else {
    // Helper to normalize category keys for lookup
    const getCategoryKey = (f: GeoJsonFeature): string | null => {
      const categoryRaw =
        (f as any).categoryName ?? f.properties?.[dimension as string];
      if (categoryRaw == null) return null;
      return typeof categoryRaw === 'string'
        ? categoryRaw.trim().toLowerCase()
        : String(categoryRaw).trim().toLowerCase();
    };

    // Filter out features whose category is disabled (instead of making
    // them transparent) so deck.gl doesn't allocate GPU resources for them.
    const disabledCategoryKeys = new Set<string>(
      Object.entries(categories)
        .filter(([, cat]) => cat.enabled === false)
        .map(([key]) => key),
    );

    const visibleFeatures =
      disabledCategoryKeys.size > 0
        ? processedFeatures.filter(f => {
            const key = getCategoryKey(f);
            if (key == null) return true; // keep uncategorized
            return !disabledCategoryKeys.has(key);
          })
        : processedFeatures;

    // Sort features by category order for z-index rendering.
    // Categories earlier in the JSON config render on top (last in draw order).
    const categoryKeys = Object.keys(categories);
    const UNCATEGORIZED_INDEX = Number.MAX_SAFE_INTEGER;
    const categoryIndexMap = new Map(categoryKeys.map((k, i) => [k, i]));

    sortedFeatures = [...visibleFeatures].sort((a, b) => {
      const keyA = getCategoryKey(a);
      const keyB = getCategoryKey(b);
      const idxA =
        keyA != null
          ? (categoryIndexMap.get(keyA) ?? UNCATEGORIZED_INDEX)
          : UNCATEGORIZED_INDEX;
      const idxB =
        keyB != null
          ? (categoryIndexMap.get(keyB) ?? UNCATEGORIZED_INDEX)
          : UNCATEGORIZED_INDEX;

      // Reverse order: higher index drawn first (bottom), lower index drawn last (top)
      return idxB - idxA;
    });
  }

  // All features filtered out — nothing to render
  if (!sortedFeatures.length) return null;

  // validate which layer type to render
  let layerType = requestedLayerType;
  layerType = validateLayerType(
    layerType,
    processedFeatures[0]?.geometry?.type,
  );

  switch (layerType) {
    // POINTS -- uses PointClusterLayer for automatic clustering (unless disabled or metrics are applied)
    case 'Point': {
      const iconSize = Number(pointSize) || 5;
      // Check if clustering is enabled (default to false if not set)
      const clusteringEnabled = fd.enableClustering === true;

      // Skip clustering when metrics are applied (each point has unique color) or when disabled
      if (isMetric || !clusteringEnabled) {
        if (pointType) {
          let iconName = pointType.replace('-icon', '');
          if (!iconName) iconName = 'circle';

          return new IconLayer({
            id: `icon-layer-${fd.slice_id}-${sortedFeatures.length}`,
            data: sortedFeatures as Feature<Geometry, GeoJsonProperties>[],
            getIconColor: (f: any) => f.color,
            getPosition: (f: any) => f.geometry?.coordinates,
            getIcon: (f: any) => {
              const rgba = f.color || fillColorArray;
              const url = getColoredSvgUrl(iconName, rgba);
              return {
                url,
                width: 128,
                height: 128,
                anchorY: 128,
              };
            },
            getSize: () => iconSize,
            sizeScale: 2,
            sizeUnits: 'pixels',
            updateTriggers: {
              getIcon: [iconName, fillColorArray, sortedFeatures.length],
              getIconColor: [sortedFeatures.length],
              getPosition: [sortedFeatures.length],
            },
            loadOptions: {
              imagebitmap: {
                resizeWidth: 128,
                resizeHeight: 128,
              },
            },
            ...baseLayerProps,
          });
        }

        return new ScatterplotLayer({
          id: `point-layer-${fd.slice_id}`,
          data: sortedFeatures as Feature<Geometry, GeoJsonProperties>[],
          filled: filled ?? fd.filled,
          stroked: stroked ?? fd.stroked,
          extruded: extruded ?? fd.extruded,
          getPosition: (f: any) => f.geometry?.coordinates,
          getFillColor: (feature: any) => feature.color || fillColorArray,
          getLineColor: () => strokeColorArray,
          getLineWidth: lineWidth ?? (fd.lineWidth || 1),
          getRadius: () => iconSize,
          radiusUnits: 'pixels',
          radiusMinPixels: 1,
          radiusMaxPixels: 50,
          radiusScale: 1,
          ...baseLayerProps,
        });
      }

      // Build category colors map from categories prop
      const categoryColorsMap: Record<string, number[]> = {};
      for (const [key, value] of Object.entries(categories || {})) {
        if ((value as { color?: number[] }).color) {
          categoryColorsMap[key] = (value as { color: number[] }).color;
        }
      }

      // Get icon name if pointType is specified
      let iconName: string | undefined;
      if (pointType) {
        iconName = pointType.replace('-icon', '');
        if (!iconName) iconName = 'circle';
      }

      // Use PointClusterLayer - automatically clusters nearby points
      // Renders single points as IconLayer (if iconName) or ScatterplotLayer (if not)
      // IMPORTANT: Keep ID stable so deck.gl preserves layer state across renders
      // Use slice_id if available, otherwise use 'default' (assumes single chart per page)
      const layerId = fd.slice_id ?? 'default';

      // Build set of enabled categories for cluster filtering
      const enabledCategories = new Set<string>(
        Object.entries(categories)
          .filter(([, cat]) => cat.enabled !== false)
          .map(([key]) => key.toLowerCase()),
      );

      return new PointClusterLayer({
        id: `point-cluster-layer-${layerId}`,
        data: sortedFeatures,
        getPosition: (f: any) => f.geometry?.coordinates as [number, number],
        categoryColors: categoryColorsMap,
        defaultColor: fillColorArray,
        // Dimension column for category lookup in cluster color
        dimensionColumn: dimension as string | undefined,
        // Set of enabled categories for filtering clusters
        enabledCategories,
        // Clustering configuration
        clusterMaxZoom: fd.clusterMaxZoom,
        clusterMinPoints: fd.clusterMinPoints,
        clusterRadius: fd.clusterRadius,
        // IconLayer props (only used if iconName is set)
        iconName,
        iconSize,
        // ScatterplotLayer props (only used if iconName is NOT set)
        pointRadius: iconSize,
        filled: filled ?? fd.filled,
        stroked: stroked ?? fd.stroked,
        strokeColor: strokeColorArray,
        lineWidth: lineWidth ?? (fd.lineWidth || 1),
        ...baseLayerProps,
      });
    }
    // LINES -- lines are a bit different, cause LINE geometry is just two coords vs LineString being an array of coords
    case 'Line':
      return new LineLayer({
        id: `line-layer-${fd.slice_id}` as const,
        data: sortedFeatures as Feature<Geometry, GeoJsonProperties>[],
        filled: filled ?? fd.filled,
        stroked: stroked ?? fd.stroked,
        extruded: extruded ?? fd.extruded,
        getSourcePosition: (f: any) => f.geometry?.coordinates[0],
        getTargetPosition: (f: any) => f.geometry?.coordinates[1],
        // Use fillColor for colorByCategory (dimension) or colorByValue (metric), otherwise use strokeColor
        getColor: (feature: any) =>
          dimension || isMetric
            ? feature.color || fillColorArray
            : feature.strokeColor || strokeColorArray,
        opacity: 0.8,
        getWidth: lineWidth ?? (fd.lineWidth || 1),
        getDashArray: isDashed ? [10, 5] : [0, 0], // 10px dash, 5px gap
        dashJustified: true,
        dashGapPickable: true,
        extensions: [new PathStyleExtension({ dash: isDashed })],
        ...baseLayerProps,
      });
    case 'LineString':
      return new PathLayer({
        id: `path-layer-${fd.slice_id}`,
        data: sortedFeatures as Feature<Geometry, GeoJsonProperties>[],
        filled: filled ?? fd.filled,
        stroked: stroked ?? fd.stroked,
        extruded: extruded ?? fd.extruded,
        getPath: (f: any) => f.geometry?.coordinates,
        // Use fillColor for colorByCategory (dimension) or colorByValue (metric), otherwise use strokeColor
        getColor: (feature: any) =>
          dimension || isMetric
            ? feature.color || fillColorArray
            : feature.strokeColor || strokeColorArray,
        getWidth: lineWidth ?? (fd.lineWidth || 2),
        widthUnits: 'pixels',
        widthScale: 1,
        widthMinPixels: 1,
        getDashArray: isDashed ? [10, 5] : [0, 0], // 10px dash, 5px gap
        dashJustified: true,
        dashGapPickable: true,
        extensions: [new PathStyleExtension({ dash: isDashed })],
        ...baseLayerProps,
      });
    // POLYGONS — SolidPolygonLayer (fill) + LineLayer (binary borders)
    // Separated from composite PolygonLayer for direct control and to skip stroke when disabled.
    case 'Polygon': {
      // Cache expanded polygons keyed on payload.data, which stays referentially
      // stable when only categories/colors change (no new data fetch).
      // Cache the FULL (unfiltered) expanded polygons so that toggling
      // categories on/off always has the complete set available.
      // buildPolygonLayers handles category filtering downstream.
      let polygonData = polygonDataCache.get(payload.data);
      if (!polygonData) {
        polygonData = expandPolygonFeatures(
          processedFeatures as Feature<Geometry, GeoJsonProperties>[],
        );
        polygonDataCache.set(payload.data, polygonData);
      }

      return buildPolygonLayers(polygonData, payload.data, {
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
      });
    }
    // GeoJSON (auto layer type)
    case 'GeoJSON':
      return new GeoJsonLayer({
        id: `geojson-layer-${fd.slice_id}` as const,
        data: sortedFeatures as Feature<Geometry, GeoJsonProperties>[],
        extruded: extruded ?? fd.extruded,
        filled: filled ?? fd.filled,
        stroked: stroked ?? fd.stroked,
        getFillColor: (
          feature: GeoJsonFeature,
        ): [number, number, number, number] => {
          const color = feature.color ?? fillColorArray;
          return [color[0] ?? 0, color[1] ?? 0, color[2] ?? 0, color[3] ?? 255];
        },
        getLineColor: (feature: any) =>
          feature?.properties?.strokeColor ||
          feature?.strokeColor ||
          strokeColorArray,
        pointType: 'circle',
        getLineWidth: lineWidth ?? (fd.lineWidth || 0),
        getPointRadius: () => 5,
        pointRadiusScale: fd.pointRadiusScale ?? 1,
        pointRadiusUnits: 'pixels',
        pointRadiusMinPixels: 5,
        lineWidthUnits: 'pixels',
        lineWidthMinPixels: 0,
        updateTriggers: {
          getFillColor: [fillColorArray, categories],
          getLineColor: [strokeColorArray, categories],
        },
        ...baseLayerProps,
      });
    case 'TextOverlay':
      return buildTextOverlayLayer({
        fd,
        sortedFeatures,
        fillColorArray,
        baseLayerProps,
      });

    // if no match, default to GeoJSON layer
    default:
      return new GeoJsonLayer({
        id: `geojson-layer-${fd.slice_id}` as const,
        data: sortedFeatures as Feature<Geometry, GeoJsonProperties>[],
        extruded: extruded ?? fd.extruded,
        filled: filled ?? fd.filled,
        stroked: stroked ?? fd.stroked,
        getFillColor: (
          feature: GeoJsonFeature,
        ): [number, number, number, number] => {
          const color = feature.color ?? fillColorArray;
          return [color[0] ?? 0, color[1] ?? 0, color[2] ?? 0, color[3] ?? 255];
        },
        getLineColor: (feature: any) =>
          feature?.properties?.strokeColor ||
          feature?.strokeColor ||
          strokeColorArray,
        pointType: 'circle',
        getLineWidth: lineWidth ?? (fd.lineWidth || 0),
        getPointRadius: () => 5,
        pointRadiusScale: fd.pointRadiusScale ?? 1,
        pointRadiusUnits: 'pixels',
        pointRadiusMinPixels: 5,
        lineWidthUnits: 'pixels',
        lineWidthMinPixels: 0,
        updateTriggers: {
          getFillColor: [fillColorArray, categories],
          getLineColor: [strokeColorArray, categories],
        },
        ...baseLayerProps,
      });
  }
}

export function getLayerStates(
  layers: Layer | Layer[] | null,
  options: { minZoom: number; maxZoom: number },
): LayerState[] {
  if (!layers) return [];
  const arr = Array.isArray(layers) ? layers : [layers];
  return arr.map(layer => ({
    id: layer.id,
    layer,
    options,
  }));
}

export type DeckGLGeoJsonProps = {
  formData: QueryFormData;
  payload: JsonObject;
  setControlValue: (control: string, value: JsonValue) => void;
  viewport: Viewport;
  onAddFilter: HandlerFunction;
  height: number;
  width: number;
  mapboxApiKey: string;
  mapStyle: string;
  hoverColumnNames?: string[];
  featureInfoColumnNames?: string[];
  limitReached?: boolean;
  visualConfig?: {
    dimension?: string;
    metric?: ColorByValueConfig;
    filled?: boolean;
    stroked?: boolean;
    extruded?: boolean;
    lineWidth?: number;
    fillColor?: string;
    strokeColor?: string;
    pointType?: string;
    pointSize?: number | string;
    categoryColorMapping?: {};
    strokeColorMapping?: {};
    metricLegend?: MetricLegend | null;
  };
};

const DeckGLGeoJson = (props: DeckGLGeoJsonProps) => {
  const {
    formData,
    payload,
    setControlValue,
    onAddFilter,
    height,
    width,
    mapboxApiKey,
    mapStyle,
    visualConfig: propVisualConfig,
    hoverColumnNames,
    featureInfoColumnNames,
    limitReached,
  } = props;

  const containerRef = useRef<DeckGLContainerHandle>();
  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    const { current } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);

  // State for clicked feature popup
  const [clickedFeature, setClickedFeature] =
    useState<ClickedFeatureInfo | null>(null);

  const handleClosePopup = useCallback(() => {
    setClickedFeature(null);
  }, []);

  // Fetch Mapbox API key from backend and update when available
  // Use cached key for initial state (may already be available from pre-fetch)
  const [effectiveMapboxKey, setEffectiveMapboxKey] = useState(
    getCachedMapboxApiKey() || mapboxApiKey || '',
  );
  useEffect(() => {
    // If we already have a valid key from props, use it
    if (mapboxApiKey && mapboxApiKey !== '') {
      setEffectiveMapboxKey(mapboxApiKey);
      return;
    }
    // Otherwise fetch from API
    fetchMapboxApiKey().then(key => {
      if (key) {
        setEffectiveMapboxKey(key);
      }
    });
  }, [mapboxApiKey]);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [migrationInfo, setMigrationInfo] = useState<{
    fromVersion: number;
    toVersion: number;
  } | null>(null);

  useEffect(() => {
    handleSchemaCheck(
      formData.geojsonConfig,
      formData.schemaVersion,
      setControlValue,
    ).then(result => {
      setValidationError(result.error ?? null);
      if (result.migrated && result.fromVersion && result.toVersion) {
        setMigrationInfo({
          fromVersion: result.fromVersion,
          toVersion: result.toVersion,
        });
      }
    });
  }, [formData.geojsonConfig, formData.schemaVersion, setControlValue]);

  const debouncedGeojsonConfig = useDebouncedValue(formData.geojsonConfig, 300);
  const [parsedGeojsonConfig, setParsedGeojsonConfig] = useState({});
  const prevGeojsonConfigRef = useRef({});

  const fillColorObj = normalizeRGBA(
    propVisualConfig?.fillColor || formData.fillColorPicker,
  );

  // Extract defaultLegendNames from geojsonConfig for null category substitution
  const getDefaultLegendNames = (config: any): string[] => {
    try {
      const parsed =
        typeof config === 'string' ? JSON.parse(config) : (config ?? {});
      return Array.isArray(parsed?.colorByCategory?.defaultLegendNames)
        ? parsed.colorByCategory.defaultLegendNames
        : ['Other'];
    } catch {
      return ['Other'];
    }
  };

  const [categories, setCategories] = useState<JsonObject>(
    getCategories(
      formData,
      propVisualConfig?.dimension,
      fillColorObj,
      payload.data.features || [],
      props.visualConfig?.categoryColorMapping || {},
      getDefaultLegendNames(formData.geojsonConfig),
    ),
  );

  useEffect(() => {
    const features = payload.data.features || [];

    let parsedGeojsonConfig = {};
    try {
      parsedGeojsonConfig =
        typeof debouncedGeojsonConfig === 'string'
          ? JSON.parse(debouncedGeojsonConfig)
          : (debouncedGeojsonConfig ?? {});
      prevGeojsonConfigRef.current = parsedGeojsonConfig;
    } catch (err) {
      console.warn('🚨 Failed to parse geojsonConfig', err.message);
      parsedGeojsonConfig = prevGeojsonConfigRef.current;
    }

    setParsedGeojsonConfig(parsedGeojsonConfig);

    let categoryColorMapping = {};
    try {
      const raw =
        (parsedGeojsonConfig as any)?.colorByCategory?.categoricalColors ??
        (parsedGeojsonConfig as any)?.categoryColorMapping;

      if (Array.isArray(raw)) {
        categoryColorMapping = normalizeCategoryColorMapping(raw);
      } else if (typeof raw === 'string') {
        const parsed = JSON.parse(raw);
        categoryColorMapping = Array.isArray(parsed)
          ? normalizeCategoryColorMapping(parsed)
          : parsed;
      } else if (typeof raw === 'object' && raw !== null) {
        categoryColorMapping = raw;
      }
    } catch (err) {
      console.warn('🚨 Failed to parse categoryColorMapping', err);
    }

    // Extract defaultLegendNames from parsed config
    const defaultLegendNames = Array.isArray(
      (parsedGeojsonConfig as any)?.colorByCategory?.defaultLegendNames,
    )
      ? (parsedGeojsonConfig as any).colorByCategory.defaultLegendNames
      : ['Other'];

    setCategories(
      getCategories(
        formData,
        propVisualConfig?.dimension,
        fillColorObj,
        features,
        categoryColorMapping,
        defaultLegendNames,
      ),
    );
  }, [
    payload.form_data,
    debouncedGeojsonConfig,
    formData.geojsonConfig?.globalColoring?.fillColor,
  ]);

  const toggleCategory = useCallback(
    (category: string) => {
      const newCategories = {
        ...categories,
        [category]: {
          ...categories[category],
          enabled: !categories[category].enabled,
        },
      };

      // If all are disabled, re-enable all (like nvd3)
      const allDisabled = Object.values(newCategories).every(c => !c.enabled);
      if (allDisabled) {
        Object.keys(newCategories).forEach(cat => {
          newCategories[cat].enabled = true;
        });
      }

      setCategories(newCategories);
    },
    [categories],
  );

  const showSingleCategory = useCallback(
    (category: string) => {
      const updated = Object.fromEntries(
        Object.entries(categories).map(([cat, val]) => [
          cat,
          { ...val, enabled: cat === category },
        ]),
      );
      setCategories(updated);
    },
    [categories],
  );

  // Map control handlers
  const handleZoomIn = useCallback(() => {
    containerRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    containerRef.current?.zoomOut();
  }, []);

  const handleResetView = useCallback(() => {
    containerRef.current?.resetView();
  }, []);

  // Ruler/measure mode state
  const [measureState, setMeasureState] = useState<MeasureState>({
    startPoint: null,
    endPoint: null,
    isActive: false,
    isDragging: false,
  });

  // Don't show popup when measurement mode is active
  const handleFeatureClick = useCallback(
    (info: any) => {
      if (measureState.isActive) return;
      if (info?.object?.properties) {
        setClickedFeature({ properties: info.object.properties });
      }
    },
    [measureState.isActive],
  );

  const handleRulerToggle = useCallback(() => {
    setMeasureState(prev => {
      if (prev.isActive) {
        // Exiting ruler mode - clear points
        return {
          startPoint: null,
          endPoint: null,
          isActive: false,
          isDragging: false,
        };
      }
      // Entering ruler mode
      return {
        startPoint: null,
        endPoint: null,
        isActive: true,
        isDragging: false,
      };
    });
  }, []);

  const handleMeasureClick = useCallback((coordinate: Coordinate) => {
    setMeasureState(prev => {
      if (!prev.isActive || prev.isDragging) return prev;

      if (!prev.startPoint) {
        // Set start point
        return { ...prev, startPoint: coordinate };
      }
      if (!prev.endPoint) {
        // Set end point
        return { ...prev, endPoint: coordinate };
      }
      // Both points set - start new measurement
      return { ...prev, startPoint: coordinate, endPoint: null };
    });
  }, []);

  // Drag handlers for drag-to-measure
  const handleMeasureDragStart = useCallback((coordinate: Coordinate) => {
    setMeasureState(prev => {
      if (!prev.isActive) return prev;
      return {
        ...prev,
        startPoint: coordinate,
        endPoint: null,
        isDragging: true,
      };
    });
  }, []);

  const handleMeasureDrag = useCallback((coordinate: Coordinate) => {
    setMeasureState(prev => {
      if (!prev.isActive || !prev.isDragging) return prev;
      return { ...prev, endPoint: coordinate };
    });
  }, []);

  const handleMeasureDragEnd = useCallback((coordinate: Coordinate) => {
    setMeasureState(prev => {
      if (!prev.isActive || !prev.isDragging) return prev;
      return { ...prev, endPoint: coordinate, isDragging: false };
    });
  }, []);

  // Handle escape key to exit ruler mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && measureState.isActive) {
        setMeasureState({
          startPoint: null,
          endPoint: null,
          isActive: false,
          isDragging: false,
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [measureState.isActive]);

  const viewport: Viewport = useMemo(() => {
    // Static viewport takes precedence — use the saved viewport as-is.
    if (formData.enableStaticViewport) {
      return props.viewport;
    }
    if (!formData.autozoom || !payload?.data?.features?.length) {
      return props.viewport;
    }
    return calculateAutozoomViewport(
      payload.data.features,
      props.viewport,
      width,
      height,
    );
  }, [
    formData.enableStaticViewport,
    formData.autozoom,
    height,
    payload?.data?.features,
    props.viewport,
    width,
  ]);

  // Write live viewport to module-level store (outside Redux) so the actual
  // viewport control value is only changed by explicit user Save actions.
  // ViewportControl reads the store on-demand via getLiveViewport.
  const viewportSetControlValue = useCallback(
    (control: string, value: JsonValue) => {
      if (control === 'viewport') {
        setLiveViewport(value as Viewport);
      }
    },
    [],
  );

  const visualConfig = useMemo(
    () => ({
      ...(propVisualConfig ?? {}),
      categoryColorMapping:
        (parsedGeojsonConfig as any)?.categoryColorMapping ?? {},
      strokeColorMapping:
        (parsedGeojsonConfig as any)?.strokeColorMapping ?? {},
    }),
    [propVisualConfig, parsedGeojsonConfig],
  );

  const layerStateOptions = useMemo(() => {
    const slider = formData.minMaxZoomSlider ?? [0, 22];
    return { minZoom: slider[0], maxZoom: slider[1] };
  }, [formData.minMaxZoomSlider]);

  // Only pass click handler when there are feature info columns configured.
  // Without this guard, pickable is always true (due to onFeatureClick being
  // truthy), which forces deck.gl to run GPU picking on every mouse move even
  // when there's no hover data — a significant per-frame cost for polygons.
  const effectiveClickHandler =
    featureInfoColumnNames && featureInfoColumnNames.length > 0
      ? handleFeatureClick
      : undefined;

  const layers = useMemo(
    () =>
      getLayer(
        formData,
        payload,
        onAddFilter,
        setTooltip,
        categories,
        visualConfig,
        hoverColumnNames,
        effectiveClickHandler,
      ),
    [
      formData,
      payload,
      onAddFilter,
      setTooltip,
      categories,
      visualConfig,
      hoverColumnNames,
      effectiveClickHandler,
    ],
  );

  const layerStates = useMemo(
    () => getLayerStates(layers, layerStateOptions),
    [layers, layerStateOptions],
  );

  // Adjust map height to accommodate warning banners
  const warningOffset = migrationInfo ? 190 : 60;
  const mapHeight =
    limitReached || migrationInfo ? height - warningOffset : height;

  let metricLegend: MetricLegend | null = null;
  const metricLegendObject = propVisualConfig?.metricLegend;

  if (metricLegendObject) {
    metricLegend = {
      startColor: metricLegendObject.startColor,
      endColor: metricLegendObject.endColor,

      min: metricLegendObject.min,
      max: metricLegendObject.max,
      legendName:
        metricLegendObject.legendName ||
        propVisualConfig?.metric?.valueColumn ||
        payload.data.metricLabels?.[0] ||
        'Value',
    };
  }

  // Don't render chart if there's a validation error
  if (validationError) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Alert
          type="error"
          message={t('Schema validation error')}
          description={
            <div
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                fontSize: 12,
                maxHeight: height - 80,
                overflow: 'auto',
              }}
            >
              {validationError}
            </div>
          }
          showIcon
          style={{ margin: 16, fontSize: 12, padding: '8px 12px' }}
        />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height }}>
      <DeckGLContainerStyledWrapper
        ref={containerRef}
        mapboxApiAccessToken={effectiveMapboxKey || 'no-token'}
        viewport={viewport}
        initialViewport={viewport}
        setControlValue={viewportSetControlValue}
        layerStates={layerStates}
        mapStyle={mapStyle || formData.mapbox_style}
        height={mapHeight}
        width={width}
        measureState={measureState}
        onMeasureClick={handleMeasureClick}
        onMeasureDragStart={handleMeasureDragStart}
        onMeasureDrag={handleMeasureDrag}
        onMeasureDragEnd={handleMeasureDragEnd}
        onEmptyClick={handleClosePopup}
      />
      <Legend
        forceCategorical
        categories={categories}
        metricLegend={metricLegend}
        format={props.formData.legend_format}
        position="tl"
        showSingleCategory={showSingleCategory}
        toggleCategory={toggleCategory}
        icon={propVisualConfig?.pointType}
        geometryType={formData.geoJsonLayer}
      />
      <MapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onRulerToggle={handleRulerToggle}
        isRulerActive={measureState.isActive}
        position="top-right"
      />
      <MeasureOverlay
        measureState={measureState}
        onMapClick={handleMeasureClick}
        onExit={handleRulerToggle}
        width={width}
        height={mapHeight}
      />
      {clickedFeature && (
        <ClickPopupBox
          feature={clickedFeature}
          onClose={handleClosePopup}
          featureInfoColumnNames={featureInfoColumnNames}
          position="right"
        />
      )}
      {limitReached && (
        <LimitWarning>
          {t(
            'The row limit set for the chart was reached. The chart may show partial data.',
          )}
        </LimitWarning>
      )}
      {migrationInfo && (
        <LimitWarning>
          {t(
            'Migrated config from version %s to %s. Update and save.',
            migrationInfo.fromVersion,
            migrationInfo.toVersion,
          )}
        </LimitWarning>
      )}
    </div>
  );
};

export default memo(DeckGLGeoJson);
