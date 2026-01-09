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
  PolygonLayer,
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
  rgbaArrayToHex,
} from '../../utils/colors';
import sandboxedEval from '../../utils/sandbox';
import { commonLayerProps } from '../common';
import TooltipRow from '../../TooltipRow';
import { calculateAutozoomViewport, Viewport } from '../../utils/fitViewport';
import { TooltipProps } from '../../components/Tooltip';
import Legend from '../../components/Legend';
import { GeoJsonFeature } from '../../types';
import { useDebouncedValue } from '../../utils/hooks';
import { normalizeRGBA } from '../../utils/colorsFallback';
import { getColoredSvgUrl } from '../../utils/svgIcons';
import { validateLayerType } from '../../utilities/utils';
import { expandPolygonFeatures } from '../../utils/expandPolygonFeatures';
import {
  fetchMapboxApiKey,
  getCachedMapboxApiKey,
} from '../../utils/mapboxApi';
import { handleSchemaCheck } from '../../utils/migrationApi';

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

function setTooltipContent(
  o: JsonObject,
  hoverColumnNames?: string[],
  metric?: ColorByValueConfig,
  metricName?: string,
) {
  const props = o.object?.properties;
  if (!props) return null;

  // If no hover columns specified, don't show tooltip
  if (!hoverColumnNames || hoverColumnNames.length === 0) {
    return null;
  }

  const content: JSX.Element[] = [];

  // Add metric first if available
  if (metric) {
    // Render metric first (in order)
    if (props[`color_${metric.valueColumn}`] !== undefined) {
      const colorArr = props[`color_${metric.valueColumn}`];
      const hexColor = rgbaArrayToHex(colorArr);
      content.push(
        <TooltipRow
          key={`metric-${metric.valueColumn}`}
          label={`${metric.valueColumn}: `}
          value={`${props[metric.valueColumn]}`}
          color={hexColor}
        />,
      );
    }
  }

  // Add all other properties except ones in propertyKeys
  Object.keys(props)
    .filter(key => hoverColumnNames.includes(key) && metricName !== key)
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
    <div className="dart-map-deckgl-tooltip">{content}</div>
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

  const propOverrides: JsonObject = {};
  if (fillColorArray[3] > 0) propOverrides.fillColor = fillColorArray;
  if (strokeColorArray[3] > 0) propOverrides.strokeColor = strokeColorArray;

  const isDashed = lineStyle === 'dashed';

  const features =
    (recurseGeoJson(payload.data, propOverrides) as GeoJsonFeature[]) || [];
  if (!features.length) {
    console.warn(
      '🚨 No features parsed from GeoJSON. Skipping layer rendering.',
    );
    return null;
  }

  let processedFeatures = features;
  if (fd.jsDataMutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.jsDataMutator);
    processedFeatures = jsFnMutator(processedFeatures) || processedFeatures;
  }

  // Apply category visibility: if NOT in metric mode, hide features whose category is disabled.
  // We don't introduce new fields — we simply set color/stroke to transparent [0,0,0,0].
  const visibleFeatures = processedFeatures.map(f => {
    // If metric coloring is active, don't modify features (metric takes precedence).
    if (isMetric) return f;

    // Determine category key stored on the feature (you saved it earlier as categoryName),
    // otherwise fall back to property using dimension column name.
    const categoryRaw =
      (f as any).categoryName ?? f.properties?.[dimension as string];
    if (categoryRaw == null) return f;

    const lookupKey =
      typeof categoryRaw === 'string'
        ? categoryRaw.trim().toLowerCase()
        : String(categoryRaw).trim().toLowerCase();

    const catState = (categories as Record<string, any>)[lookupKey];
    if (catState && catState.enabled === false) {
      // Return a shallow clone with fully transparent colors.
      const cc = [0, 0, 0, 0];
      return {
        ...f,
        color: cc,
        strokeColor: cc,
        properties: {
          ...f.properties,
          fillColor: cc,
          strokeColor: cc,
        },
      };
    }
    return f;
  });

  // Create tooltip content generator with hover column filtering
  const tooltipContentGenerator = (o: JsonObject) =>
    setTooltipContent(
      o,
      hoverColumnNames,
      metric,
      payload.data.metricLabels?.[0],
    );

  // Shared props for all layer types
  const baseLayerProps = {
    ...commonLayerProps(fd, setTooltip, tooltipContentGenerator),
    pickable: true,
  };

  // validate which layer type to render
  let layerType = fd.geoJsonLayer || 'GeoJSON';
  layerType = validateLayerType(
    layerType,
    processedFeatures[0]?.geometry?.type,
  );

  console.log('[DartLayer] Creating layer:', {
    layerType,
    featureCount: processedFeatures.length,
    geometryType: processedFeatures[0]?.geometry?.type,
  });

  switch (layerType) {
    // POINTS -- should be ScatterplotLayer or IconLayer (pointType is given)
    case 'Point': {
      const iconSize = Number(pointSize) || 5;
      if (pointType) {
        let iconName = pointType.replace('-icon', ''); // e.g. "fire-icon" -> "fire"
        if (!iconName) {
          console.warn(`Icon "${iconName}" not found, using default circle.`);
          iconName = 'circle';
        }
        return new IconLayer({
          id: `icon-layer-${fd.slice_id}-${visibleFeatures.length}`,
          data: visibleFeatures as Feature<Geometry, GeoJsonProperties>[],
          getIconColor: (f: any) => f.color,
          getPosition: f => f.geometry?.coordinates,
          getIcon: f => {
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
          // Force layer update when data or icons change
          updateTriggers: {
            getIcon: [iconName, fillColorArray, visibleFeatures.length],
            getIconColor: [visibleFeatures.length],
            getPosition: [visibleFeatures.length],
          },
          // Load icons immediately
          loadOptions: {
            imagebitmap: {
              resizeWidth: 128,
              resizeHeight: 128,
            },
          },
          ...baseLayerProps,
        });
      }

      console.log('[DartLayer] Creating ScatterplotLayer with:', {
        id: `point-layer-${fd.slice_id}`,
        dataLength: visibleFeatures.length,
        filled: filled ?? fd.filled,
        stroked: stroked ?? fd.stroked,
      });
      return new ScatterplotLayer({
        id: `point-layer-${fd.slice_id}`,
        data: visibleFeatures as Feature<Geometry, GeoJsonProperties>[],
        filled: filled ?? fd.filled,
        stroked: stroked ?? fd.stroked,
        extruded: extruded ?? fd.extruded,
        getPosition: f => f.geometry?.coordinates,
        getFillColor: feature => feature.color || fillColorArray,
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
    // LINES -- lines are a bit different, cause LINE geometry is just two coords vs LineString being an array of coords
    case 'Line':
      return new LineLayer({
        id: `line-layer-${fd.slice_id}` as const,
        data: visibleFeatures as Feature<Geometry, GeoJsonProperties>[],
        filled: filled ?? fd.filled,
        stroked: stroked ?? fd.stroked,
        extruded: extruded ?? fd.extruded,
        getSourcePosition: (f: any) => f.geometry?.coordinates[0],
        getTargetPosition: (f: any) => f.geometry?.coordinates[1],
        // Use fillColor for colorByCategory (dimension), otherwise use strokeColor
        getColor: (feature: any) =>
          dimension
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
        data: visibleFeatures as Feature<Geometry, GeoJsonProperties>[],
        filled: filled ?? fd.filled,
        stroked: stroked ?? fd.stroked,
        extruded: extruded ?? fd.extruded,
        getPath: (f: any) => f.geometry?.coordinates,
        // Use fillColor for colorByCategory (dimension), otherwise use strokeColor
        getColor: (feature: any) =>
          dimension
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
    // POLYGONS
    case 'Polygon': {
      // --- Flatten MultiPolygons into individual polygons ---
      const polygonData = expandPolygonFeatures(
        visibleFeatures as Feature<Geometry, GeoJsonProperties>[],
      );

      // Compute effective stroked based on lineWidth
      const effectiveStroked =
        (lineWidth ?? fd.lineWidth ?? 1) > 0 ? (stroked ?? fd.stroked) : false;

      return new PolygonLayer({
        id: `polygon-layer-${fd.slice_id}`,
        data: polygonData,
        stroked: effectiveStroked,
        filled: filled ?? fd.filled,
        getPolygon: (feature: any) => feature.polygon,
        getFillColor: feature => feature.color || fillColorArray,
        getLineColor: () => strokeColorArray,
        getLineWidth: lineWidth ?? (fd.lineWidth || 0),
        lineWidthUnits: 'pixels',
        lineWidthScale: 1,
        lineWidthMinPixels: 0,
        ...baseLayerProps,
      });
    }
    // GeoJSON (auto layer type)
    case 'GeoJSON':
      return new GeoJsonLayer({
        id: `geojson-layer-${fd.slice_id}` as const,
        data: visibleFeatures as Feature<Geometry, GeoJsonProperties>[],
        extruded: extruded ?? fd.extruded,
        filled: filled ?? fd.filled,
        stroked: stroked ?? fd.stroked,
        getFillColor: (
          feature: GeoJsonFeature,
        ): [number, number, number, number] => {
          const color = feature.color ?? fillColorArray;
          // Ensure the color array has exactly 4 elements
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
        ...baseLayerProps,
      });
    // if no match, default to GeoJSON layer
    default:
      return new GeoJsonLayer({
        id: `geojson-layer-${fd.slice_id}` as const,
        data: visibleFeatures as Feature<Geometry, GeoJsonProperties>[],
        extruded: extruded ?? fd.extruded,
        filled: filled ?? fd.filled,
        stroked: stroked ?? fd.stroked,
        getFillColor: (
          feature: GeoJsonFeature,
        ): [number, number, number, number] => {
          const color = feature.color ?? fillColorArray;
          // Ensure the color array has exactly 4 elements
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
        ...baseLayerProps,
      });
  }
}

export function getLayerState(
  layer: Layer | null,
  options: { minZoom: number; maxZoom: number },
) {
  if (!layer) return null;

  return {
    id: layer.id,
    layer,
    options,
  };
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
    limitReached,
  } = props;

  const containerRef = useRef<DeckGLContainerHandle>();
  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    const { current } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
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

  const viewport: Viewport = useMemo(() => {
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
    formData.autozoom,
    height,
    payload?.data?.features,
    props.viewport,
    width,
  ]);

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

  let { minMaxZoomSlider } = formData;
  if (minMaxZoomSlider === undefined) {
    minMaxZoomSlider = [0, 22];
  }
  const layerStateOptions = {
    minZoom: minMaxZoomSlider[0],
    maxZoom: minMaxZoomSlider[1],
  };

  const layer = useMemo(
    () =>
      getLayer(
        formData,
        payload,
        onAddFilter,
        setTooltip,
        categories,
        visualConfig,
        hoverColumnNames,
      ),
    [
      formData,
      payload,
      onAddFilter,
      setTooltip,
      categories,
      visualConfig,
      hoverColumnNames,
    ],
  );

  const layerState = getLayerState(layer, layerStateOptions);

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
        layerStates={layerState ? [layerState] : []}
        mapStyle={mapStyle || formData.mapbox_style}
        setControlValue={setControlValue}
        height={mapHeight}
        width={width}
      />
      <Legend
        forceCategorical
        categories={categories}
        metricLegend={metricLegend}
        format={props.formData.legend_format}
        position={props.formData.legend_position}
        showSingleCategory={showSingleCategory}
        toggleCategory={toggleCategory}
        icon={propVisualConfig?.pointType}
        geometryType={formData.geoJsonLayer}
      />
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
