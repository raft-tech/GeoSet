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
import { memo } from 'react';
import { styled } from '@superset-ui/core';
import type { LassoDrawMode, LassoLayer } from '../types';
import {
  CloseIcon,
  FreehandIcon,
  PolygonIcon,
  CircleIcon,
  RectangleIcon,
  RadioIcon,
} from './icons';

export type LassoDropdownProps = {
  hasMultipleLayers: boolean;
  layers: LassoLayer[];
  activeLassoLayerId?: string;
  onLayerSelect?: (layerId: string) => void;
  drawMode: LassoDrawMode;
  onDrawModeChange?: (mode: LassoDrawMode) => void;
  onClose: () => void;
};

const DropdownPanel = styled.div(
  ({ theme }) => `
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 200px;
  background: ${theme.colorBgElevated};
  border: 1px solid ${theme.colorBorderSecondary};
  border-radius: 6px;
  box-shadow: 0 4px 12px ${theme.colorText}1F;
  overflow: hidden;
`,
);

const DropdownHeader = styled.div(
  ({ theme }) => `
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: ${theme.colorTextSecondary};
  border-bottom: 1px solid ${theme.colorBorderSecondary};
`,
);

const CloseButton = styled.button(
  ({ theme }) => `
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  color: ${theme.colorTextSecondary};

  &:hover {
    color: ${theme.colorText};
  }
`,
);

const DropdownItem = styled.button(
  ({ theme }) => `
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  color: ${theme.colorText};
  text-align: left;
  white-space: nowrap;

  &:hover {
    background: ${theme.colorBgTextHover};
  }
`,
);

const CLICK_AND_DRAG_MODES: LassoDrawMode[] = ['freehand', 'circle', 'rectangle'];
const isClickAndDragMode = (mode: LassoDrawMode) =>
  CLICK_AND_DRAG_MODES.includes(mode);

const ModeToggleSection = styled.div(
  ({ theme }) => `
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-top: 1px solid ${theme.colorBorderSecondary};
`,
);

const ModeButton = styled.button<{ $isActive?: boolean }>(
  ({ theme, $isActive }) => `
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  padding: 4px 8px;
  background: ${$isActive ? theme.colorPrimaryBg : 'transparent'};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  color: ${$isActive ? theme.colorPrimary : theme.colorTextSecondary};
  white-space: nowrap;

  &:hover {
    background: ${$isActive ? theme.colorPrimaryBgHover : theme.colorBgTextHover};
  }
`,
);

const ShapeToggleSection = styled.div`
  display: flex;
  gap: 4px;
  padding: 4px 12px 8px;
`;

const LassoDropdown = ({
  hasMultipleLayers,
  layers,
  activeLassoLayerId,
  onLayerSelect,
  drawMode,
  onDrawModeChange,
  onClose,
}: LassoDropdownProps) => {
  const isDragMode = isClickAndDragMode(drawMode);

  return (
    <DropdownPanel role="dialog" aria-label="Lasso options">
      <DropdownHeader>
        {hasMultipleLayers ? 'Select layer' : 'Lasso mode'}
        <CloseButton onClick={onClose} aria-label="Close lasso options">
          <CloseIcon />
        </CloseButton>
      </DropdownHeader>
      {hasMultipleLayers && (
        <div role="radiogroup" aria-label="Target layer">
          {layers.map(layer => {
            const isSelected = layer.id === activeLassoLayerId;
            return (
              <DropdownItem
                key={layer.id}
                role="radio"
                aria-checked={isSelected}
                onClick={() => onLayerSelect?.(layer.id)}
              >
                <RadioIcon selected={isSelected} />
                {layer.name}
              </DropdownItem>
            );
          })}
        </div>
      )}
      <ModeToggleSection role="group" aria-label="Draw method">
        <ModeButton
          $isActive={isDragMode}
          aria-pressed={isDragMode}
          onClick={() => onDrawModeChange?.('freehand')}
        >
          <FreehandIcon /> Click-and-drag
        </ModeButton>
        <ModeButton
          $isActive={drawMode === 'polygon'}
          aria-pressed={drawMode === 'polygon'}
          onClick={() => onDrawModeChange?.('polygon')}
        >
          <PolygonIcon /> Point-to-point
        </ModeButton>
      </ModeToggleSection>
      {isDragMode && (
        <ShapeToggleSection role="group" aria-label="Shape">
          <ModeButton
            $isActive={drawMode === 'freehand'}
            aria-pressed={drawMode === 'freehand'}
            onClick={() => onDrawModeChange?.('freehand')}
          >
            <FreehandIcon /> Freehand
          </ModeButton>
          <ModeButton
            $isActive={drawMode === 'circle'}
            aria-pressed={drawMode === 'circle'}
            onClick={() => onDrawModeChange?.('circle')}
          >
            <CircleIcon /> Circle
          </ModeButton>
          <ModeButton
            $isActive={drawMode === 'rectangle'}
            aria-pressed={drawMode === 'rectangle'}
            onClick={() => onDrawModeChange?.('rectangle')}
          >
            <RectangleIcon /> Rectangle
          </ModeButton>
        </ShapeToggleSection>
      )}
    </DropdownPanel>
  );
};

export default memo(LassoDropdown);
