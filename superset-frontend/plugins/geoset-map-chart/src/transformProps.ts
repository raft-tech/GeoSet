/* eslint-disable no-plusplus */
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

import { ChartProps, DataRecord, QueryFormData } from '@superset-ui/core';
import {
  getCategories,
  applyColorMapping,
  CategoryState,
  normalizeCategoryColorMapping,
  addColor,
  computeMetricColorScaleUnified,
  ColorByValueConfig,
  MetricLegend,
  DEFAULT_SUPERSET_COLOR,
  RGBAColor,
  toRGBA,
} from './utils/colors';
import { GeoJsonFeature } from './types';
import {
  normalizeNullCategory,
  parseRawFeatures,
  getGeometryType,
} from './utils/dataProcessing';
import { hasValidFill } from './utils/colorsFallback';

const NOOP = () => {};

const DEFAULT_VIEWPORT = {
  longitude: 6.85236157047845,
  latitude: 31.222656842808707,
  zoom: 1,
  bearing: 0,
  pitch: 0,
};

// Define defaults per user select geometry/layer type
const defaultsByGeometry: Record<
  string,
  { filled: boolean; stroked: boolean; extruded: boolean }
> = {
  Polygon: { filled: true, stroked: true, extruded: false },
  MultiPolygon: { filled: true, stroked: true, extruded: false },
  Line: { filled: false, stroked: true, extruded: false },
  Point: { filled: true, stroked: false, extruded: false },
  GeoJSON: { filled: true, stroked: true, extruded: true },
  TextOverlay: { filled: false, stroked: false, extruded: false },
};

