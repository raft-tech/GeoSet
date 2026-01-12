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
import { memo, useMemo } from 'react';
import { styled } from '@superset-ui/core';
import { LineLayer, ScatterplotLayer } from '@deck.gl/layers';
import {
  Coordinate,
  calculateHaversineDistance,
  formatDistance,
} from '../utils/measureDistance';

export type MeasureState = {
  startPoint: Coordinate | null;
  endPoint: Coordinate | null;
  isActive: boolean;
  isDragging: boolean;
};

export type MeasureOverlayProps = {
  measureState: MeasureState;
  onMapClick: (coordinate: Coordinate) => void;
  onExit: () => void;
  width: number;
  height: number;
};

const InstructionBanner = styled.div`
  position: absolute;
  top: 56px;
  left: 50%;
  transform: translateX(-50%);
  background: ${({ theme }) => theme.colors.grayscale.dark2}CC;
  color: ${({ theme }) => theme.colors.grayscale.light5};
  padding: ${({ theme }) => theme.gridUnit * 2}px
    ${({ theme }) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  z-index: 100;
  white-space: nowrap;
`;

export type MeasureLayersResult = {
  layers: any[];
  tooltipPosition: { x: number; y: number } | null;
  distance: string | null;
};

/**
 * Hook to create deck.gl layers for measurement visualization
 */
export function useMeasureLayers(
  measureState: MeasureState,
  project: (coord: Coordinate) => [number, number] | null,
): MeasureLayersResult {
  const { startPoint, endPoint, isActive } = measureState;

  const layers = useMemo(() => {
    if (!isActive) return [];

    const result: any[] = [];

    // Points layer for start and end markers
    const points: { position: Coordinate; type: 'start' | 'end' }[] = [];
    if (startPoint) {
      points.push({ position: startPoint, type: 'start' });
    }
    if (endPoint) {
      points.push({ position: endPoint, type: 'end' });
    }

    if (points.length > 0) {
      result.push(
        new ScatterplotLayer({
          id: 'measure-points-layer',
          data: points,
          getPosition: (d: { position: Coordinate }) => d.position,
          getFillColor: [66, 133, 244, 255],
          getLineColor: [255, 255, 255, 255],
          getRadius: 8,
          radiusUnits: 'pixels',
          stroked: true,
          lineWidthMinPixels: 2,
          pickable: false,
        }),
      );
    }

    // Line layer connecting start and end
    if (startPoint && endPoint) {
      result.push(
        new LineLayer({
          id: 'measure-line-layer',
          data: [{ source: startPoint, target: endPoint }],
          getSourcePosition: (d: { source: Coordinate }) => d.source,
          getTargetPosition: (d: { target: Coordinate }) => d.target,
          getColor: [66, 133, 244, 255],
          getWidth: 3,
          widthUnits: 'pixels',
          pickable: false,
        }),
      );
    }

    return result;
  }, [isActive, startPoint, endPoint]);

  // Calculate tooltip position (midpoint of line in screen coords)
  const tooltipPosition = useMemo(() => {
    if (!startPoint || !endPoint || !project) return null;

    const midLng = (startPoint[0] + endPoint[0]) / 2;
    const midLat = (startPoint[1] + endPoint[1]) / 2;
    const screenPos = project([midLng, midLat]);

    if (!screenPos) return null;
    return { x: screenPos[0], y: screenPos[1] };
  }, [startPoint, endPoint, project]);

  // Calculate distance
  const distance = useMemo(() => {
    if (!startPoint || !endPoint) return null;
    const meters = calculateHaversineDistance(startPoint, endPoint);
    return formatDistance(meters);
  }, [startPoint, endPoint]);

  return { layers, tooltipPosition, distance };
}

/**
 * Component to render measurement UI elements (tooltip, instructions)
 */
const MeasureOverlay = memo(({ measureState }: MeasureOverlayProps) => {
  const { startPoint, endPoint, isActive } = measureState;

  if (!isActive) return null;

  const showInstructions = !startPoint;
  const showClickAgain = startPoint && !endPoint;

  return (
    <>
      {showInstructions && (
        <InstructionBanner>
          Click on the map to set the start point
        </InstructionBanner>
      )}
      {showClickAgain && (
        <InstructionBanner>
          Click on the map to set the end point
        </InstructionBanner>
      )}
    </>
  );
});

export default MeasureOverlay;
