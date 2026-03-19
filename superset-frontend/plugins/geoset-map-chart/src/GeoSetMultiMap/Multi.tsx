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
  getLayer as getGeoSetMapLayer,
  getLayerStates as layerStatesGenerator,
} from '../layers/GeoSetLayer/GeoSetLayer';
import { calculateAutozoomViewport, Viewport } from '../utils/fitViewport';
import { TooltipProps } from '../components/Tooltip';
import { LayerState } from '../types';
import buildGeoSetMapLayerQuery from '../buildQuery';
import transformGeoSetMapLayerProps from '../transformProps';
import MultiLegend from '../components/MultiLegend';
import type { CategoryEntry, LegendEntry } from '../types';
import { useGroupedLegend } from '../utils/hooks';
import MapControls from '../components/MapControls';
import { CategoryState, MetricLegend, RGBAColor } from '../utils/colors';
import { getGeometryType } from '../utils/dataProcessing';
import { fetchMapboxApiKey, getCachedMapboxApiKey } from '../utils/mapboxApi';
import { multiChartMigration } from '../utils/migrationApi';
import ClickPopupBox, { ClickedFeatureInfo } from '../components/ClickPopupBox';
import { setLiveViewport } from '../utils/liveViewportStore';
import {
  DeckSliceConfig,
  resolveLayerAutozoom,
  normalizeDeckSlices,
  loadLayersOrchestrated,
} from './multiUtils';
import { applyCategoryEnabledState } from '../utils/legendHelpers';

// Utility to convert snake_case or camelCase to Title Case
const toTitleCase = (str: string) =>
  str
    .replace(/_/g, ' ')
    .replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1));

/** Build a placeholder legend entry from slice metadata (before layer data is fetched). */
const buildStubLegendEntry = (
  subslice: JsonObject,
  sliceConfig: DeckSliceConfig | undefined,
): LegendEntry => {
  const geojsonConfig = subslice.form_data?.geojsonConfig;
  let icon: string | undefined;
  let legendName: string = subslice.slice_name as string;
  let legendTitle: string | null = null;

  try {
    const params = JSON.parse(geojsonConfig || '{}');
    icon = params.globalColoring?.pointType;
    if (params.legend?.name) {
      legendName = toTitleCase(params.legend.name);
    }
    if (params.legend?.title) {
      legendTitle = toTitleCase(params.legend.title);
    }
  } catch {
    // Fall back to slice_name
  }

  return {
    legendName: legendTitle || legendName,
    legendParentTitle: legendTitle || (subslice.slice_name as string),
    sliceName: subslice.slice_name as string,
    icon,
    geometryType: subslice.form_data?.geoJsonLayer,
    type: 'simple',
    initialCollapsed: sliceConfig?.legendCollapsed ?? false,
    loading: true,
  };
};

export type DeckMultiProps = {
  formData: QueryFormData;
  payload: JsonObject;
  setControlValue: (control: string, value: JsonValue) => void;
  mapboxApiKey: string;
  mapStyle: string;
  viewport: Viewport;
  enableStaticViewport: boolean;
  onAddFilter: HandlerFunction;
  height: number;
  width: number;
  datasource: Datasource;
  onSelect: () => void;
};

type SubsliceLayerEntry = {
  sliceId: number;
  layerStates: LayerState[];
  legendEntry: LegendEntry;
  features: JsonObject[];
  autozoom: boolean;
  // Store data needed to rebuild layer when category visibility changes
  transformedProps: {
    formData: any;
    payload: any;
    categories: Record<string, CategoryState>;
    visualConfig: any;
    hoverColumnNames: string[];
    featureInfoColumnNames: string[];
  };
  zoomSliderOptions: { minZoom: number; maxZoom: number };
  initiallyHidden: boolean; // Whether this layer starts hidden
  lazyLoading: boolean; // Whether this layer is configured for lazy loading
};

interface ClickedFeatureWithColumns extends ClickedFeatureInfo {
  featureInfoColumnNames?: string[];
}

