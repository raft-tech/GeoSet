/* eslint-disable no-console */
/* eslint-disable react/jsx-sort-default-props */
/* eslint-disable react/sort-prop-types */
/* eslint-disable jsx-a11y/anchor-is-valid */
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
import { formatNumber, styled } from '@superset-ui/core';
import { MetricLegend, RGBAColor } from '../utils/colors';
import { rgbaArrayToCssString } from '../utils/colorsFallback';
import { Swatch } from '../utils/legendSwatch';
import { formatLegendNumber } from '../utils/formatNumber';

const StyledLegend = styled.div`
  ${({ theme }) => `
    font-size: ${theme.fontSize}px;
    position: absolute;
    background: ${theme.colorBgElevated};
    box-shadow: 0 0 ${theme.sizeUnit}px ${theme.colorBorderSecondary};
    margin: ${theme.sizeUnit * 3}px;
    padding: ${theme.sizeUnit * 4}px ${theme.sizeUnit * 5}px;
    outline: none;
    overflow-y: auto;
    min-width: 200px;
    max-width: 300px;
    width: max-content;
    border-radius: 6px;
    z-index: 10;
    max-height: calc(100% - 24px);

    & ul {
      list-style: none;
      padding-left: 0;
      margin: 0;

      & li a {
        display: flex;
        align-items: center;
        gap: ${theme.sizeUnit * 2}px;
        color: ${theme.colorText};
        text-decoration: none;
        padding: ${theme.sizeUnit}px 0;
      }
    }

    .metric-legend {
      display: flex;
      flex-direction: column;
      margin-bottom: ${theme.sizeUnit * 3}px;

      .legend-title {
        font-size: ${theme.fontSize}px;
        margin-bottom: ${theme.sizeUnit * 2}px;
        font-weight: 600;
      }

      .gradient-bar {
        height: 14px;
        width: 100%;
        min-width: 180px;
        border-radius: 4px;
        margin-bottom: ${theme.sizeUnit}px;
      }

      .legend-labels {
        display: flex;
        justify-content: space-between;
        font-size: ${theme.fontSizeSM}px;
        width: 100%;
        min-width: 180px;
        padding: 0 2px;
        letter-spacing: 0.5px;
      }
    }
  `}
`;

const categoryDelimiter = ' - ';

export type LegendProps = {
  format: string | null;
  forceCategorical?: boolean;
  position?: null | 'tl' | 'tr' | 'bl' | 'br';
  categories: Record<
    string,
    { enabled: boolean; color: number[] | undefined; legend_name?: string }
  >;
  metricLegend?: MetricLegend | null;
  toggleCategory?: (key: string) => void;
  showSingleCategory?: (key: string) => void;
  icon?: string;
  geometryType?: string;
  strokeColor?: RGBAColor;
};

// Utility to convert snake_case or camelCase to Title Case
const toTitleCase = (str: string) =>
  str
    .replace(/_/g, ' ')
    .replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1));

const Legend = ({
  format: d3Format = null,
  forceCategorical = false,
  position = 'tr',
  categories: categoriesObject = {},
  metricLegend,
  toggleCategory = () => {},
  showSingleCategory = () => {},
  icon,
  geometryType,
  strokeColor = [0, 0, 0, 0],
}: LegendProps) => {
  const format = (value: string | number) => {
    if (!d3Format || forceCategorical) {
      return value;
    }
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    return formatNumber(d3Format, numValue);
  };

  // --- Render metric legend if present and not forcing categorical ---
  const metricLegendContent = metricLegend ? (
    <div className="metric-legend">
      <div className="legend-title">{toTitleCase(metricLegend.legendName)}</div>
      <div
        className="gradient-bar"
        style={{
          background: `linear-gradient(to right, ${rgbaArrayToCssString(metricLegend.startColor)}, ${rgbaArrayToCssString(metricLegend.endColor)})`,
        }}
      />
      <div className="legend-labels">
        <span>
          {metricLegend.min != null ? formatLegendNumber(metricLegend.min) : ''}
        </span>
        <span>
          {metricLegend.max != null
            ? `${formatLegendNumber(metricLegend.max)}${metricLegend.min !== metricLegend.max ? '+' : ''}`
            : ''}
        </span>
      </div>
    </div>
  ) : null;

  if (
    !metricLegend &&
    (Object.keys(categoriesObject).length === 0 || position === null)
  ) {
    console.error('Returning null for Legend');
    return null;
  }

  const formatCategoryLabel = (k: string) => {
    if (!d3Format) {
      return k;
    }

    if (k.includes(categoryDelimiter)) {
      const values = k.split(categoryDelimiter);
      return format(values[0]) + categoryDelimiter + format(values[1]);
    }
    return format(k);
  };

  const categories = Object.entries(categoriesObject).map(([k, v]) => {
    // Pick the correct color source depending on active mode
    const rawColor = v.color ?? [0, 0, 0, 255];
    const normalizedColor = (
      rawColor.length === 4 ? rawColor : [...rawColor, 255].slice(0, 4)
    ) as RGBAColor;

    // Apply opacity to indicate disabled state
    const displayColor: RGBAColor = v.enabled
      ? normalizedColor
      : [normalizedColor[0], normalizedColor[1], normalizedColor[2], 100];

    return (
      <li key={k}>
        <a
          href="#"
          role="button"
          onClick={e => {
            e.preventDefault();
            toggleCategory(k);
          }}
          onDoubleClick={e => {
            e.preventDefault();
            showSingleCategory(k);
          }}
        >
          <Swatch
            fill={displayColor}
            stroke={strokeColor}
            icon={icon}
            geometryType={geometryType}
          />
          {v.legend_name ? v.legend_name : formatCategoryLabel(k)}
        </a>
      </li>
    );
  });

  const isTop = position?.charAt(0) === 't';
  const isLeft = position?.charAt(1) === 'l';
  const vertical = isTop ? 'top' : 'bottom';
  const horizontal = isLeft ? 'left' : 'right';

  const style: React.CSSProperties = {
    position: 'absolute',
    [horizontal]: '10px',
    [vertical]: '0px',
  };

  return (
    <StyledLegend style={style}>
      {metricLegendContent}
      <ul>{categories}</ul>
    </StyledLegend>
  );
};

export default memo(Legend);
