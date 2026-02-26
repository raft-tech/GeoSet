/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable theme-colors/no-literal-colors */
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
import { ControlPanelConfig } from '@superset-ui/chart-controls';
import { t } from '@superset-ui/core';
import {
  featureInfoColumns,
  hoverDataColumns,
  minMaxZoomSlider,
  viewportControl,
  mapboxStyle,
  autozoom,
  enableClustering,
  clusterMaxZoom,
  clusterMinPoints,
  clusterRadius,
  textLabelColumn,
} from '../../utilities/Shared_DeckGL';
import { dndGeojsonColumn } from '../../utilities/sharedDndControls';
import JsonEditorControl from '../../components/JsonEditorControl';
import { CURRENT_VERSION } from '../common';
import { getLiveViewport } from '../../utils/liveViewportStore';

const geoJsonLayers: [string, string][] = [
  ['GeoJSON', 'GeoJSON'],
  ['Point', 'Point'],
  ['Line', 'Line'],
  ['Polygon', 'Polygon'],
  ['TextOverlay', 'Text Overlay'],
];

const defaultGeojsonConfig = JSON.stringify(
  {
    globalColoring: {
      fillColor: [40, 147, 179, 255],
      strokeColor: [0, 0, 0, 255],
      strokeWidth: 2,
      fillPattern: 'solid',
    },
    // colorByCategory: {
    //   dimension: 'category_column',
    //   categoricalColors: [
    //     {
    //       category_1_name: {
    //         fillColor: [0, 0, 255, 255],
    //         legend_entry_name: 'category_1_legend_name',
    //       },
    //     },
    //     {
    //       category_2_name: {
    //         fillColor: [255, 0, 0, 255],
    //         legend_entry_name: 'category_2_legend_name',
    //       },
    //     },
    //   ],
    //   defaultLegendName: ['Other'],
    // },
    // colorByValue: {
    //   valueColumn: 'column_metrics_will_be_applied_to',
    //   upperBound: null,
    //   lowerBound: null,
    //   startColor: [0, 255, 0, 255],
    //   endColor: [255, 0, 0, 255],
    //   breakpoints: [],
    // },
    legend: {
      title: 'legend_parent_title',
      name: 'human_readable_legend_chart_title',
    },
  },
  null,
  2,
);

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Map Configuration'),
      expanded: true,
      controlSetRows: [
        [mapboxStyle],
        [autozoom],
        [
          {
            name: viewportControl.name,
            config: {
              ...viewportControl.config,
              visibility: ({ controls }: { controls: any }) =>
                controls?.autozoom?.value !== true,
              shouldMapStateToProps: () => true,
              mapStateToProps: () => ({
                getLiveViewport,
              }),
            },
          },
        ],
        [dndGeojsonColumn],
        ['row_limit'],
        [
          {
            name: 'geoJsonLayer',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Layer Type'),
              clearable: false,
              default: 'Polygon',
              choices: geoJsonLayers,
              description: t(
                'Select the Geospatial data layer type to render: Polygon, Line, Point, or GeoJSON.',
              ),
            },
          },
        ],
        [
          {
            name: enableClustering.name,
            config: {
              ...enableClustering.config,
              visibility: ({ controls }: { controls: any }) =>
                controls?.geoJsonLayer?.value === 'Point',
            },
          },
        ],
        [
          {
            name: clusterMaxZoom.name,
            config: {
              ...clusterMaxZoom.config,
              visibility: ({ controls }: { controls: any }) =>
                controls?.geoJsonLayer?.value === 'Point',
              shouldMapStateToProps: () => true,
              mapStateToProps: ({ controls }: { controls: any }) => ({
                disabled: controls?.enableClustering?.value !== true,
              }),
            },
          },
        ],
        [
          {
            name: clusterMinPoints.name,
            config: {
              ...clusterMinPoints.config,
              visibility: ({ controls }: { controls: any }) =>
                controls?.geoJsonLayer?.value === 'Point',
              shouldMapStateToProps: () => true,
              mapStateToProps: ({ controls }: { controls: any }) => ({
                disabled: controls?.enableClustering?.value !== true,
              }),
            },
          },
        ],
        [
          {
            name: clusterRadius.name,
            config: {
              ...clusterRadius.config,
              visibility: ({ controls }: { controls: any }) =>
                controls?.geoJsonLayer?.value === 'Point',
              shouldMapStateToProps: () => true,
              mapStateToProps: ({ controls }: { controls: any }) => ({
                disabled: controls?.enableClustering?.value !== true,
              }),
            },
          },
        ],
        [
          {
            name: textLabelColumn.name,
            config: {
              ...textLabelColumn.config,
              visibility: ({ controls }: { controls: any }) =>
                controls?.geoJsonLayer?.value === 'TextOverlay',
            },
          },
        ],
        ['adhoc_filters'],
        [minMaxZoomSlider],
        [hoverDataColumns],
        [featureInfoColumns],
        [
          {
            name: 'geojsonConfig',
            config: {
              type: JsonEditorControl,
              label: t('GeoJSON Config'),
              renderTrigger: false,
              height: 200,
              description: t('Advanced GeoJSON visualization configuration...'),
              default: defaultGeojsonConfig,
              mapStateToProps: ({ controls }) => ({
                label: 'GeoJSON Config',
                value: controls?.geojsonConfig?.value ?? undefined,
                defaultValue: defaultGeojsonConfig,
              }),
            },
          },
        ],
        [
          {
            name: 'schema_version',
            config: {
              type: 'HiddenControl',
              default: CURRENT_VERSION,
            },
          },
        ],
      ],
    },
  ],
};

export default config;
