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

import { ChartProps } from '@superset-ui/core';

const NOOP = () => {};

/**
 * transformProps for the GeoSet Map Multi chart.
 *
 * This is a simple pass-through that provides the props needed by Multi.tsx.
 * The Multi chart fetches its own subslice data, so we just need basic props.
 */
export default function transformProps(chartProps: ChartProps) {
  const { datasource, height, hooks, queriesData, rawFormData, width } =
    chartProps;
  const { onAddFilter = NOOP, setControlValue = NOOP } = hooks;

  const MAPBOX_API_TOKEN = process.env.MAPBOX_API_KEY || '';

  // Handle both snake_case and camelCase for mapStyle
  const mapStyle =
    rawFormData.mapbox_style ||
    rawFormData.mapboxStyle ||
    'mapbox://styles/acf-dart/cm8ov8yl4001401s365rs672z';

  const enableStaticViewport = rawFormData.enable_static_viewport || false;

  return {
    datasource,
    formData: rawFormData,
    height,
    onAddFilter,
    payload: queriesData[0] || { data: {} },
    setControlValue,
    mapboxApiKey: MAPBOX_API_TOKEN,
    mapStyle,
    enableStaticViewport,
    viewport: {
      ...rawFormData.viewport,
      height,
      width,
    },
    width,
  };
}
