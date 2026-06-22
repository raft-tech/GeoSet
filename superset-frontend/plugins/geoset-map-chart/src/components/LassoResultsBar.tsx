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
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import { styled, t } from '@superset-ui/core';
import { message } from 'antd';
import type { GeoJsonFeature } from '../types';
import type { Coordinate } from '../utils/measureDistance';
import { exportToCSV, exportToExcel } from '../utils/lassoExport';
import { calculateLassoArea } from '../utils/lassoSelection';
import { KebabIcon, CloseIcon, DownloadIcon } from './icons';
import { useClickOutside } from '../hooks/useClickOutside';

export interface LassoResultsBarProps {
  features: GeoJsonFeature[];
  lassoPolygon?: Coordinate[] | null;
  onClear: () => void;
  anchorPosition?: { x: number; y: number } | null;
  containerWidth?: number;
  containerHeight?: number;
  exportColumns?: string[];
}

const CONTROL_MARGIN = 12;
const TOP_OFFSET = 32 + CONTROL_MARGIN + 8;

const BarContainer = styled.div<{ $anchorX?: number; $anchorY?: number }>`
  position: absolute;
  ${({ $anchorX, $anchorY }) =>
    $anchorX != null && $anchorY != null
      ? `left: ${$anchorX}px; top: ${$anchorY}px;`
      : `left: ${CONTROL_MARGIN}px; top: ${TOP_OFFSET}px;`}
  z-index: 20;
  pointer-events: auto;
`;

const BarContent = styled.div(
  ({ theme }) => `
  display: flex;
  flex-direction: column;
  padding: 10px 8px 10px 16px;
  background: ${theme.colorBgElevated};
  border: 1px solid ${theme.colorBorderSecondary};
  border-radius: 6px;
  box-shadow: 0 2px 8px ${theme.colorText}1F;
  white-space: nowrap;
`,
);

const TopRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const CountLabel = styled.span(
  ({ theme }) => `
  font-size: 15px;
  font-weight: 700;
  color: ${theme.colorText};
  margin-right: 4px;
`,
);

const AreaLabel = styled.span(
  ({ theme }) => `
  font-size: 12px;
  font-weight: 400;
  color: ${theme.colorTextSecondary};
  padding-top: 2px;
`,
);

const IconButton = styled.button(
  ({ theme }) => `
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: ${theme.colorTextSecondary};

  &:hover {
    background: ${theme.colorBgTextHover};
    color: ${theme.colorText};
  }
`,
);

const MenuPanel = styled.div<{ $flipLeft?: boolean }>(
  ({ theme, $flipLeft }) => `
  position: absolute;
  top: 0;
  ${$flipLeft ? 'right: calc(100% + 6px);' : 'left: calc(100% + 6px);'}
  min-width: 170px;
  background: ${theme.colorBgElevated};
  border: 1px solid ${theme.colorBorderSecondary};
  border-radius: 6px;
  box-shadow: 0 4px 12px ${theme.colorText}1F;
  overflow: hidden;
`,
);

const MenuHeader = styled.div(
  ({ theme }) => `
  padding: 8px 12px 6px;
  font-size: 11px;
  font-weight: 600;
  color: ${theme.colorTextSecondary};
  border-bottom: 1px solid ${theme.colorBorderSecondary};
`,
);

const MenuItem = styled.button<{ $disabled?: boolean }>(
  ({ theme, $disabled }) => `
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  cursor: ${$disabled ? 'default' : 'pointer'};
  font-family: inherit;
  font-size: 13px;
  color: ${$disabled ? theme.colorTextSecondary : theme.colorText};
  opacity: ${$disabled ? 0.5 : 1};
  text-align: left;
  white-space: nowrap;

  &:hover {
    background: ${$disabled ? 'transparent' : theme.colorBgTextHover};
  }
`,
);

const LassoResultsBar = ({
  features,
  lassoPolygon,
  onClear,
  anchorPosition,
  containerWidth,
  containerHeight,
  exportColumns,
}: LassoResultsBarProps) => {
  const count = features.length;
  const areaText = useMemo(
    () => (lassoPolygon ? calculateLassoArea(lassoPolygon) : null),
    [lassoPolygon],
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuFlipLeft, setMenuFlipLeft] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [clampedPos, setClampedPos] = useState(anchorPosition);

  // Measure the bar after render and clamp so it stays within the map
  useLayoutEffect(() => {
    if (!anchorPosition || !containerRef.current) {
      setClampedPos(anchorPosition);
      return;
    }
    const el = containerRef.current;
    const barW = el.offsetWidth;
    const barH = el.offsetHeight;
    const maxW = containerWidth ?? Infinity;
    const maxH = containerHeight ?? Infinity;
    const pad = 8;
    const x = Math.max(pad, Math.min(anchorPosition.x, maxW - barW - pad));
    const y = Math.max(pad, Math.min(anchorPosition.y, maxH - barH - pad));
    setClampedPos({ x, y });
  }, [anchorPosition, containerWidth, containerHeight, count]);

  // Determine if menu should flip to the left when it would overflow the container
  useLayoutEffect(() => {
    if (!isMenuOpen || !containerRef.current || !containerWidth) return;
    const el = containerRef.current;
    const barRight = (clampedPos?.x ?? 0) + el.offsetWidth;
    const MENU_WIDTH = 176; // min-width (170) + gap (6)
    setMenuFlipLeft(barRight + MENU_WIDTH > containerWidth);
  }, [isMenuOpen, clampedPos, containerWidth]);

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  useClickOutside(containerRef, closeMenu, isMenuOpen);

  if (count === 0 && !lassoPolygon) return null;

  return (
    <BarContainer
      ref={containerRef}
      $anchorX={clampedPos?.x}
      $anchorY={clampedPos?.y}
    >
      <BarContent>
        <TopRow>
          <CountLabel>{count} Items Selected</CountLabel>
          {count > 0 && (
            <IconButton
              onClick={() => setIsMenuOpen(prev => !prev)}
              aria-label="Export options"
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
            >
              <KebabIcon />
            </IconButton>
          )}
          <IconButton onClick={onClear} aria-label="Clear selection">
            <CloseIcon />
          </IconButton>
        </TopRow>
        {areaText && <AreaLabel>Area: {areaText}</AreaLabel>}
      </BarContent>

      {isMenuOpen && (
        <MenuPanel
          role="menu"
          aria-label="Export formats"
          $flipLeft={menuFlipLeft}
        >
          <MenuHeader>Download</MenuHeader>
          <MenuItem
            role="menuitem"
            onClick={() => {
              try {
                exportToCSV(features, exportColumns);
                message.success({
                  content: t('CSV exported successfully'),
                  duration: 3,
                });
              } catch (err) {
                message.error({
                  content: t('Failed to export CSV'),
                  duration: 5,
                });
              }
              setIsMenuOpen(false);
            }}
          >
            <DownloadIcon /> Export to .CSV
          </MenuItem>
          <MenuItem
            role="menuitem"
            onClick={() => {
              exportToExcel(features, exportColumns)
                .then(() =>
                  message.success({
                    content: t('Excel exported successfully'),
                    duration: 3,
                  }),
                )
                .catch(() =>
                  message.error({
                    content: t('Failed to export Excel'),
                    duration: 5,
                  }),
                );
              setIsMenuOpen(false);
            }}
          >
            <DownloadIcon /> Export to Excel
          </MenuItem>
        </MenuPanel>
      )}
    </BarContainer>
  );
};

export default memo(LassoResultsBar);
