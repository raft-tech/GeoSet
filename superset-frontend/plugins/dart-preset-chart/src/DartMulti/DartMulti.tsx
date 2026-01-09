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

import { memo, useCallback, useEffect, useRef, useState } from 'react';
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
import { getExploreLongUrl } from '../utils/explore';
import layerGenerators, { layerStateGenerator } from '../layers';
import { Viewport } from '../utils/fitViewport';
import { DeckLegend } from '../utilities/legend';
import { TooltipProps } from '../components/Tooltip';
import { Row } from '../utilities/flyout';
import { ColorType, LayerState, LegendItem, toColorType } from '../types';

export type DeckMultiProps = {
  formData: QueryFormData;
  payload: JsonObject;
  setControlValue: (control: string, value: JsonValue) => void;
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
  legends: LegendItem[];
};

const DeckMulti = (props: DeckMultiProps) => {
  const containerRef = useRef<DeckGLContainerHandle>(null);

  const [viewport, setViewport] = useState<Viewport>();
  const [subSlicesLayers, setSubSlicesLayers] = useState<SubsliceLayerEntry[]>(
    [],
  );

  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    const { current } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);

  const setFlyoutRows = useCallback((rows: Row[]) => {
    const { current } = containerRef;
    if (current) {
      current.setFlyoutRows(rows);
      current.openFlyout(true);
    }
  }, []);

  const loadLayers = useCallback(
    (
      formData: QueryFormData,
      payload: JsonObject,
      maybeViewport?: Viewport,
    ) => {
      setViewport(maybeViewport);
      setSubSlicesLayers([]);

      payload.data.slices.forEach(
        (subslice: { slice_id: number } & JsonObject) => {
          const filters = [
            ...(subslice.form_data.filters || []),
            ...(formData.filters || []),
            ...(formData.extra_filters || []),
          ];

          let copyFormData = {
            ...subslice.form_data,
            filters,
          };
          if (formData.extra_form_data) {
            copyFormData = {
              ...copyFormData,
              extra_form_data: formData.extra_form_data,
            };
          }

          const subsliceCopy = {
            ...subslice,
            form_data: copyFormData,
          };

          const url = getExploreLongUrl(subsliceCopy.form_data, 'json');

          if (url) {
            SupersetClient.get({ endpoint: url })
              .then(({ json }) => {
                const newLayer = layerGenerators[
                  subsliceCopy.form_data.viz_type
                ](
                  subsliceCopy.form_data,
                  json,
                  props.onAddFilter,
                  setTooltip,
                  setFlyoutRows,
                );

                const newLayerStateOptions = {
                  minZoom: subsliceCopy.form_data.minMaxZoomSlider[0],
                  maxZoom: subsliceCopy.form_data.minMaxZoomSlider[1],
                };

                const newLayerState = layerStateGenerator(
                  newLayer,
                  newLayerStateOptions,
                );

                const legends: LegendItem[] = [];

                if (subsliceCopy.form_data.dimension) {
                  const dim = subsliceCopy.form_data.dimension;

                  // gather categories and colors from newLayer data
                  const { data } = newLayer.props;

                  const categoryMap = new Map<string, ColorType>();

                  for (const d of data.features || data) {
                    const category = d.extraProps[dim] || 'Uncategorized';
                    const { color } = d;

                    if (!categoryMap.has(category)) {
                      categoryMap.set(category, toColorType(color));
                    }
                  }

                  Array.from(categoryMap.entries()).forEach(
                    ([label, color]) => {
                      legends.push({
                        type: subsliceCopy.form_data.icon_type,
                        description: label,
                        style: {
                          fillColor: color,
                          strokeColor:
                            subsliceCopy.form_data.stroke_color_picker,
                        },
                      });
                    },
                  );
                } else {
                  legends.push({
                    type: subsliceCopy.form_data.icon_type,
                    description: subslice.slice_name,
                    style: {
                      fillColor: subsliceCopy.form_data.fill_color_picker,
                      strokeColor: subsliceCopy.form_data.stroke_color_picker,
                    },
                  });
                }

                setSubSlicesLayers(currentLayers => [
                  ...currentLayers,
                  {
                    sliceId: subsliceCopy.slice_id,
                    layerState: newLayerState,
                    legends,
                  },
                ]);
              })
              .catch(() => {});
          }
        },
      );
    },
    [props.onAddFilter, setTooltip, setFlyoutRows],
  );

  const prevDeckSlices = usePrevious(props.formData.deck_slices);
  useEffect(() => {
    const { formData, payload } = props;
    const hasChanges = !isEqual(prevDeckSlices, formData.deck_slices);
    if (hasChanges) {
      loadLayers(formData, payload);
    }
  }, [loadLayers, props, prevDeckSlices]);

  const { payload, formData, setControlValue, height, width } = props;
  subSlicesLayers.sort(
    (a, b) =>
      formData.deck_slices.indexOf(b.sliceId) -
      formData.deck_slices.indexOf(a.sliceId),
  );
  const layerStates = subSlicesLayers.map(entry => entry.layerState);

  const legends: Record<number, LegendItem[]> = subSlicesLayers.reduce<
    Record<number, LegendItem[]>
  >((acc, entry) => {
    acc[entry.sliceId] = entry.legends;
    // acc.push(...entry.legends);
    return acc;
  }, []);

  return (
    <div>
      <DeckGLContainerStyledWrapper
        ref={containerRef}
        mapboxApiAccessToken={payload.data.mapboxApiKey}
        viewport={viewport || props.viewport}
        layerStates={layerStates}
        mapStyle={formData.mapbox_style}
        setControlValue={setControlValue}
        onViewportChange={setViewport}
        height={height}
        width={width}
      />
      {DeckLegend(legends)}
    </div>
  );
};

export default memo(DeckMulti);
