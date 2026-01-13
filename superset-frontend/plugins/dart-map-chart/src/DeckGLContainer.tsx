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
import { MeasureState, useMeasureLayers } from './components/MeasureOverlay';
import { Coordinate } from './utils/measureDistance';

const TICK = 250; // milliseconds

export type DeckGLContainerProps = {
  viewport: Viewport;
  initialViewport?: Viewport;
  setControlValue?: (control: string, value: JsonValue) => void;
  mapStyle?: string;
  mapboxApiAccessToken: string;
  children?: ReactNode;
  width: number;
  height: number;
  layerStates: LayerState[];
  measureState?: MeasureState;
  onMeasureClick?: (coordinate: Coordinate) => void;
  onMeasureDragStart?: (coordinate: Coordinate) => void;
  onMeasureDrag?: (coordinate: Coordinate) => void;
  onMeasureDragEnd?: (coordinate: Coordinate) => void;
};

const MeasureTooltip = styled.div`
  position: absolute;
  background: ${({ theme }) => theme.colorBgElevated};
  color: ${({ theme }) => theme.colorText};
  border: 1px solid ${({ theme }) => theme.colorBorder};
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  border-radius: ${({ theme }) => theme.sizeUnit}px;
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  font-weight: 600;
  pointer-events: none;
  z-index: 100;
  white-space: nowrap;
  transform: translate(-50%, -100%);
  margin-top: -12px;

  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: ${({ theme }) => theme.colorBorder};
  }

  &::before {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: -1px;
    border: 5px solid transparent;
    border-top-color: ${({ theme }) => theme.colorBgElevated};
    z-index: 1;
  }
`;

// Custom ruler cursor as a data URI SVG
// The cursor is a small ruler icon with a crosshair at the click point (top-left)
// Uses white fill with black stroke for visibility on any background
const RULER_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3C!-- Crosshair at cursor point --%3E%3Ccircle cx='4' cy='4' r='3' fill='none' stroke='%23000' stroke-width='1.5'/%3E%3Cline x1='4' y1='0' x2='4' y2='2' stroke='%23000' stroke-width='1.5'/%3E%3Cline x1='4' y1='6' x2='4' y2='8' stroke='%23000' stroke-width='1.5'/%3E%3Cline x1='0' y1='4' x2='2' y2='4' stroke='%23000' stroke-width='1.5'/%3E%3Cline x1='6' y1='4' x2='8' y2='4' stroke='%23000' stroke-width='1.5'/%3E%3C!-- Ruler body --%3E%3Crect x='8' y='8' width='20' height='8' rx='1' fill='white' stroke='%23000' stroke-width='1'/%3E%3C!-- Ruler tick marks --%3E%3Cline x1='12' y1='8' x2='12' y2='11' stroke='%23000' stroke-width='1'/%3E%3Cline x1='16' y1='8' x2='16' y2='12' stroke='%23000' stroke-width='1.5'/%3E%3Cline x1='20' y1='8' x2='20' y2='11' stroke='%23000' stroke-width='1'/%3E%3Cline x1='24' y1='8' x2='24' y2='12' stroke='%23000' stroke-width='1.5'/%3E%3C/svg%3E") 4 4, crosshair`;

export const StaticMapStyledWrapper = styled(StaticMap)`
  .mapboxgl-ctrl-logo {
    display: none !important;
  }

  /* Hide the collapsed attribution button (non-functional "i" icon) */
  .mapboxgl-ctrl-attrib.mapboxgl-compact {
    display: none !important;
  }
`;

