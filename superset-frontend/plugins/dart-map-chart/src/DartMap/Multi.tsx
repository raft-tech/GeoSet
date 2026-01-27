/* eslint-disable react/jsx-handler-names */
/* eslint-disable react/no-access-state-in-setstate */
/* eslint-disable camelcase */
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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isEqual } from 'lodash';
import {
  Datasource,
  HandlerFunction,
  JsonObject,
  JsonValue,
  QueryFormData,
  SupersetClient,
  usePrevious,
} from '@superset-ui/core';

import {
  DeckGLContainerHandle,
  DeckGLContainerStyledWrapper,
} from '../DeckGLContainer';
import {
  getLayer as getDartMapLayer,
  getLayerState as layerStateGenerator,
} from '../layers/DartLayer/DartLayer';
import { calculateAutozoomViewport, Viewport } from '../utils/fitViewport';
import { TooltipProps } from '../components/Tooltip';
import { LayerState } from '../types';
import buildDartMapLayerQuery from '../buildQuery';
import transformDartMapLayerProps from '../transformProps';
import MultiLegend, { LegendGroup } from '../components/MultiLegend';
import MapControls from '../components/MapControls';
import { CategoryState, MetricLegend, RGBAColor } from '../utils/colors';
import { getGeometryType } from '../utils';
import { fetchMapboxApiKey, getCachedMapboxApiKey } from '../utils/mapboxApi';
import { multiChartMigration } from '../utils/migrationApi';
import ClickPopupBox, { ClickedFeatureInfo } from '../components/ClickPopupBox';

// Utility to convert snake_case or camelCase to Title Case
const toTitleCase = (str: string) =>
  str
    .replace(/_/g, ' ')
    .replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1));

// Per-layer autozoom config
interface DeckSliceConfig {
  sliceId: number;
  autozoom: boolean;
}

// Normalize deck slices (handle legacy number[] format)
const normalizeDeckSlices = (
  deckSlices: (DeckSliceConfig | number)[] | undefined,
): DeckSliceConfig[] =>
  deckSlices?.map(item =>
    typeof item === 'number' ? { sliceId: item, autozoom: true } : item,
  ) ?? [];

export type DeckMultiProps = {
  formData: QueryFormData;
  payload: JsonObject;
  setControlValue: (control: string, value: JsonValue) => void;
  mapboxApiKey: string;
  mapStyle: string;
  viewport: Viewport;
  onAddFilter: HandlerFunction;
  height: number;
  width: number;
  datasource: Datasource;
  onSelect: () => void;
};

type SubsliceLayerEntry = {
  sliceId: number;
  layerState: LayerState;
  legendGroup: LegendGroup;
  features: JsonObject[];
  autozoom: boolean;
  // Store data needed to rebuild layer when category visibility changes
  transformedProps: {
    formData: any;
    payload: any;
    categories: Record<string, CategoryState>;
    visualConfig: any;
    hoverColumnNames: string[];
  };
  zoomSliderOptions: { minZoom: number; maxZoom: number };
};

interface ClickedFeatureWithColumns extends ClickedFeatureInfo {
  featureInfoColumnNames?: string[];
}

