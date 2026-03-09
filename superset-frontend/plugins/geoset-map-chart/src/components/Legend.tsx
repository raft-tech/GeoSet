/* eslint-disable theme-colors/no-literal-colors */
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
import { MetricLegend, RGBAColor, toRGBA } from '../utils/colors';
import { rgbaArrayToCssString } from '../utils/colorsFallback';
import { Swatch } from '../utils/legendSwatch';
import { formatBoundLabel } from '../utils/formatNumber';
import CategorySizeGrid, { CategorySizeGridItem } from './CategorySizeGrid';
import GraduatedIcons from './GraduatedIcons';

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
    max-width: 350px;
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

export type SizeLegend = {
  lower: number;
  upper: number;
  startSize: number;
  endSize: number;
  valueColumn: string;
  legendTitle?: string;
  usesPercentBounds?: boolean;
};

export type LegendProps = {
  format: string | null;
  forceCategorical?: boolean;
  position?: null | 'tl' | 'tr' | 'bl' | 'br';
  categories: Record<
    string,
    { enabled: boolean; color: number[] | undefined; legend_name?: string }
  >;
  metricLegend?: MetricLegend | null;
  sizeLegend?: SizeLegend | null;
  fillColor?: RGBAColor;
  isCombinedMetricSize?: boolean;
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
  sizeLegend,
  fillColor = [0, 122, 135, 255],
  isCombinedMetricSize = false,
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
          {metricLegend.min != null
            ? formatBoundLabel(
                metricLegend.min,
                'lower',
                metricLegend.min !== metricLegend.max,
                !!metricLegend.usesPercentBounds,
              )
            : ''}
        </span>
        <span>
          {metricLegend.max != null
            ? formatBoundLabel(
                metricLegend.max,
                'upper',
                metricLegend.min !== metricLegend.max,
                !!metricLegend.usesPercentBounds,
              )
            : ''}
        </span>
      </div>
    </div>
  ) : null;

  // --- Render size legend if present ---
  const sizeLegendContent =
    sizeLegend && sizeLegend.startSize !== sizeLegend.endSize ? (
      <div className="metric-legend">
        <div className="legend-title">
          {sizeLegend.legendTitle || toTitleCase(sizeLegend.valueColumn)}
        </div>
        <GraduatedIcons
          responsive
          lower={sizeLegend.lower}
          upper={sizeLegend.upper}
          startColor={metricLegend?.startColor}
          endColor={metricLegend?.endColor}
          fillColor={fillColor}
          icon={icon}
          usesPercentBounds={sizeLegend.usesPercentBounds}
        />
      </div>
    ) : null;

  // --- Combined metric+size: 4 gradient-colored circles replacing gradient bar + size circles ---
  const combinedMetricSizeContent =
    isCombinedMetricSize && metricLegend && sizeLegend ? (
      <div className="metric-legend">
        <div className="legend-title">
          {sizeLegend.legendTitle ||
            metricLegend.legendName ||
            toTitleCase(sizeLegend.valueColumn)}
        </div>
        <GraduatedIcons
          responsive
          lower={sizeLegend.lower}
          upper={sizeLegend.upper}
          startColor={metricLegend.startColor}
          endColor={metricLegend.endColor}
          icon={icon}
          usesPercentBounds={sizeLegend.usesPercentBounds}
        />
      </div>
    ) : null;

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

  // --- Combined grid: categories × sizes ---
  const categoryEntries = Object.entries(categoriesObject);
  const hasCombinedLegend =
    sizeLegend &&
    sizeLegend.startSize !== sizeLegend.endSize &&
    categoryEntries.length > 0 &&
    !metricLegend;

  const combinedContent = hasCombinedLegend
    ? (() => {
        const { lower, upper } = sizeLegend!;
        const gridItems: CategorySizeGridItem[] = categoryEntries.map(
          ([k, v]) => ({
            key: k,
            label: String(v.legend_name || formatCategoryLabel(k)),
            fillColor: toRGBA(v.color ?? undefined, [0, 0, 0, 255]),
            enabled: v.enabled !== false,
          }),
        );

        return (
          <div className="metric-legend">
            <div className="legend-title">
              {sizeLegend!.legendTitle || toTitleCase(sizeLegend!.valueColumn)}
            </div>
            <CategorySizeGrid
              categories={gridItems}
              lower={lower}
              upper={upper}
              icon={icon}
              usesPercentBounds={sizeLegend!.usesPercentBounds}
              renderLabel={item => (
                <a
                  href="#"
                  role="button"
                  onClick={e => {
                    e.preventDefault();
                    toggleCategory(item.key);
                  }}
                  onDoubleClick={e => {
                    e.preventDefault();
                    showSingleCategory(item.key);
                  }}
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    opacity: item.enabled ? 1 : 0.5,
                    paddingRight: 8,
                  }}
                >
                  {item.label}
                </a>
              )}
            />
          </div>
        );
      })()
    : null;

  // --- Standard category list (when not in combined mode) ---
  const categories = categoryEntries.map(([k, v]) => {
    const normalizedColor = toRGBA(v.color ?? undefined, [0, 0, 0, 255]);
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

  if (
    !metricLegend &&
    !sizeLegendContent &&
    !combinedContent &&
    !combinedMetricSizeContent &&
    (categoryEntries.length === 0 || position === null)
  ) {
    return null;
  }

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
      {combinedMetricSizeContent ? (
        <>
          {combinedMetricSizeContent}
          {categoryEntries.length > 0 && <ul>{categories}</ul>}
        </>
      ) : (
        <>
          {metricLegendContent}
          {hasCombinedLegend ? (
            combinedContent
          ) : (
            <>
              {sizeLegendContent}
              <ul>{categories}</ul>
            </>
          )}
        </>
      )}
    </StyledLegend>
  );
};

export default memo(Legend);
