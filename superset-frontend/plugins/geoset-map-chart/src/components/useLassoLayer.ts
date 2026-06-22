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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EditableGeoJsonLayer,
  DrawPolygonByDraggingMode,
  DrawPolygonMode,
  DrawCircleFromCenterMode,
  DrawRectangleMode,
  ViewMode,
} from '@deck.gl-community/editable-layers';
import { PathLayer, SolidPolygonLayer } from '@deck.gl/layers';
import { PathStyleExtension } from '@deck.gl/extensions';
import type { Coordinate } from '../utils/measureDistance';
import type { LassoDrawMode } from '../types';
import { closeRing } from '../utils/lassoSelection';

type EditModeConstructor =
  | typeof DrawPolygonByDraggingMode
  | typeof DrawPolygonMode
  | typeof DrawCircleFromCenterMode
  | typeof DrawRectangleMode
  | typeof ViewMode;

const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection' as const,
  features: [] as any[],
};

// Custom crosshair cursor for lasso drawing mode
export const LASSO_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='5' fill='none' stroke='%23000' stroke-width='1.5'/%3E%3Cline x1='16' y1='8' x2='16' y2='13' stroke='%23000' stroke-width='1.5'/%3E%3Cline x1='16' y1='19' x2='16' y2='24' stroke='%23000' stroke-width='1.5'/%3E%3Cline x1='8' y1='16' x2='13' y2='16' stroke='%23000' stroke-width='1.5'/%3E%3Cline x1='19' y1='16' x2='24' y2='16' stroke='%23000' stroke-width='1.5'/%3E%3C/svg%3E") 16 16, crosshair`;

const DRAW_MODES: Record<LassoDrawMode, EditModeConstructor> = {
  freehand: DrawPolygonByDraggingMode,
  polygon: DrawPolygonMode,
  circle: DrawCircleFromCenterMode,
  rectangle: DrawRectangleMode,
};

const DRAG_TO_DRAW_MODES: Set<LassoDrawMode> = new Set(['circle', 'rectangle']);

// Shared color constants for lasso fill/stroke across drawing and completed layers
const LASSO_FILL_COLOR: [number, number, number, number] = [66, 133, 244, 30];
const LASSO_TENTATIVE_FILL_COLOR: [number, number, number, number] = [
  66, 133, 244, 15,
];
const LASSO_LINE_COLOR: [number, number, number, number] = [40, 40, 40, 220];
const LASSO_TENTATIVE_LINE_COLOR: [number, number, number, number] = [
  40, 40, 40, 200,
];

// Delay before enabling draw mode after activation, so the dropdown-close click
// doesn't register as the first vertex
const ACTIVATION_DELAY_MS = 450;

const DASH_EXTENSION = new PathStyleExtension({ dash: true });
const DASH_PROPS = {
  getDashArray: [8, 4],
  dashJustified: true,
  extensions: [DASH_EXTENSION],
};

/**
 * Hook to create layers for lasso drawing and completed polygon display.
 *
 * - While drawing: EditableGeoJsonLayer handles mouse interaction
 * - After completion: separate SolidPolygonLayer (fill) + PathLayer (dashed outline)
 *   keep the polygon visible regardless of what the editable layer does
 */