const DeckMulti = (props: DeckMultiProps) => {
  const containerRef = useRef<DeckGLContainerHandle>(null);
  // Ref to track measure state for use in callbacks without creating dependencies
  const measureActiveRef = useRef(false);

  const [subSlicesLayers, setSubSlicesLayers] = useState<SubsliceLayerEntry[]>(
    [],
  );
  const [slicesData, setSlicesData] = useState<JsonObject[] | null>(null);
  const [layerVisibility, setLayerVisibility] = useState<
    Record<string, boolean>
  >({});
  const [clickedFeature, setClickedFeature] =
    useState<ClickedFeatureWithColumns | null>(null);
  // Track disabled categories per slice: { sliceId: { categoryLabel: false } }
  const [categoryVisibility, setCategoryVisibility] = useState<
    Record<string, Record<string, boolean>>
  >({});

  // Don't show popup when measurement mode is active (uses ref to avoid dependency issues)
  const handleFeatureClick = useCallback(
    (info: any, featureInfoColumnNames?: string[]) => {
      if (measureActiveRef.current) return;
      if (info?.object?.properties) {
        setClickedFeature({
          properties: info.object.properties,
          featureInfoColumnNames,
        });
      }
    },
    [],
  );

  const handleClosePopup = useCallback(() => {
    setClickedFeature(null);
  }, []);
  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    const { current } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);
  const { mapboxApiKey, mapStyle } = props;

  // Fetch Mapbox API key from backend and update when available
  // Use cached key for initial state (may already be available from pre-fetch)
  const [effectiveMapboxKey, setEffectiveMapboxKey] = useState(
    getCachedMapboxApiKey() ||
      props.formData.mapboxApiKey ||
      mapboxApiKey ||
      '',
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
  }, [mapboxApiKey, props.formData.mapboxApiKey]);

  // Normalize deck slices (handle legacy number[] format)
  const normalizedDeckSlices = useMemo(
    () => normalizeDeckSlices(props.formData.deckSlices),
    [props.formData.deckSlices],
  );

  // Fetch slice metadata when deckSlices changes and payload doesn't have slices
  useEffect(() => {
    const { payload } = props;

    // If payload already has slices (legacy mode), use them
    if (payload?.data?.slices) {
      setSlicesData(payload.data.slices);
      return;
    }

    // Otherwise, fetch slice metadata from API
    if (normalizedDeckSlices.length === 0) {
      setSlicesData([]);
      return;
    }

    const sliceIds = normalizedDeckSlices.map(s => s.sliceId);

    // Fetch each slice's metadata
    Promise.all(
      sliceIds.map((sliceId: number) =>
        SupersetClient.get({ endpoint: `/api/v1/chart/${sliceId}` })
          .then(({ json }: { json: JsonObject }) => {
            const result = json?.result || {};
            return {
              slice_id: sliceId,
              slice_name: result.slice_name,
              form_data: result.params ? JSON.parse(result.params) : {},
              datasource: result.datasource_id
                ? `${result.datasource_id}__${result.datasource_type}`
                : null,
            };
          })
          .catch(() => null),
      ),
    ).then(slices => {
      const validSlices = slices.filter(s => s !== null) as JsonObject[];
      setSlicesData(validSlices);
    });
  }, [normalizedDeckSlices, props, props.payload.data.slices]);

  const loadLayers = useCallback(
    (
      formData: QueryFormData,
      slices: JsonObject[],
      deckSlicesConfig: DeckSliceConfig[],
    ) => {
      setSubSlicesLayers([]);

      if (!slices || slices.length === 0) {
        return;
      }

      Promise.all(
        slices.map((subslice: { slice_id: number } & JsonObject) => {
          // Get autozoom setting for this slice from the config
          const sliceConfig = deckSlicesConfig.find(
            c => c.sliceId === subslice.slice_id,
          );
          const sliceAutozoom = sliceConfig?.autozoom ?? true;
          let copyFormData = {
            ...subslice.form_data,
          };
          if (formData.extraFormData) {
            copyFormData = {
              ...copyFormData,
              extra_form_data: formData.extraFormData,
            };
          }

          // Migrate form_data if needed, then build query and fetch data
          return multiChartMigration(copyFormData)
            .then(migratedFormData => {
              const subsliceCopy = {
                ...subslice,
                form_data: migratedFormData as QueryFormData,
              };

              const queryContext = buildDartMapLayerQuery(
                subsliceCopy.form_data,
              );

              return SupersetClient.post({
                endpoint: '/api/v1/chart/data',
                jsonPayload: { ...queryContext },
              }).then(({ json }: { json: JsonObject }) => {
                // Transform API response to match expected format
                const result = json?.result?.[0] || {};
                const payload = { data: result.data || [] };

                // Build ChartProps-like object for transformProps
                const chartProps = {
                  height: 400,
                  width: 600,
                  formData: subsliceCopy.form_data,
                  queriesData: [{ data: payload?.data || [] }],
                  hooks: {
                    onAddFilter: props.onAddFilter,
                    setControlValue: () => {},
                  },
                } as any;

                // Use transformProps to process data (same logic as standalone chart)
                const transformedProps = transformDartMapLayerProps(chartProps);

                const sliceHoverColumnNames = transformedProps.hoverColumnNames;
                const sliceFeatureInfoColumnNames =
                  transformedProps.featureInfoColumnNames;
                const newLayer = getDartMapLayer(
                  transformedProps.formData as any,
                  transformedProps.payload,
                  props.onAddFilter,
                  setTooltip,
                  transformedProps.categories || {},
                  transformedProps.visualConfig,
                  sliceHoverColumnNames,
                  (info: any) =>
                    handleFeatureClick(info, sliceFeatureInfoColumnNames),
                );

                if (!newLayer) {
                  return null;
                }
                // Extract legend name from form_data.params.geojsonConfig or fall back to slice name
                const payloadData = payload?.data || [];
                const geometryType = getGeometryType(payloadData[0]?.geojson);
                let transformPropsGeojsonLayer =
                  transformedProps.formData.geoJsonLayer;

                if (transformPropsGeojsonLayer !== geometryType) {
                  transformPropsGeojsonLayer = geometryType;
                }
                const transformedPropsConfig =
                  transformedProps.formData.geojsonConfig;
                let icon; // need to get icon from json payload
                let params;
                const legendName = (() => {
                  try {
                    params = JSON.parse(transformedPropsConfig || '{}');
                    icon = params.globalColoring.pointType;
                    if (params.legend) {
                      const formattedLegendName = toTitleCase(
                        params.legend?.name,
                      );
                      return formattedLegendName || subslice.slice_name;
                    }
                    return subslice.slice_name;
                  } catch (e) {
                    return subslice.slice_name;
                  }
                })();

                // Build the LegendGroup based on what coloring mode is active
                const { categories, visualConfig } = transformedProps;
                const { dimension, metricLegend } = visualConfig;
                const hasCategories =
                  dimension && categories && Object.keys(categories).length > 0;
                const hasMetric =
                  metricLegend !== null && metricLegend !== undefined;

                // Get legend config from JSON
                // For categorical: legend.title is the header, legend.name is null
                // For simple/base: legend.title is the header, legend.name is the expanded content
                const legendTitle = params?.legend?.title
                  ? toTitleCase(params.legend.title)
                  : null;
                const legendNameFromJson = params?.legend?.name
                  ? toTitleCase(params.legend.name)
                  : null;

                let legendGroup: LegendGroup;

                if (hasMetric) {
                  // Metric-based coloring (gradient)
                  // Use legend.title from JSON for legend header
                  const ml = metricLegend as MetricLegend;
                  legendGroup = {
                    legendName: legendTitle || legendName,
                    sliceName: subslice.slice_name,
                    icon,
                    geometryType: transformPropsGeojsonLayer,
                    type: 'metric',
                    metric: {
                      lower: ml.min,
                      upper: ml.max,
                      startColor: ml.startColor,
                      endColor: ml.endColor,
                    },
                  };
                } else if (hasCategories) {
                  // Category-based coloring
                  // Use legend.title from JSON for legend header (legend.name is null)
                  const categoryEntries = Object.entries(
                    categories as Record<string, CategoryState>,
                  )
                    .filter(([_, catState]) => catState.enabled !== false)
                    .map(([label, catState]) => ({
                      label: catState.legend_name || label,
                      fillColor: catState.color,
                      strokeColor: visualConfig.strokeColor as RGBAColor,
                    }));

                  legendGroup = {
                    legendName: legendTitle || legendName,
                    sliceName: subslice.slice_name,
                    icon,
                    geometryType: transformPropsGeojsonLayer,
                    type: 'categorical',
                    categories: categoryEntries,
                  };
                } else {
                  // Simple/static coloring (base charts - no categories or metrics)
                  // legendParentTitle = legend.title (shown as header)
                  // legendName = legend.name (shown in expanded content)
                  const fillColor = visualConfig.fillColor as RGBAColor;
                  const strokeColor = visualConfig.strokeColor as RGBAColor;

                  legendGroup = {
                    legendName: legendNameFromJson || legendName,
                    legendParentTitle: legendTitle || subslice.slice_name,
                    sliceName: subslice.slice_name,
                    icon,
                    geometryType: transformPropsGeojsonLayer,
                    type: 'simple',
                    simpleStyle: {
                      fillColor,
                      strokeColor,
                    },
                  };
                }

                const zoomSlider = subsliceCopy.form_data.minMaxZoomSlider || [
                  0, 22,
                ];
                const newLayerStateOptions = {
                  minZoom: zoomSlider[0],
                  maxZoom: zoomSlider[1],
                };

                const newLayerState = layerStateGenerator(
                  newLayer,
                  newLayerStateOptions,
                );

                if (!newLayerState) {
                  return null;
                }

                // Store layer with its features for autozoom calculation
                const layerFeatures: JsonObject[] =
                  transformedProps.payload?.data?.features || [];

                return {
                  sliceId: subsliceCopy.slice_id,
                  layerState: newLayerState,
                  legendGroup,
                  features: layerFeatures,
                  autozoom: sliceAutozoom,
                  // Store data needed to rebuild layer when category visibility changes
                  transformedProps: {
                    formData: transformedProps.formData,
                    payload: transformedProps.payload,
                    categories: transformedProps.categories || {},
                    visualConfig: transformedProps.visualConfig,
                    hoverColumnNames: transformedProps.hoverColumnNames,
                  },
                  zoomSliderOptions: newLayerStateOptions,
                };
              });
            })
            .catch(() => null);
        }),
      ).then(results => {
        const validLayers = results.filter(
          (entry): entry is SubsliceLayerEntry => entry !== null,
        );
        setSubSlicesLayers(validLayers);
      });
    },
    [props.onAddFilter, setTooltip, handleFeatureClick],
  );

  const prevSlicesData = usePrevious(slicesData);

  useEffect(() => {
    if (!isEqual(prevSlicesData, slicesData) && slicesData?.length) {
      loadLayers(props.formData, slicesData, normalizedDeckSlices);
    }
  }, [
    loadLayers,
    prevSlicesData,
    slicesData,
    props.formData,
    normalizedDeckSlices,
  ]);

  // Sync autozoom settings when they change (without reloading layers)
  useEffect(() => {
    setSubSlicesLayers(currentLayers => {
      if (!currentLayers.length) return currentLayers;

      const autozoomMap = new Map(
        normalizedDeckSlices.map(c => [c.sliceId, c.autozoom]),
      );

      const needsUpdate = currentLayers.some(
        layer => layer.autozoom !== (autozoomMap.get(layer.sliceId) ?? true),
      );

      if (!needsUpdate) return currentLayers;

      return currentLayers.map(layer => ({
        ...layer,
        autozoom: autozoomMap.get(layer.sliceId) ?? true,
      }));
    });
  }, [normalizedDeckSlices]);

  const { setControlValue, height, width } = props;

  // Toggle layer visibility callback
  const handleToggleLayerVisibility = useCallback(
    (sliceId: string) => {
      const entry = subSlicesLayers.find(e => String(e.sliceId) === sliceId);
      const isCurrentlyVisible = layerVisibility[sliceId] !== false;

      const isCategoricalLayer =
        entry?.legendGroup.type === 'categorical' &&
        entry.legendGroup.categories;

      // If turning OFF the layer, also turn off all category checkboxes
      if (isCurrentlyVisible && isCategoricalLayer) {
        const allCategoriesOff: Record<string, boolean> = {};
        entry.legendGroup.categories!.forEach(cat => {
          allCategoriesOff[cat.label] = false;
        });
        setCategoryVisibility(prev => ({
          ...prev,
          [sliceId]: allCategoriesOff,
        }));
      } else if (!isCurrentlyVisible && isCategoricalLayer) {
        // If trying to turn ON, check if any category is enabled
        // If all categories were explicitly disabled, re-enable them all
        const sliceCatVisibility = categoryVisibility[sliceId] || {};
        const anyEnabled = entry.legendGroup.categories!.some(
          cat => sliceCatVisibility[cat.label] !== false,
        );
        // If all categories are off, re-enable them all when turning layer on
        if (!anyEnabled && Object.keys(sliceCatVisibility).length > 0) {
          const allCategoriesOn: Record<string, boolean> = {};
          entry.legendGroup.categories!.forEach(cat => {
            allCategoriesOn[cat.label] = true;
          });
          setCategoryVisibility(prev => ({
            ...prev,
            [sliceId]: allCategoriesOn,
          }));
        }
      }

      setLayerVisibility(prev => ({
        ...prev,
        [sliceId]: !isCurrentlyVisible,
      }));
    },
    [subSlicesLayers, categoryVisibility, layerVisibility],
  );

  // Toggle a single category within a slice
  const handleToggleCategory = useCallback(
    (sliceId: string, categoryLabel: string) => {
      setCategoryVisibility(prev => {
        const sliceCategories = prev[sliceId] || {};
        const isCurrentlyEnabled = sliceCategories[categoryLabel] !== false;
        return {
          ...prev,
          [sliceId]: {
            ...sliceCategories,
            [categoryLabel]: !isCurrentlyEnabled,
          },
        };
      });
    },
    [],
  );

  // Rebuild layers when category visibility changes
  // This effect regenerates the deck.gl layer with updated category filtering
  useEffect(() => {
    if (Object.keys(categoryVisibility).length === 0) return;

    setSubSlicesLayers(currentLayers => {
      let anyChanged = false;

      const updatedLayers = currentLayers.map(entry => {
        const sliceId = String(entry.sliceId);
        const sliceCatVisibility = categoryVisibility[sliceId];

        // Skip if no category visibility changes for this slice
        if (
          !sliceCatVisibility ||
          Object.keys(sliceCatVisibility).length === 0
        ) {
          return entry;
        }

        // Skip if not a categorical layer
        if (entry.legendGroup.type !== 'categorical') {
          return entry;
        }

        // Build updated categories with enabled state
        const updatedCategories: Record<string, CategoryState> = {};
        for (const [key, catState] of Object.entries(
          entry.transformedProps.categories,
        )) {
          const catLabel = catState.legend_name || key;
          const isEnabled = sliceCatVisibility[catLabel] !== false;
          updatedCategories[key] = {
            ...catState,
            enabled: isEnabled,
          };
        }

        // Rebuild the layer with updated categories
        const newLayer = getDartMapLayer(
          entry.transformedProps.formData,
          entry.transformedProps.payload,
          props.onAddFilter,
          setTooltip,
          updatedCategories,
          entry.transformedProps.visualConfig,
          entry.transformedProps.hoverColumnNames,
        );

        if (!newLayer) {
          return entry;
        }

        const newLayerState = layerStateGenerator(
          newLayer,
          entry.zoomSliderOptions,
        );
        if (!newLayerState) {
          return entry;
        }

        anyChanged = true;

        // Update legendGroup categories with enabled state
        const updatedLegendCategories = entry.legendGroup.categories?.map(
          cat => ({
            ...cat,
            enabled: sliceCatVisibility[cat.label] !== false,
          }),
        );

        return {
          ...entry,
          layerState: newLayerState,
          transformedProps: {
            ...entry.transformedProps,
            categories: updatedCategories,
          },
          legendGroup: {
            ...entry.legendGroup,
            categories: updatedLegendCategories,
          },
        };
      });

      return anyChanged ? updatedLayers : currentLayers;
    });
  }, [categoryVisibility, props.onAddFilter, setTooltip]);

  // Sync layer visibility with category visibility
  // If all categories are off, hide the layer; if any category is on, show the layer
  useEffect(() => {
    if (subSlicesLayers.length === 0) return;

    setLayerVisibility(prev => {
      const updates: Record<string, boolean> = {};

      subSlicesLayers.forEach(entry => {
        const { type, categories } = entry.legendGroup;

        // Only apply to categorical layers
        if (type !== 'categorical' || !categories) {
          return;
        }

        const sliceId = String(entry.sliceId);
        const sliceCatVisibility = categoryVisibility[sliceId] || {};

        // Check if any category is enabled
        const anyEnabled = categories.some(
          cat => sliceCatVisibility[cat.label] !== false,
        );

        // Check if all categories have been explicitly set (user has interacted)
        const hasInteracted = Object.keys(sliceCatVisibility).length > 0;

        if (hasInteracted) {
          if (!anyEnabled && prev[sliceId] !== false) {
            // All categories off -> hide layer
            updates[sliceId] = false;
          } else if (anyEnabled && prev[sliceId] === false) {
            // Some category on and layer was hidden -> show layer
            updates[sliceId] = true;
          }
        }
      });

      if (Object.keys(updates).length === 0) {
        return prev;
      }

      return { ...prev, ...updates };
    });
  }, [categoryVisibility, subSlicesLayers]);

  // Sort layers based on config order
  const sortedLayers = useMemo(() => {
    const sliceIdOrder = normalizedDeckSlices.map(c => c.sliceId);
    return [...subSlicesLayers].sort(
      (a, b) =>
        sliceIdOrder.indexOf(b.sliceId) - sliceIdOrder.indexOf(a.sliceId),
    );
  }, [subSlicesLayers, normalizedDeckSlices]);

  // Set layer visibility via options.userVisible (preserves icon atlas for faster toggle)
  const layerStatesWithVisibility = sortedLayers.map(entry => {
    const isVisible = layerVisibility[String(entry.sliceId)] !== false;
    return {
      ...entry.layerState,
      options: {
        ...entry.layerState.options,
        userVisible: isVisible,
      },
    };
  });

  // Build legendsBySlice for MultiLegend component, with category enabled state applied
  const legendsBySlice: Record<string, LegendGroup> = useMemo(
    () =>
      Object.fromEntries(
        sortedLayers.map(entry => {
          const sliceId = String(entry.sliceId);
          const group = entry.legendGroup;

          // If no categories, return as-is
          if (!group.categories) {
            return [sliceId, group];
          }

          // Apply category visibility state
          const sliceCatVisibility = categoryVisibility[sliceId] || {};
          const updatedCategories = group.categories.map(cat => ({
            ...cat,
            enabled: sliceCatVisibility[cat.label] !== false,
          }));

          return [
            sliceId,
            {
              ...group,
              categories: updatedCategories,
            },
          ];
        }),
      ),
    [sortedLayers, categoryVisibility],
  );

  // Calculate autozoom viewport from layers with autozoom enabled
  const viewport: Viewport = useMemo(() => {
    const autozoomLayers = sortedLayers.filter(entry => entry.autozoom);
    if (!autozoomLayers.length) return props.viewport;
    const allFeatures = autozoomLayers.flatMap(entry => entry.features);
    return calculateAutozoomViewport(
      allFeatures,
      props.viewport,
      width,
      height,
    );
  }, [sortedLayers, props.viewport, width, height]);

  // Map control handlers - must be defined before any conditional returns
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
  const [measureState, setMeasureState] = useState<{
    startPoint: [number, number] | null;
    endPoint: [number, number] | null;
    isActive: boolean;
    isDragging: boolean;
  }>({
    startPoint: null,
    endPoint: null,
    isActive: false,
    isDragging: false,
  });

  // Keep ref in sync with measure state for use in callbacks
  measureActiveRef.current = measureState.isActive;

  const handleRulerToggle = useCallback(() => {
    setMeasureState(prev => {
      if (prev.isActive) {
        return {
          startPoint: null,
          endPoint: null,
          isActive: false,
          isDragging: false,
        };
      }
      return {
        startPoint: null,
        endPoint: null,
        isActive: true,
        isDragging: false,
      };
    });
  }, []);

  const handleMeasureClick = useCallback((coordinate: [number, number]) => {
    setMeasureState(prev => {
      if (!prev.isActive || prev.isDragging) return prev;
      if (!prev.startPoint) {
        return { ...prev, startPoint: coordinate };
      }
      if (!prev.endPoint) {
        return { ...prev, endPoint: coordinate };
      }
      return { ...prev, startPoint: coordinate, endPoint: null };
    });
  }, []);

  // Drag handlers for drag-to-measure
  const handleMeasureDragStart = useCallback((coordinate: [number, number]) => {
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

  const handleMeasureDrag = useCallback((coordinate: [number, number]) => {
    setMeasureState(prev => {
      if (!prev.isActive || !prev.isDragging) return prev;
      return { ...prev, endPoint: coordinate };
    });
  }, []);

  const handleMeasureDragEnd = useCallback((coordinate: [number, number]) => {
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

  // Show loading state until slices data is fetched and layers are processed
  const hasChartsToLoad = normalizedDeckSlices.length > 0;
  const isLoading = hasChartsToLoad && subSlicesLayers.length === 0;

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height,
          width,
        }}
      >
        <img
          alt="Loading..."
          src="/static/assets/images/loading.gif"
          style={{ width: 50 }}
        />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden' }}>
      <DeckGLContainerStyledWrapper
        ref={containerRef}
        mapboxApiAccessToken={effectiveMapboxKey || 'no-token'}
        viewport={viewport}
        initialViewport={viewport}
        layerStates={layerStatesWithVisibility}
        mapStyle={mapStyle}
        setControlValue={setControlValue}
        height={height}
        width={width}
        measureState={measureState}
        onMeasureClick={handleMeasureClick}
        onMeasureDragStart={handleMeasureDragStart}
        onMeasureDrag={handleMeasureDrag}
        onMeasureDragEnd={handleMeasureDragEnd}
        onEmptyClick={handleClosePopup}
      />
      <MultiLegend
        legendsBySlice={legendsBySlice}
        layerVisibility={layerVisibility}
        onToggleLayerVisibility={handleToggleLayerVisibility}
        onToggleCategory={handleToggleCategory}
      />
      <MapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onRulerToggle={handleRulerToggle}
        isRulerActive={measureState.isActive}
        position="top-right"
      />
      {clickedFeature && (
        <ClickPopupBox
          feature={clickedFeature}
          onClose={handleClosePopup}
          featureInfoColumnNames={clickedFeature.featureInfoColumnNames}
          position="right"
        />
      )}
    </div>
  );
};

export default memo(DeckMulti);
