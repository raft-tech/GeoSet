/* eslint-disable react/jsx-sort-default-props */
/* eslint-disable react/sort-prop-types */
/* eslint-disable react/jsx-handler-names */
/* eslint-disable react/forbid-prop-types */
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
import {
  forwardRef,
  memo,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { StaticMap, MapRef } from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import type { Layer } from '@deck.gl/core';
import { JsonObject, JsonValue, styled } from '@superset-ui/core';
import mapboxgl from 'mapbox-gl';
import Tooltip, { TooltipProps } from './components/Tooltip';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Viewport } from './utils/fitViewport';
import { LayerState } from './types';

const TICK = 250; // milliseconds

export type DeckGLContainerProps = {
  viewport: Viewport;
  setControlValue?: (control: string, value: JsonValue) => void;
  mapStyle?: string;
  mapboxApiAccessToken: string;
  children?: ReactNode;
  width: number;
  height: number;
  layerStates: LayerState[];
};

export const StaticMapStyledWrapper = styled(StaticMap)`
  .mapboxgl-ctrl-logo {
    display: none !important;
  }
`;

export const DeckGLContainer = memo(
  forwardRef((props: DeckGLContainerProps, ref) => {
    console.log('[DeckGLContainer] Rendering with props:', {
      viewport: props.viewport,
      layerStatesCount: props.layerStates?.length,
      width: props.width,
      height: props.height
    });

    const mapRef = useRef<MapRef>(null);
    const [tooltip, setTooltip] = useState<TooltipProps['tooltip']>(null);
    const [lastUpdate, setLastUpdate] = useState<number | null>(null);

    const [viewState, setViewState] = useState(() => props.viewport);
    const [layerStates, setLayerStates] = useState(() =>
      props.layerStates.map(ls => {
        const { layer, options } = ls;
        const currZoom = mapRef.current?.getMap().getZoom() ?? 0;

        // Check zoom-based visibility
        const zoomVisible =
          (!options.minZoom || currZoom >= options.minZoom) &&
          (!options.maxZoom || currZoom <= options.maxZoom);

        // Respect user-toggled visibility from options (undefined = visible)
        const userVisible = options.userVisible !== false;
        const isVisible = zoomVisible && userVisible;

        return {
          id: layer.id,
          layer: layer.clone({ visible: isVisible }),
          options,
        };
      }),
    );

    useImperativeHandle(ref, () => ({ setTooltip }), []);

    const tick = useCallback(() => {
      // Rate limiting updating viewport controls as it triggers lots of renders
      if (lastUpdate && Date.now() - lastUpdate > TICK) {
        const setCV = props.setControlValue;
        if (setCV) {
          setCV('viewport', viewState);
        }
        setLastUpdate(null);
      }
    }, [lastUpdate, props.setControlValue, viewState]);

    useEffect(() => {
      const timer = setInterval(tick, TICK);
      return () => clearInterval(timer);
    }, [tick]);

    // Sync viewport from props when it changes
    useEffect(() => {
      setViewState(props.viewport);
    }, [props.viewport]);

    // Force DeckGL resize when container dimensions change
    useEffect(() => {
      requestAnimationFrame(() => {
        setViewState(prev => ({ ...prev }));
      });
    }, [props.width, props.height]);

    const onViewStateChange = useCallback(
      ({ viewState }: { viewState: JsonObject }) => {
        setViewState(viewState as Viewport);
        setLastUpdate(Date.now());
      },
      [],
    );

    const getLayerObjects = useCallback(
      () => {
        const layers = layerStates.map(layerState => layerState.layer) as Layer[];
        console.log('[DeckGLContainer] getLayerObjects:', layers.map(l => ({
          id: l.id,
          type: l.constructor.name,
          visible: l.props.visible
        })));
        return layers;
      },
      [layerStates],
    );

    useEffect(() => {
      setLayerStates(
        props.layerStates.map(ls => {
          const { layer, options } = ls;
          const currZoom = mapRef.current?.getMap().getZoom() ?? 0;

          // Check zoom-based visibility
          const zoomVisible =
            (!options.minZoom || currZoom >= options.minZoom) &&
            (!options.maxZoom || currZoom <= options.maxZoom);

          // Respect user-toggled visibility from options (undefined = visible)
          const userVisible = options.userVisible !== false;
          const isVisible = zoomVisible && userVisible;

          return {
            id: layer.id,
            layer: layer.clone({ visible: isVisible }),
            options,
          };
        }),
      );
    }, [props.layerStates]);

    const handleMapLoad = useCallback(event => {
      const map = event.target;
      const scaleControl = new mapboxgl.ScaleControl({
        maxWidth: 120,
        unit: 'imperial',
      });
      map.addControl(scaleControl, 'top-right');

      const updateLayerVisibility = () => {
        const currZoom = map.getZoom();
        setLayerStates(prevLayerStates =>
          prevLayerStates.map(ls => {
            const { layer, options } = ls;

            // Check zoom-based visibility
            const zoomVisible =
              (!options.minZoom || currZoom >= options.minZoom) &&
              (!options.maxZoom || currZoom <= options.maxZoom);

            // Respect user-toggled visibility from options (undefined = visible)
            const userVisible = options.userVisible !== false;
            const isVisible = zoomVisible && userVisible;

            return {
              id: layer.id,
              layer: layer.clone({ visible: isVisible }),
              options,
            };
          }),
        );
      };

      // Calculate initial visibility based on current zoom
      updateLayerVisibility();

      // Update visibility on zoom level change
      map.on('zoom', updateLayerVisibility);
    }, []);

    const { children = null, height, width } = props;

    // Clear tooltip when mouse leaves the map container
    const handleMouseLeave = useCallback(() => {
      setTooltip(null);
    }, []);

    return (
      <div
        style={{ position: 'relative', width, height, overflow: 'hidden' }}
        onMouseLeave={handleMouseLeave}
      >
        <DeckGL
          controller
          width={width}
          height={height}
          layers={getLayerObjects()}
          viewState={viewState}
          onViewStateChange={onViewStateChange}
          onError={(error: Error) => console.error('[DeckGL] Error:', error)}
          debug
        >
          <StaticMapStyledWrapper
            ref={mapRef}
            preserveDrawingBuffer
            mapStyle={props.mapStyle ?? 'light'}
            mapboxApiAccessToken={props.mapboxApiAccessToken}
            onLoad={handleMapLoad}
          />
        </DeckGL>
        {children}
        <Tooltip
          tooltip={tooltip}
          containerWidth={width}
          containerHeight={height}
        />
      </div>
    );
  }),
);

export const DeckGLContainerStyledWrapper = styled(DeckGLContainer)`
  .deckgl-tooltip > div {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

export type DeckGLContainerHandle = typeof DeckGLContainer & {
  setTooltip: (tooltip: ReactNode) => void;
};