export function useLassoLayer(
  isActive: boolean,
  onPolygonComplete: (polygon: Coordinate[]) => void,
  drawMode: LassoDrawMode = 'freehand',
  completedPolygon: Coordinate[] | null = null,
): { layers: any[] } {
  const [data, setData] = useState(EMPTY_FEATURE_COLLECTION);
  const [mode, setMode] = useState<EditModeConstructor>(
    () => DRAW_MODES[drawMode],
  );

  // Use refs so effects/callbacks always see the latest values without
  // needing them in dependency arrays (avoids stale closures and races)
  const onPolygonCompleteRef = useRef(onPolygonComplete);
  onPolygonCompleteRef.current = onPolygonComplete;
  const drawModeRef = useRef(drawMode);
  drawModeRef.current = drawMode;

  // Reset when lasso is activated — brief delay before enabling draw mode
  // so the click that closed the dropdown doesn't register as the first vertex.
  // Uses drawModeRef so a mode change during the delay window is respected.
  useEffect(() => {
    if (isActive) {
      setData(EMPTY_FEATURE_COLLECTION);
      setMode(() => ViewMode);
      const timer = setTimeout(() => {
        setMode(() => DRAW_MODES[drawModeRef.current]);
      }, ACTIVATION_DELAY_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset drawing state when completed polygon is cleared (user dismissed results)
  // so the editable layer returns to draw mode for a new lasso
  useEffect(() => {
    if (isActive && !completedPolygon) {
      setData(EMPTY_FEATURE_COLLECTION);
      setMode(() => DRAW_MODES[drawModeRef.current]);
    }
  }, [completedPolygon]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch draw mode while active (without resetting polygon data)
  useEffect(() => {
    if (isActive) {
      setMode(() => DRAW_MODES[drawMode]);
    }
  }, [drawMode, isActive]);

  const handleEdit = useCallback(
    ({ updatedData, editType }: { updatedData: any; editType: string }) => {
      setData(updatedData);
      if (editType === 'addFeature') {
        const lastFeature =
          updatedData.features[updatedData.features.length - 1];
        const coords: number[][] = lastFeature.geometry.coordinates[0];
        setMode(() => ViewMode);
        onPolygonCompleteRef.current(
          coords.map(c => [c[0], c[1]] as Coordinate),
        );
      }
    },
    [],
  );

  // Editable layer for drawing phase
  const editableLayer = useMemo(() => {
    if (!isActive) return [];

    return [
      new EditableGeoJsonLayer({
        id: 'lasso-editable-layer',
        data,
        mode,
        modeConfig: DRAG_TO_DRAW_MODES.has(drawMode)
          ? { dragToDraw: true }
          : undefined,
        selectedFeatureIndexes: [],
        onEdit: handleEdit,

        getFillColor: LASSO_FILL_COLOR,
        getLineColor: LASSO_LINE_COLOR,
        lineWidthMinPixels: 2,

        getTentativeFillColor: LASSO_TENTATIVE_FILL_COLOR,
        getTentativeLineColor: LASSO_TENTATIVE_LINE_COLOR,

        // Dashed outline on both the main geojson and guides (tentative) sub-layers
        _subLayerProps: {
          geojson: {
            _subLayerProps: {
              linestrings: DASH_PROPS,
              'polygons-stroke': DASH_PROPS,
            },
          },
          guides: {
            _subLayerProps: {
              linestrings: DASH_PROPS,
              'polygons-stroke': DASH_PROPS,
            },
          },
          tooltips: { visible: false },
        },

        pickable: true,
      }),
    ];
  }, [isActive, data, mode, drawMode, handleEdit]);

  // Static layers for the completed polygon — persists after drawing finishes
  const completedLayers = useMemo(() => {
    if (!completedPolygon || completedPolygon.length < 3) return [];

    const ring = closeRing(completedPolygon);

    return [
      new SolidPolygonLayer({
        id: 'lasso-completed-fill',
        data: [{ polygon: ring }],
        getPolygon: (d: any) => d.polygon,
        getFillColor: LASSO_FILL_COLOR,
        pickable: false,
      }),
      new PathLayer({
        id: 'lasso-completed-outline',
        data: [{ path: ring }],
        getPath: (d: any) => d.path,
        getColor: LASSO_LINE_COLOR,
        widthMinPixels: 2,
        ...DASH_PROPS,
        pickable: false,
      }),
    ];
  }, [completedPolygon]);

  const layers = useMemo(
    () => [...editableLayer, ...completedLayers],
    [editableLayer, completedLayers],
  );

  return { layers };
}
