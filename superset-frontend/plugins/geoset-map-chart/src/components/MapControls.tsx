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
import { memo, useCallback, useState, useRef } from 'react';
import { styled } from '@superset-ui/core';

import type { LassoDrawMode, LassoLayer } from '../types';
import LassoDropdown from './LassoDropdown';
import { HomeIcon, RulerIcon, LassoIcon } from './icons';
import { useClickOutside } from '../hooks/useClickOutside';

export type MapControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onRulerToggle: () => void;
  isRulerActive: boolean;
  onLassoToggle: () => void;
  onLassoActivate?: () => void;
  isLassoActive: boolean;
  lassoLayers?: LassoLayer[];
  activeLassoLayerId?: string;
  onLassoLayerSelect?: (layerId: string) => void;
  lassoDrawMode?: LassoDrawMode;
  onLassoDrawModeChange?: (mode: LassoDrawMode) => void;
  position?: 'top-left' | 'top-right';
};

// Control margin matching the legend padding
const CONTROL_MARGIN = 12;

const ControlsContainer = styled.div<{ $position: 'top-left' | 'top-right' }>`
  position: absolute;
  top: ${CONTROL_MARGIN}px;
  ${({ $position }) =>
    $position === 'top-right'
      ? `right: ${CONTROL_MARGIN}px;`
      : `left: ${CONTROL_MARGIN}px;`}
  z-index: 20;
  pointer-events: auto;
`;

const ButtonGroup = styled.div(
  ({ theme }) => `
  display: flex;
  flex-direction: row;
  background: ${theme.colorBgElevated};
  border: 1px solid ${theme.colorBorderSecondary};
  border-radius: 6px;
  box-shadow: 0 2px 6px ${theme.colorBorderSecondary}1F;
  overflow: hidden;
`,
);

const ControlButton = styled.button<{ $isActive?: boolean }>(
  ({ theme, $isActive }) => `
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: ${$isActive ? theme.colorPrimaryBg : 'transparent'};
  border: none;
  border-right: 1px solid ${theme.colorBorderSecondary};
  cursor: pointer;
  font-family: inherit;
  font-size: 18px;
  font-weight: 600;
  color: ${$isActive ? theme.colorPrimary : theme.colorText};
  transition: background 0.15s ease, color 0.15s ease;

  &:last-child {
    border-right: none;
  }

  &:hover {
    background: ${$isActive ? theme.colorPrimaryBgHover : theme.colorBgTextHover};
  }

  &:active {
    background: ${$isActive ? theme.colorPrimaryBgHover : theme.colorBgTextActive};
  }
`,
);

const MapControls = ({
  onZoomIn,
  onZoomOut,
  onResetView,
  onRulerToggle,
  isRulerActive,
  onLassoToggle,
  onLassoActivate,
  isLassoActive,
  lassoLayers = [],
  activeLassoLayerId,
  onLassoLayerSelect,
  lassoDrawMode = 'freehand',
  onLassoDrawModeChange,
  position = 'top-left',
}: MapControlsProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasMultipleLayers = lassoLayers.length > 1;

  const closeAndActivate = useCallback(() => {
    setIsDropdownOpen(false);
    if (!hasMultipleLayers || activeLassoLayerId) {
      onLassoActivate?.();
    }
  }, [hasMultipleLayers, activeLassoLayerId, onLassoActivate]);

  useClickOutside(containerRef, closeAndActivate, isDropdownOpen);

  const handleLassoButtonClick = () => {
    if (isLassoActive) {
      onLassoToggle();
      setIsDropdownOpen(false);
    } else {
      setIsDropdownOpen(prev => !prev);
    }
  };

  return (
    <ControlsContainer $position={position} ref={containerRef}>
      <ButtonGroup>
        <ControlButton onClick={onResetView} title="Reset view">
          <HomeIcon />
        </ControlButton>
        <ControlButton onClick={onZoomOut} title="Zoom out">
          −
        </ControlButton>
        <ControlButton onClick={onZoomIn} title="Zoom in">
          +
        </ControlButton>
        <ControlButton
          onClick={onRulerToggle}
          title={isRulerActive ? 'Exit measure mode (Esc)' : 'Measure distance'}
          $isActive={isRulerActive}
        >
          <RulerIcon />
        </ControlButton>
        <ControlButton
          onClick={handleLassoButtonClick}
          title={
            isLassoActive ? 'Exit lasso mode (Esc)' : 'Lasso select features'
          }
          $isActive={isLassoActive || isDropdownOpen}
        >
          <LassoIcon />
        </ControlButton>
      </ButtonGroup>

      {isDropdownOpen && (
        <LassoDropdown
          hasMultipleLayers={hasMultipleLayers}
          layers={lassoLayers}
          activeLassoLayerId={activeLassoLayerId}
          onLayerSelect={onLassoLayerSelect}
          drawMode={lassoDrawMode}
          onDrawModeChange={onLassoDrawModeChange}
          onClose={closeAndActivate}
        />
      )}
    </ControlsContainer>
  );
};

export default memo(MapControls);