const DeckMulti = (props: DeckMultiProps) => {
  const containerRef = useRef<DeckGLContainerHandle>(null);
  // Ref to track measure state for use in callbacks without creating dependencies
  const measureActiveRef = useRef(false);
  // Generation counter to cancel stale lazy-loading chains
  const loadGenerationRef = useRef(0);
  // Store initial autozoom viewport to prevent reset on category toggle
  const initialAutozoomViewportRef = useRef<Viewport | null>(null);

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

  // Build stub legend entries from slice metadata (shown while layer data loads)
  const pendingLegends: Record<string, LegendEntry> = useMemo(() => {
    if (!slicesData?.length) return {};
    const configById = new Map(normalizedDeckSlices.map(c => [c.sliceId, c]));
    return Object.fromEntries(
      slicesData.map((subslice: JsonObject) => [
        String(subslice.slice_id),
        buildStubLegendEntry(
          subslice,
          configById.get(subslice.slice_id as number),
        ),
      ]),
    );
  }, [slicesData, normalizedDeckSlices]);

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

  // Load a single subslice and return its layer entry
  const loadSingleLayer = useCallback(
    (
      formData: QueryFormData,
      subslice: JsonObject,
      sliceConfig: DeckSliceConfig | undefined,
    ): Promise<SubsliceLayerEntry | null> => {
      const sliceAutozoom = resolveLayerAutozoom(sliceConfig);
      const sliceLegendCollapsed = sliceConfig?.legendCollapsed ?? false;
      const sliceInitiallyHidden = sliceConfig?.initiallyHidden ?? false;
      const sliceLazyLoading = sliceConfig?.lazyLoading ?? false;
      let copyFormData = {
        ...subslice.form_data,
      };
      if (formData.extraFormData) {
        copyFormData = {
          ...copyFormData,
          extra_form_data: formData.extraFormData,
        };
      }

      return (
        multiChartMigration(copyFormData)
          .then(migratedFormData => {
            const subsliceCopy = {
              ...subslice,
              form_data: migratedFormData as QueryFormData,
            };

            const queryContext = buildGeoSetMapLayerQuery(
              subsliceCopy.form_data,
            );

            return SupersetClient.post({
              endpoint: '/api/v1/chart/data',
              jsonPayload: { ...queryContext },
            }).then(({ json }: { json: JsonObject }) => {
              const result = json?.result?.[0] || {};
              const payload = { data: result.data || [] };

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

              const transformedProps = transformGeoSetMapLayerProps(chartProps);

              const sliceHoverColumnNames = transformedProps.hoverColumnNames;
              const sliceFeatureInfoColumnNames =
                transformedProps.featureInfoColumnNames;
              const newLayer = getGeoSetMapLayer(
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

              const payloadData = payload?.data || [];
              const geometryType = getGeometryType(payloadData[0]?.geojson);
              let transformPropsGeojsonLayer =
                transformedProps.formData.geoJsonLayer;

              if (
                transformPropsGeojsonLayer !== 'TextOverlay' &&
                transformPropsGeojsonLayer !== geometryType
              ) {
                transformPropsGeojsonLayer = geometryType;
              }
              const transformedPropsConfig =
                transformedProps.formData.geojsonConfig;
              let icon;
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

              const { categories, visualConfig } = transformedProps;
              const {
                dimension,
                metricLegend,
                sizeLegend,
                isCombinedMetricSize,
              } = visualConfig;
              const hasCategories =
                dimension && categories && Object.keys(categories).length > 0;
              const hasMetric =
                metricLegend !== null && metricLegend !== undefined;

              const legendTitle = params?.legend?.title
                ? toTitleCase(params.legend.title)
                : null;
              const legendNameFromJson = params?.legend?.name
                ? toTitleCase(params.legend.name)
                : null;

              const buildSizeEntry = () =>
                sizeLegend ? { ...sizeLegend } : undefined;

              let legendEntry: LegendEntry;

              if (hasMetric) {
                const ml = metricLegend as MetricLegend;
                const isCombined = isCombinedMetricSize === true;
                legendEntry = {
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
                    usesPercentBounds: ml.usesPercentBounds,
                  },
                  sizeEntry: isCombined ? buildSizeEntry() : undefined,
                  isCombinedMetricSize: isCombined,
                  initialCollapsed: sliceLegendCollapsed,
                };
              } else if (hasCategories) {
                const categoryEntries = Object.entries(
                  categories as Record<string, CategoryState>,
                )
                  .filter(([_, catState]) => catState.enabled !== false)
                  .map(([label, catState]) => ({
                    label: catState.legend_name || label,
                    fillColor: catState.color,
                    strokeColor: visualConfig.strokeColor as RGBAColor,
                  }));

                legendEntry = {
                  legendName: legendTitle || legendName,
                  sliceName: subslice.slice_name,
                  icon,
                  geometryType: transformPropsGeojsonLayer,
                  type: 'categorical',
                  categories: categoryEntries,
                  sizeEntry: buildSizeEntry(),
                  initialCollapsed: sliceLegendCollapsed,
                };
              } else {
                const fillColor = visualConfig.fillColor as RGBAColor;
                const strokeColor = visualConfig.strokeColor as RGBAColor;

                legendEntry = {
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
                  sizeEntry: buildSizeEntry(),
                  initialCollapsed: sliceLegendCollapsed,
                };
              }

              const zoomSlider = subsliceCopy.form_data.minMaxZoomSlider || [
                0, 22,
              ];
              const newLayerStateOptions = {
                minZoom: zoomSlider[0],
                maxZoom: zoomSlider[1],
              };

              const newLayerStates = layerStatesGenerator(
                newLayer,
                newLayerStateOptions,
              );

              if (!newLayerStates.length) {
                return null;
              }

              const layerFeatures: JsonObject[] =
                transformedProps.payload?.data?.features || [];

              return {
                sliceId: subslice.slice_id as number,
                layerStates: newLayerStates,
                legendEntry,
                features: layerFeatures,
                autozoom: sliceAutozoom,
                transformedProps: {
                  formData: transformedProps.formData,
                  payload: transformedProps.payload,
                  categories: transformedProps.categories || {},
                  visualConfig: transformedProps.visualConfig,
                  hoverColumnNames: transformedProps.hoverColumnNames,
                  featureInfoColumnNames:
                    transformedProps.featureInfoColumnNames || [],
                },
                zoomSliderOptions: newLayerStateOptions,
                initiallyHidden: sliceInitiallyHidden,
                lazyLoading: sliceLazyLoading,
              };
            });
          })
          // IMPORTANT: This .catch is load-bearing. It ensures a single layer
          // failure resolves to null instead of rejecting, which would abort the
          // entire lazy-loading reduce chain or the eager Promise.all batch.
          .catch(err => {
            // eslint-disable-next-line no-console
            console.error(
              `[GeoSet] Failed to load layer for slice ${subslice.slice_id}:`,
              err,
            );
            return null;
          })
      );
    },
    [props.onAddFilter, setTooltip, handleFeatureClick],
  );

  const loadLayers = useCallback(
    (
      formData: QueryFormData,
      slices: JsonObject[],
      deckSlicesConfig: DeckSliceConfig[],
    ) => {
      // Bump generation so any in-flight lazy chain from a prior call is ignored
      // eslint-disable-next-line no-plusplus
      const generation = ++loadGenerationRef.current;
      setSubSlicesLayers([]);

      // Pre-set layer visibility from config — known upfront, no timing
      // dependency on when layers finish loading.
      const hiddenConfigs = deckSlicesConfig.filter(c => c.initiallyHidden);
      if (hiddenConfigs.length > 0) {
        setLayerVisibility(prev => ({
          ...prev,
          ...Object.fromEntries(
            hiddenConfigs.map(c => [String(c.sliceId), false]),
          ),
        }));
      }

      // Category visibility can only be set once the layer loads (categories
      // aren't known until data is fetched).
      const hideCategoriesIfNeeded = (layers: SubsliceLayerEntry[]) => {
        const categorical = layers.filter(
          l => l.initiallyHidden && l.legendEntry.categories?.length,
        );
        if (categorical.length === 0) return;
        setCategoryVisibility(prev => ({
          ...prev,
          ...Object.fromEntries(
            categorical.map(l => [
              String(l.sliceId),
              Object.fromEntries(
                l.legendEntry.categories!.map(c => [c.label, false]),
              ),
            ]),
          ),
        }));
      };

      loadLayersOrchestrated<SubsliceLayerEntry>(
        slices as { slice_id: number }[],
        deckSlicesConfig,
        {
          loadFn: (subslice, config) =>
            loadSingleLayer(formData, subslice, config),
          onAutozoomComplete: autozoomLayers => {
            setSubSlicesLayers(autozoomLayers);
            hideCategoriesIfNeeded(autozoomLayers);
          },
          onEagerAppend: layer => {
            setSubSlicesLayers(prev => [...prev, layer]);
            hideCategoriesIfNeeded([layer]);
          },
          onLazyAppend: layer => {
            setSubSlicesLayers(prev => [...prev, layer]);
            hideCategoriesIfNeeded([layer]);
          },
          isStale: () => loadGenerationRef.current !== generation,
        },
      ).catch(err => {
        // eslint-disable-next-line no-console
        console.error('[GeoSet] Layer orchestration failed:', err);
      });
    },
    [loadSingleLayer],
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

  // Sync autozoom and lazyLoading settings when they change (without reloading layers)
  useEffect(() => {
    setSubSlicesLayers(currentLayers => {
      if (!currentLayers.length) return currentLayers;

      const configMap = new Map(normalizedDeckSlices.map(c => [c.sliceId, c]));

      const needsUpdate = currentLayers.some(layer => {
        const config = configMap.get(layer.sliceId);
        const expectedAutozoom = resolveLayerAutozoom(config);
        return (
          layer.autozoom !== expectedAutozoom ||
          layer.lazyLoading !== (config?.lazyLoading ?? false)
        );
      });

      if (!needsUpdate) return currentLayers;

      return currentLayers.map(layer => {
        const config = configMap.get(layer.sliceId);
        return {
          ...layer,
          autozoom: resolveLayerAutozoom(config),
          lazyLoading: config?.lazyLoading ?? false,
        };
      });
    });
  }, [normalizedDeckSlices]);

  const { height, width } = props;

  // Toggle layer visibility callback (supports legend groups with multiple sliceIds)
  const handleToggleLayerVisibility = useCallback(
    (sliceIds: string[]) => {
      // If ANY are currently visible → turn all OFF; if NONE visible → turn all ON
      const isGroupVisible = sliceIds.some(id => layerVisibility[id] !== false);

      const buildCategoryMap = (
        categories: CategoryEntry[],
        value: boolean,
      ): Record<string, boolean> =>
        Object.fromEntries(categories.map(c => [c.label, value]));

      const catUpdates: Record<string, Record<string, boolean>> = {};

      sliceIds.forEach(sliceId => {
        const entry = subSlicesLayers.find(e => String(e.sliceId) === sliceId);
        const isCategoricalLayer =
          entry?.legendEntry.type === 'categorical' &&
          entry.legendEntry.categories;

        if (isCategoricalLayer) {
          if (isGroupVisible) {
            // Turning OFF — disable all categories
            catUpdates[sliceId] = buildCategoryMap(
              entry.legendEntry.categories!,
              false,
            );
          } else {
            // Turning ON — re-enable categories if all were off
            const sliceCatVisibility = categoryVisibility[sliceId] || {};
            const anyEnabled = entry.legendEntry.categories!.some(
              cat => sliceCatVisibility[cat.label] !== false,
            );
            if (!anyEnabled && Object.keys(sliceCatVisibility).length > 0) {
              catUpdates[sliceId] = buildCategoryMap(
                entry.legendEntry.categories!,
                true,
              );
            }
          }
        }
      });

      if (Object.keys(catUpdates).length > 0) {
        setCategoryVisibility(prev => ({ ...prev, ...catUpdates }));
      }

      setLayerVisibility(prev => ({
        ...prev,
        ...Object.fromEntries(sliceIds.map(id => [id, !isGroupVisible])),
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
        if (entry.legendEntry.type !== 'categorical') {
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
        const newLayer = getGeoSetMapLayer(
          entry.transformedProps.formData,
          entry.transformedProps.payload,
          props.onAddFilter,
          setTooltip,
          updatedCategories,
          entry.transformedProps.visualConfig,
          entry.transformedProps.hoverColumnNames,
          (info: any) =>
            handleFeatureClick(
              info,
              entry.transformedProps.featureInfoColumnNames,
            ),
        );

        if (!newLayer) {
          return entry;
        }

        const newLayerStates = layerStatesGenerator(
          newLayer,
          entry.zoomSliderOptions,
        );
        if (!newLayerStates.length) {
          return entry;
        }

        anyChanged = true;

        // Update legendEntry categories with enabled state
        const updatedLegendCategories = applyCategoryEnabledState(
          entry.legendEntry.categories,
          sliceCatVisibility,
        );

        return {
          ...entry,
          layerStates: newLayerStates,
          transformedProps: {
            ...entry.transformedProps,
            categories: updatedCategories,
          },
          legendEntry: {
            ...entry.legendEntry,
            categories: updatedLegendCategories,
          },
        };
      });

      return anyChanged ? updatedLayers : currentLayers;
    });
  }, [categoryVisibility, props.onAddFilter, setTooltip, handleFeatureClick]);

  // Sync layer visibility with category visibility
  // If all categories are off, hide the layer; if any category is on, show the layer
  useEffect(() => {
    if (subSlicesLayers.length === 0) return;

    setLayerVisibility(prev => {
      const updates: Record<string, boolean> = {};

      subSlicesLayers.forEach(entry => {
        const { type, categories } = entry.legendEntry;

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

  // Mark hidden layers with userVisible: false so deck.gl keeps them alive
  // but skips rendering. This allows instant toggle-back without reinitializing.
  // flatMap because polygon layers produce multiple LayerStates (fill + stroke)
  // Memoized so DeckGLContainer only sees new prop references when visibility
  // actually changes — prevents a spurious extra render on every Multi re-render.
  const layerStatesWithVisibility = useMemo(
    () =>
      sortedLayers.flatMap(entry => {
        const visKey = String(entry.sliceId);
        const isVisible =
          visKey in layerVisibility
            ? layerVisibility[visKey] !== false
            : !entry.initiallyHidden;
        return entry.layerStates.map(ls => ({
          ...ls,
          options: {
            ...ls.options,
            userVisible: isVisible,
          },
        }));
      }),
    [sortedLayers, layerVisibility],
  );

  // Build legendsBySlice for MultiLegend component, with category enabled state applied.
  // Merges loaded entries with stub entries so the legend shows all layers immediately.
  const legendsBySlice: Record<string, LegendEntry> = useMemo(() => {
    const loadedById = new Map<string, LegendEntry>();
    sortedLayers.forEach(entry => {
      const sliceId = String(entry.sliceId);
      const { legendEntry } = entry;
      if (!legendEntry.categories) {
        loadedById.set(sliceId, legendEntry);
      } else {
        const sliceCatVisibility = categoryVisibility[sliceId] || {};
        loadedById.set(sliceId, {
          ...legendEntry,
          categories: applyCategoryEnabledState(
            legendEntry.categories,
            sliceCatVisibility,
          )!,
        });
      }
    });

    // Iterate in config order (reversed to match sortedLayers convention).
    // Loaded entries replace stubs; unloaded layers keep showing stubs.
    const result: Record<string, LegendEntry> = {};
    const configOrder = [...normalizedDeckSlices].reverse();
    for (const config of configOrder) {
      const sliceId = String(config.sliceId);
      const loaded = loadedById.get(sliceId);
      if (loaded) {
        result[sliceId] = loaded;
      } else if (pendingLegends[sliceId]) {
        result[sliceId] = pendingLegends[sliceId];
      }
    }

    return result;
  }, [pendingLegends, sortedLayers, categoryVisibility, normalizedDeckSlices]);

  // Group legend entries that share the same display title
  const legendGroups = useGroupedLegend(legendsBySlice);

  // Clear cached autozoom when static viewport is enabled so autozoom
  // recalculates fresh if the user toggles static back off
  useEffect(() => {
    if (props.enableStaticViewport) {
      initialAutozoomViewportRef.current = null;
    }
  }, [props.enableStaticViewport]);

  // Calculate autozoom viewport from layers with autozoom enabled
  // Only calculate once on initial load to prevent view reset on category toggle
  const viewport: Viewport = useMemo(() => {
    // When static viewport is enabled, skip autozoom entirely
    if (props.enableStaticViewport) {
      return props.viewport;
    }

    // If we already calculated autozoom, use the stored viewport
    if (initialAutozoomViewportRef.current) {
      return initialAutozoomViewportRef.current;
    }

    const autozoomLayers = sortedLayers.filter(entry => entry.autozoom);
    if (!autozoomLayers.length) return props.viewport;

    const allFeatures = autozoomLayers.flatMap(entry => entry.features);
    const calculatedViewport = calculateAutozoomViewport(
      allFeatures,
      props.viewport,
      width,
      height,
    );

    // Store the initial autozoom viewport
    initialAutozoomViewportRef.current = calculatedViewport;
    return calculatedViewport;
  }, [sortedLayers, props.viewport, width, height, props.enableStaticViewport]);

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

  // Gate map canvas rendering to prevent a viewport jump when autozoom layers
  // load. Phase 1 loads autozoom layers first; the canvas stays hidden until
  // they complete so the viewport is correct on first render.
  //
  // - If any layer has autozoom: wait for phase 1 (autozoom batch) to complete.
  // - If no layers have autozoom: show the map as soon as metadata is fetched.
  const hasChartsToLoad = normalizedDeckSlices.length > 0;
  const hasAutozoomLayers = normalizedDeckSlices.some(config =>
    resolveLayerAutozoom(config),
  );
  const isLoading =
    hasChartsToLoad &&
    (hasAutozoomLayers ? subSlicesLayers.length === 0 : slicesData === null);

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
        setControlValue={viewportSetControlValue}
        layerStates={layerStatesWithVisibility}
        mapStyle={mapStyle}
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
        legendGroups={legendGroups}
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
