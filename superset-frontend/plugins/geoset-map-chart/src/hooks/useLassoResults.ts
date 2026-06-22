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
import { useCallback, useRef, useState } from 'react';
import type { Coordinate } from '../utils/measureDistance';
import type { GeoJsonFeature } from '../types';

export type UseLassoResultsOptions = {
  onPolygonComplete?: (polygon: Coordinate[]) => void;
};

export type UseLassoResultsResult = {
  selectedFeatures: GeoJsonFeature[];
  setSelectedFeatures: (features: GeoJsonFeature[]) => void;
  lassoPolygon: Coordinate[] | null;
  anchorGeoCoord: Coordinate | null;
  setAnchorGeoCoord: (coord: Coordinate | null) => void;
  clearSelection: () => void;
  handleLassoComplete: (polygon: Coordinate[]) => void;
};

export function useLassoResults(
  options: UseLassoResultsOptions = {},
): UseLassoResultsResult {
  const onPolygonCompleteRef = useRef(options.onPolygonComplete);
  onPolygonCompleteRef.current = options.onPolygonComplete;

  const [selectedFeatures, setSelectedFeatures] = useState<GeoJsonFeature[]>(
    [],
  );
  const [lassoPolygon, setLassoPolygon] = useState<Coordinate[] | null>(null);
  const [anchorGeoCoord, setAnchorGeoCoord] = useState<Coordinate | null>(
    null,
  );

  const clearSelection = useCallback(() => {
    setSelectedFeatures([]);
    setLassoPolygon(null);
    setAnchorGeoCoord(null);
  }, []);

  const handleLassoComplete = useCallback((polygon: Coordinate[]) => {
    setLassoPolygon(polygon);
    onPolygonCompleteRef.current?.(polygon);
  }, []);

  return {
    selectedFeatures,
    setSelectedFeatures,
    lassoPolygon,
    anchorGeoCoord,
    setAnchorGeoCoord,
    clearSelection,
    handleLassoComplete,
  };
}
