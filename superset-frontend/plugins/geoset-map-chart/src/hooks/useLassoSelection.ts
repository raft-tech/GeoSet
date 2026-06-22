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
import { useCallback, useEffect } from 'react';
import type { Coordinate } from '../utils/measureDistance';
import type { GeoJsonFeature, LassoDrawMode, LassoLayer } from '../types';
import { useLassoActivation } from './useLassoActivation';
import { useLassoResults } from './useLassoResults';

export type UseLassoSelectionOptions = {
  /** Available layers for lasso selection. Omit or pass empty for single-layer. */
  availableLayers?: LassoLayer[];
  /** Called when lasso polygon drawing completes. */
  onPolygonComplete?: (polygon: Coordinate[]) => void;
  /** Called when lasso is activated (useful for deactivating other modes like ruler). */
  onActivate?: () => void;
};

export type UseLassoSelectionResult = {
  lassoIsActive: boolean;
  lassoDrawMode: LassoDrawMode;
  setLassoDrawMode: (mode: LassoDrawMode) => void;
  selectedLassoLayerId: string | undefined;
  selectedFeatures: GeoJsonFeature[];
  setSelectedFeatures: (features: GeoJsonFeature[]) => void;
  lassoPolygon: Coordinate[] | null;
  anchorGeoCoord: Coordinate | null;
  setAnchorGeoCoord: (coord: Coordinate | null) => void;
  clearSelection: () => void;
  handleLassoToggle: () => void;
  handleLassoActivate: () => void;
  handleLassoComplete: (polygon: Coordinate[]) => void;
  handleLassoLayerSelect: (layerId: string) => void;
  deactivateLasso: () => void;
};

/**
 * Composes `useLassoActivation` and `useLassoResults` into a single hook
 * managing the full lasso lifecycle: activation, drawing, selection, and reset.
 */
export function useLassoSelection(
  options: UseLassoSelectionOptions = {},
): UseLassoSelectionResult {
  const activation = useLassoActivation({
    availableLayers: options.availableLayers,
    onActivate: options.onActivate,
  });

  const results = useLassoResults({
    onPolygonComplete: options.onPolygonComplete,
  });

  // Full reset: deactivate lasso and clear any selection results
  const fullReset = useCallback(() => {
    activation.resetActivation();
    results.clearSelection();
  }, [activation.resetActivation, results.clearSelection]);

  // Toggle lasso off — deactivate and clear results, but keep layer selection
  const handleLassoToggle = useCallback(() => {
    activation.deactivateLasso();
    results.clearSelection();
  }, [activation.deactivateLasso, results.clearSelection]);

  // Escape key exits lasso mode
  useEffect(() => {
    if (!activation.lassoIsActive) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fullReset();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activation.lassoIsActive, fullReset]);

  return {
    // Activation state
    lassoIsActive: activation.lassoIsActive,
    lassoDrawMode: activation.lassoDrawMode,
    setLassoDrawMode: activation.setLassoDrawMode,
    selectedLassoLayerId: activation.selectedLassoLayerId,
    handleLassoActivate: activation.handleLassoActivate,
    handleLassoLayerSelect: activation.handleLassoLayerSelect,
    deactivateLasso: activation.deactivateLasso,

    // Results state
    selectedFeatures: results.selectedFeatures,
    setSelectedFeatures: results.setSelectedFeatures,
    lassoPolygon: results.lassoPolygon,
    anchorGeoCoord: results.anchorGeoCoord,
    setAnchorGeoCoord: results.setAnchorGeoCoord,
    clearSelection: results.clearSelection,
    handleLassoComplete: results.handleLassoComplete,

    // Combined
    handleLassoToggle,
  };
}