export default function transformProps(chartProps: ChartProps) {
  const { height, hooks, queriesData, formData, width } = chartProps;
  const { onAddFilter = NOOP, setControlValue = NOOP } = hooks;

  // Optional: filter nulls if needed
  const filterNulls = formData.filter_nulls ?? true;
  const geojsonPayload = queriesData[0] || {};
  const rawData: DataRecord[] = geojsonPayload?.data || [];
  const layerType = formData.geoJsonLayer || 'Polygon';
  // Check if row_limit was reached (rowcount equals the limit, meaning data was truncated)
  const rowLimit = Number(formData.rowLimit);
  const rowCount = geojsonPayload?.rowcount || 0;
  const limitReached = Boolean(rowLimit && rowCount >= rowLimit);

  let geojsonConfig: any = {};
  if (typeof formData.geojsonConfig === 'string') {
    if (formData.geojsonConfig.trim().startsWith('{')) {
      try {
        geojsonConfig = JSON.parse(formData.geojsonConfig) ?? {};

        if (typeof geojsonConfig.colorByCategory === 'string') {
          geojsonConfig.colorByCategory = JSON.parse(
            geojsonConfig.colorByCategory,
          );
        }
      } catch (e) {
        console.warn(
          'Invalid geojsonConfig:',
          e,
          '⚠️ Falling back to last known good config',
        );
        geojsonConfig = {};
      }
    }
  }

  const {
    globalColoring,
    colorByCategory,
    colorByValue,
    legend,
    textOverlayStyle,
  } = geojsonConfig;

  const fillColor = globalColoring?.fillColor;
  const strokeColor = globalColoring?.strokeColor;
  const lineWidth = globalColoring?.strokeWidth;
  const lineStyle = globalColoring?.lineStyle;
  const fillPattern = globalColoring?.fillPattern; // TODO: need to see how to use this in deck.gl
  // Normalize with fallback color logic
  const fillColorArray = Array.isArray(fillColor)
    ? fillColor
    : DEFAULT_SUPERSET_COLOR;
  const strokeColorArray = Array.isArray(strokeColor)
    ? strokeColor
    : DEFAULT_SUPERSET_COLOR;
  // Get the defaults for layer type
  const { filled, stroked, extruded } =
    defaultsByGeometry[layerType] || defaultsByGeometry.Polygon;

  // Check actual geometry type from data as fallback (e.g., rawData[0].geojson.type = "Point")
  const actualGeometryType = getGeometryType(rawData[0]?.geojson as any);
  const isPointGeometry =
    layerType === 'Point' ||
    actualGeometryType === 'Point' ||
    actualGeometryType === 'MultiPoint';

  const pointType = isPointGeometry ? globalColoring?.pointType : undefined;
  const pointSize = isPointGeometry ? globalColoring?.pointSize : undefined;

  const dimension = colorByCategory?.dimension;
  const categoryColorMapping = colorByCategory?.categoricalColors || {};
  // normalize colorByMetric to always be an array
  const colorByValueName = colorByValue?.valueColumn;

  // Determine active mode
  const hasCategory = Boolean(colorByCategory?.dimension);
  const hasMetric = Boolean(colorByValue?.valueColumn);
  const useMetricColoring = hasMetric;
  const useCategoryColoring = hasCategory && !hasMetric;

  // --- Metric domain & legend ---
  let metricDomain: [number, number] | null = null;
  let metricColorScale: ((v: number) => number[]) | null = null;
  let metricLegend: MetricLegend | null = null;

  if (colorByValue && rawData.length > 0) {
    const {
      valueColumn,
      startColor,
      endColor,
      lowerBound,
      upperBound,
      breakpoints,
    } = colorByValue;

    if (valueColumn) {
      const values = rawData
        .map(d => {
          const value = d[valueColumn];
          return value !== null &&
            value !== undefined &&
            !Number.isNaN(Number(value))
            ? Number(value)
            : null;
        })
        .filter((v): v is number => v !== null);

      if (values.length > 0) {
        const lower = lowerBound ?? Math.min(...values);
        const upper = upperBound ?? Math.max(...values);
        metricDomain = [lower, upper];

        const start: RGBAColor = hasValidFill(startColor)
          ? toRGBA(startColor)
          : toRGBA(globalColoring?.fillColor);

        const end: RGBAColor = hasValidFill(endColor)
          ? toRGBA(endColor)
          : toRGBA(globalColoring?.fillColor);

        const spec: ColorByValueConfig = {
          valueColumn,
          startColor: start,
          endColor: end,
          breakpoints,
          lowerBound: lower,
          upperBound: upper,
        };

        metricColorScale = computeMetricColorScaleUnified(spec, [lower, upper]);

        // When there's only one value (lower === upper), there's no gradient
        // to display — use the same color for both ends of the legend.
        const noGradient = lower === upper;

        metricLegend = {
          min: lower,
          max: upper,
          startColor: noGradient ? start : start,
          endColor: noGradient ? start : end,
          legendName: legend?.title || valueColumn,
        };
      }
    } else {
      console.warn('Metric entry missing valueName:', colorByValue);
    }
  }

  // --- Parse raw features with caching ---
  const rawFeatures = parseRawFeatures(rawData, dimension, filterNulls);

  // Extract hover column names for tooltip filtering
  const hoverColumnNames = (formData.hoverDataColumns || []).map(
    (col: any) => col.column_name || col.label || col,
  );

  // Extract feature info column names for click popup
  const featureInfoColumnNames = (formData.featureInfoColumns || []).map(
    (col: any) => col.column_name || col.label || col,
  );

  if (!Array.isArray(rawFeatures) || rawFeatures.length === 0) {
    console.warn('🚨 No valid GeoJSON features found');
  }

  // Detect if color is already provided
  const colorAlreadyProvided = rawFeatures.every(
    feature =>
      feature.color ||
      feature.properties?.fillColor ||
      feature.properties?.color ||
      feature.properties?.strokeColor,
  );

  let features: GeoJsonFeature[] = rawFeatures;
  // ALWAYS compute categories, even in metric mode
  const normalizedMapping = Array.isArray(categoryColorMapping)
    ? normalizeCategoryColorMapping(categoryColorMapping)
    : categoryColorMapping || {};

  // Extract default legend names, fallback to ['Other']
  const defaultLegendNames = Array.isArray(colorByCategory?.defaultLegendNames)
    ? colorByCategory.defaultLegendNames
    : ['Other'];

  // For Line/LineString geometries, use strokeColor as the fallback for category coloring
  const isLineGeometry = layerType === 'Line' || layerType === 'LineString';
  const categoryFallbackColor = isLineGeometry
    ? (strokeColorArray as RGBAColor)
    : (fillColorArray as RGBAColor);

  const categories: Record<string, CategoryState> = getCategories(
    formData as QueryFormData,
    dimension,
    categoryFallbackColor,
    features,
    normalizedMapping,
    defaultLegendNames,
  );

  // --- CATEGORY COLORING MODE ---
  const shouldForceRecolor =
    Boolean(globalColoring?.fillColor || colorByCategory?.dimension) &&
    !colorAlreadyProvided;

  if (shouldForceRecolor && useCategoryColoring) {
    let nullCategoryCounter = 0;
    // Start from a clean version (avoid skipping recoloring)
    const cleanFeatures = rawFeatures.map(f => {
      const p = { ...f.properties };
      if (dimension) {
        p[dimension] = normalizeNullCategory(
          f.extraProps?.[dimension] ?? f.properties?.[dimension],
        );
      }

      return {
        ...f,
        color: undefined,
        strokeColor: undefined,
        properties: {
          ...p,
          fillColor: undefined,
          strokeColor: undefined,
          legendName: undefined,
        },
      };
    });

    // Apply custom category color mapping if provided
    const hasCustomMapping =
      categoryColorMapping && typeof categoryColorMapping === 'object';

    if (hasCustomMapping) {
      features = applyColorMapping(
        cleanFeatures,
        dimension,
        normalizedMapping,
        strokeColor,
        fillColorArray[3],
        strokeColorArray[3],
        categoryFallbackColor, // Use strokeColor for Line/LineString, fillColor otherwise
        defaultLegendNames,
      );
    } else {
      features = addColor(
        formData as QueryFormData,
        dimension,
        categoryFallbackColor, // Use strokeColor for Line/LineString, fillColor otherwise
        cleanFeatures,
      ).map(f => {
        // assign default legend names sequentially
        const rawCat = f.properties?.[dimension];
        const isNullCategory = rawCat === '__NULL__';

        const legendName = isNullCategory
          ? (defaultLegendNames[
              nullCategoryCounter++ % defaultLegendNames.length
            ] ?? 'Other')
          : rawCat;

        return {
          ...f,
          strokeColor: strokeColorArray,
          properties: {
            ...f.properties,
            legendName,
          },
        };
      });
    }
  }

  // METRIC COLORING MODE (overrides category)
  if (useMetricColoring && features.length > 0) {
    const { valueColumn } = colorByValue;

    features = features.map(feature => {
      const featureProperties = { ...feature.properties };
      const value = featureProperties?.[valueColumn];

      if (value !== null && value !== undefined && metricColorScale) {
        // Use the precomputed color scale
        const colorArray = metricColorScale(value);
        if (colorArray.length === 3) colorArray.push(255);

        return {
          ...feature,
          color: colorArray, // always numeric
          properties: {
            ...feature.properties,
            fillColor: colorArray, // deck.gl style numeric array
            [`color_${valueColumn}`]: colorArray,
          },
        };
      }
      return feature;
    });
  }

  // --- APPLY LEGEND CATEGORY VISIBILITY (affects both scatter + icons) ---
  // This must run AFTER all category/metric coloring is assigned.
  if (useCategoryColoring && categories && dimension) {
    features = features.map(f => {
      const rawCat = normalizeNullCategory(
        f.extraProps?.[dimension] ?? f.properties?.[dimension],
      );

      if (rawCat != null) {
        const lookupKey = String(rawCat).trim().toLowerCase();
        const catState = categories[lookupKey];

        // If category exists and is DISABLED, hide the feature
        if (catState && catState.enabled === false) {
          return {
            ...f,
            color: [0, 0, 0, 0], // transparent (works for scatter, polygons, AND icons)
            properties: {
              ...f.properties,
              fillColor: [0, 0, 0, 0],
              strokeColor: [0, 0, 0, 0],
            },
          };
        }

        // Category is enabled → ensure it uses category color (in case metric was not applied)
        if (catState?.color) {
          return {
            ...f,
            color: catState.color,
            properties: {
              ...f.properties,
              fillColor: catState.color,
            },
          };
        }
      }
      return f;
    });
  }

  // Mapbox API key placeholder - actual key is fetched in the component via useEffect
  const mapboxApiKey =
    geojsonPayload.data?.mapboxApiKey || process.env.MAPBOX_API_KEY || '';

  const mapStyle = formData.mapboxStyle || 'mapbox://styles/mapbox/light-v10';

  const enableStaticViewport = formData.enableStaticViewport || false;

  return {
    width,
    height,
    formData,
    enableStaticViewport,
    geoJsonLayer: layerType,
    payload: {
      data: {
        features,
        mapboxApiKey,
        metricLabels: colorByValueName ? [colorByValueName] : [],
      },
    },
    onAddFilter,
    setControlValue,
    viewport: {
      ...DEFAULT_VIEWPORT,
      ...formData.viewport,
      height,
      width,
    },
    mapboxApiKey,
    mapStyle,
    categories,
    legend,
    hoverColumnNames,
    featureInfoColumnNames,
    limitReached,
    visualConfig: {
      dimension,
      metric: colorByValue,
      filled,
      stroked,
      extruded,
      lineWidth: lineWidth ?? 0,
      fillColor: fillColorArray,
      strokeColor: strokeColorArray,
      pointType,
      pointSize,
      lineStyle,
      fillPattern,
      categoryColorMapping,
      metricDomain,
      metricColorScale,
      metricLegend,
      textOverlayStyle,
    },
  };
}
