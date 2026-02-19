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
import { t, validateNonEmpty } from '@superset-ui/core';
import {
  mapboxStyle,
  staticViewport,
  viewportControl,
} from '../utilities/Shared_DeckGL';

export default {
  controlPanelSections: [
    {
      label: t('Map'),
      expanded: true,
      controlSetRows: [
        [mapboxStyle],
        [staticViewport],
        [
          {
            name: viewportControl.name,
            config: {
              ...viewportControl.config,
              visibility: ({ controls }: { controls: any }) =>
                controls?.enable_static_viewport?.value === true,
              shouldMapStateToProps: () => true,
              mapStateToProps: ({ controls }: { controls: any }) => ({
                liveViewport: controls?.liveMapViewport?.value,
              }),
            },
          },
        ],
        [
          {
            name: 'deck_slices',
            config: {
              type: 'DeckSlicesControl',
              label: t('GeoSet Layer charts'),
              validators: [validateNonEmpty],
              default: [],
              description: t(
                'Pick a set of GeoSet Layer charts to layer on top of one another',
              ),
              dataEndpoint:
                'api/v1/chart/?q=(filters:!((col:viz_type,opr:eq,value:deck_geoset_map_layer)),page_size:1000)',
              shouldMapStateToProps: () => true,
              mapStateToProps: ({ controls }: { controls: any }) => ({
                staticViewportEnabled:
                  controls?.enable_static_viewport?.value === true,
              }),
            },
          },
          null,
        ],
        [
          {
            name: 'liveMapViewport',
            config: {
              type: 'HiddenControl',
              default: null,
            },
          },
        ],
      ],
    },
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [['adhoc_filters']],
    },
  ],
};
