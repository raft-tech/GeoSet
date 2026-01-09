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

export type MapControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
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
  background: ${theme.colors.grayscale.light5};
  border: 1px solid ${theme.colors.grayscale.light2};
  border-radius: 6px;
  box-shadow: 0 2px 6px ${theme.colors.grayscale.base}1F;
  overflow: hidden;
`,
);

const ControlButton = styled.button(
  ({ theme }) => `
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-right: 1px solid ${theme.colors.grayscale.light2};
  cursor: pointer;
  font-family: inherit;
  font-size: 18px;
  font-weight: 600;
  color: ${theme.colors.grayscale.dark1};
  transition: background 0.15s ease;

  &:last-child {
    border-right: none;
  }

  &:hover {
    background: ${theme.colors.grayscale.light4};
  }

  &:active {
    background: ${theme.colors.grayscale.light3};
  }
`,
);

const HomeIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const MapControls = ({
  onZoomIn,
  onZoomOut,
  onResetView,
  position = 'top-left',
}: MapControlsProps) => (
  <ControlsContainer $position={position}>
    <ButtonGroup>
      <ControlButton onClick={onResetView} title="Reset view">
        <HomeIcon />
      </ControlButton>
      <ControlButton onClick={onZoomIn} title="Zoom in">
        +
      </ControlButton>
      <ControlButton onClick={onZoomOut} title="Zoom out">
        −
      </ControlButton>
    </ButtonGroup>
  </ControlsContainer>
);

export default memo(MapControls);