export const DeckGLContainer = memo(
  forwardRef((props: DeckGLContainerProps, ref) => {
    const mapRef = useRef<MapRef>(null);
    const [tooltip, setTooltip] = useState<TooltipProps['tooltip']>(null);
    const [lastUpdate, setLastUpdate] = useState<number | null>(null);

    const [viewState, setViewState] = useState(() => props.viewport);

    const [layerStates, setLayerStates] = useState(() => {
      if (!props.layerStates) {
        return [];
      }
      return props.layerStates.map(ls => {
        if (!ls || !ls.layer) {
          return null;
        }

        const { layer, options } = ls;
        const currZoom = mapRef.current?.getMap()?.getZoom() ?? 0;

        // Check zoom-based visibility
        const zoomVisible =
          (!options?.minZoom || currZoom >= options.minZoom) &&
          (!options?.maxZoom || currZoom <= options.maxZoom);

        // Respect user-toggled visibility from options (undefined = visible)
        const userVisible = options?.userVisible !== false;
        const isVisible = zoomVisible && userVisible;

        try {
          const clonedLayer = layer.clone({ visible: isVisible });
          return {
            id: layer.id,
            layer: clonedLayer,
            options,
          };
        } catch (err) {
          return {
            id: layer.id,
            layer,
            options,
          };
        }
      }).filter(Boolean);
    });

    // Store the initial viewport for reset functionality
    const initialViewportRef = useRef<Viewport>(
      props.initialViewport ?? props.viewport,
    );

    // Update initial viewport ref when initialViewport prop changes
    useEffect(() => {
      if (props.initialViewport) {
        initialViewportRef.current = props.initialViewport;
      }
    }, [props.initialViewport]);

    const ZOOM_INCREMENT = 0.5;

    const zoomIn = useCallback(() => {
      setViewState(prev => ({
        ...prev,
        zoom: Math.min((prev.zoom ?? 1) + ZOOM_INCREMENT, 22),
      }));
      setLastUpdate(Date.now());
    }, []);

    const zoomOut = useCallback(() => {
      setViewState(prev => ({
        ...prev,
        zoom: Math.max((prev.zoom ?? 1) - ZOOM_INCREMENT, 0),
      }));
      setLastUpdate(Date.now());
    }, []);

    const resetView = useCallback(() => {
      setViewState(initialViewportRef.current);
      setLastUpdate(Date.now());
    }, []);

    useImperativeHandle(
      ref,
      () => ({ setTooltip, zoomIn, zoomOut, resetView }),
      [zoomIn, zoomOut, resetView],
    );

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

    // Project function for converting geo coords to screen coords
    const project = useCallback(
      (coord: Coordinate): [number, number] | null => {
        const map = mapRef.current?.getMap();
        if (!map) return null;
        const point = map.project(coord);
        return [point.x, point.y];
      },
      [],
    );

    // Default measure state if not provided
    const defaultMeasureState: MeasureState = {
      startPoint: null,
      endPoint: null,
      isActive: false,
      isDragging: false,
    };
    const measureState = props.measureState ?? defaultMeasureState;

    // Get measure layers
    const {
      layers: measureLayers,
      tooltipPosition,
      distance,
    } = useMeasureLayers(measureState, project);

    const getLayerObjects = useCallback(
      () => {
        if (!layerStates || layerStates.length === 0) {
          return measureLayers as Layer[];
        }
        const layers = layerStates.map(layerState => {
          if (!layerState?.layer) {
            return null;
          }
          return layerState.layer;
        }).filter(Boolean) as Layer[];
        return [...layers, ...measureLayers] as Layer[];
      },
      [layerStates, measureLayers],
    );

    useEffect(() => {
      if (!props.layerStates) {
        return;
      }

      const newLayerStates = props.layerStates.map(ls => {
        if (!ls || !ls.layer) {
          return null;
        }

        const { layer, options } = ls;
        const currZoom = mapRef.current?.getMap()?.getZoom() ?? 0;

        // Check zoom-based visibility
        const zoomVisible =
          (!options?.minZoom || currZoom >= options.minZoom) &&
          (!options?.maxZoom || currZoom <= options.maxZoom);

        // Respect user-toggled visibility from options (undefined = visible)
        const userVisible = options?.userVisible !== false;
        const isVisible = zoomVisible && userVisible;

        try {
          return {
            id: layer.id,
            layer: layer.clone({ visible: isVisible }),
            options,
          };
        } catch (cloneErr) {
          return { id: layer.id, layer, options };
        }
      }).filter(Boolean);

      setLayerStates(newLayerStates);
    }, [props.layerStates]);

    const handleMapLoad = useCallback(event => {
      const map = event.target;

      const scaleControl = new mapboxgl.ScaleControl({
        maxWidth: 120,
        unit: 'imperial',
      });
      map.addControl(scaleControl, 'bottom-right');

      const updateLayerVisibility = () => {
        const currZoom = map.getZoom();
        setLayerStates(prevLayerStates =>
          prevLayerStates.map(ls => {
            if (!ls) return null;
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
          }).filter(Boolean),
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

    // Handle map clicks for measure mode
    const handleClick = useCallback(
      (info: any) => {
        // Don't handle click if a drag was in progress (threshold was exceeded)
        if (measureDragRef.current) return;
        if (measureState.isActive && props.onMeasureClick && info.coordinate) {
          props.onMeasureClick(info.coordinate as Coordinate);
        }
      },
      [measureState.isActive, props.onMeasureClick],
    );

    // Cursor style for measure mode - use custom ruler cursor
    const getCursor = useCallback(
      () => (measureState.isActive ? RULER_CURSOR : 'grab'),
      [measureState.isActive],
    );

    // Track drag state for measurement - use refs to avoid stale closure issues
    const measureDragRef = useRef(false); // True once drag threshold is exceeded
    const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null); // Initial mouse position
    const DRAG_THRESHOLD = 5; // Pixels of movement required to start drag

    // Handle mouse down for drag-to-measure
    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (!measureState.isActive) return;

        // Store initial position - don't start drag yet
        const rect = e.currentTarget.getBoundingClientRect();
        mouseDownPosRef.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
        measureDragRef.current = false;
      },
      [measureState.isActive],
    );

    // Handle mouse move for drag-to-measure
    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        if (!measureState.isActive || !mouseDownPosRef.current) return;

        const map = mapRef.current?.getMap();
        if (!map) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if we've exceeded drag threshold
        if (!measureDragRef.current) {
          const dx = x - mouseDownPosRef.current.x;
          const dy = y - mouseDownPosRef.current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance >= DRAG_THRESHOLD) {
            // Start drag from the initial mouse down position
            measureDragRef.current = true;
            const startLngLat = map.unproject([
              mouseDownPosRef.current.x,
              mouseDownPosRef.current.y,
            ]);
            props.onMeasureDragStart?.([startLngLat.lng, startLngLat.lat]);
          } else {
            return; // Haven't moved enough yet
          }
        }

        // Continue drag
        const lngLat = map.unproject([x, y]);
        props.onMeasureDrag?.([lngLat.lng, lngLat.lat]);
      },
      [measureState.isActive, props.onMeasureDragStart, props.onMeasureDrag],
    );

    // Handle mouse up for drag-to-measure
    const handleMouseUp = useCallback(
      (e: React.MouseEvent) => {
        if (!measureState.isActive) return;

        // Only finalize drag if we actually started dragging
        if (measureDragRef.current) {
          const map = mapRef.current?.getMap();
          if (map) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const lngLat = map.unproject([x, y]);
            props.onMeasureDragEnd?.([lngLat.lng, lngLat.lat]);
          }
        }

        // Reset refs
        measureDragRef.current = false;
        mouseDownPosRef.current = null;
      },
      [measureState.isActive, props.onMeasureDragEnd],
    );

    // Disable map panning when in measure mode
    const controllerOptions = measureState.isActive
      ? { dragPan: false, dragRotate: false }
      : true;

    return (
      <div
        style={{ position: 'relative', width, height, overflow: 'hidden' }}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <DeckGL
          controller={controllerOptions}
          width={width}
          height={height}
          layers={getLayerObjects()}
          viewState={viewState}
          onViewStateChange={onViewStateChange}
          onClick={handleClick}
          getCursor={getCursor}
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
        {measureState.isActive && tooltipPosition && distance && (
          <MeasureTooltip
            style={{
              left: tooltipPosition.x,
              top: tooltipPosition.y,
            }}
          >
            {distance}
          </MeasureTooltip>
        )}
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
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
};
