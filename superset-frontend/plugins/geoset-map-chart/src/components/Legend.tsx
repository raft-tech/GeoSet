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
import { memo, Fragment } from 'react';
import { formatNumber, styled } from '@superset-ui/core';
import { MetricLegend, RGBAColor } from '../utils/colors';
import { rgbaArrayToCssString } from '../utils/colorsFallback';
import { Swatch } from '../utils/legendSwatch';
import { getColoredSvgUrl } from '../utils/svgIcons';
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

  // --- Render size legend if present ---
  // When colorByValue is active, interpolate circle colors from the gradient
  const lerpColor = (c1: RGBAColor, c2: RGBAColor, t: number): string => {
    const r = Math.round(c1[0] + t * (c2[0] - c1[0]));
    const g = Math.round(c1[1] + t * (c2[1] - c1[1]));
    const b = Math.round(c1[2] + t * (c2[2] - c1[2]));
    return `rgba(${r},${g},${b},0.8)`;
  };

  const lerpColorRgba = (
    c1: RGBAColor,
    c2: RGBAColor,
    t: number,
  ): RGBAColor => [
    Math.round(c1[0] + t * (c2[0] - c1[0])),
    Math.round(c1[1] + t * (c2[1] - c1[1])),
    Math.round(c1[2] + t * (c2[2] - c1[2])),
    204,
  ];

  const sizeLegendContent =
    sizeLegend && sizeLegend.startSize !== sizeLegend.endSize ? (
      <div className="metric-legend">
        <div className="legend-title">
          {sizeLegend.legendTitle || toTitleCase(sizeLegend.valueColumn)}
        </div>
        {(() => {
          const { startSize, endSize, lower, upper } = sizeLegend;
          const tValues = [0, 0.33, 0.67, 1];
          const radii = tValues.map(t => {
            const raw = startSize + t * (endSize - startSize);
            return Math.min(Math.max(Math.round(raw), 3), 18);
          });
          const vw = 180;
          const maxR = radii[radii.length - 1];
          const vh = maxR * 2 + 2;

          // Use gradient colors when colorByValue is active, otherwise fillColor
          const fallback = `rgba(${fillColor[0]},${fillColor[1]},${fillColor[2]},0.8)`;
          const fallbackRgba: RGBAColor = [
            fillColor[0],
            fillColor[1],
            fillColor[2],
            204,
          ];
          const colors = metricLegend
            ? tValues.map(t =>
                lerpColor(metricLegend.startColor, metricLegend.endColor, t),
              )
            : tValues.map(() => fallback);
          const colorArrays: RGBAColor[] = metricLegend
            ? tValues.map(t =>
                lerpColorRgba(
                  metricLegend.startColor,
                  metricLegend.endColor,
                  t,
                ),
              )
            : tValues.map(() => fallbackRgba);
          const iconName = icon?.replace('-icon', '') || 'circle';

          return (
            <>
              <svg
                width="100%"
                viewBox={`0 0 ${vw} ${vh}`}
                preserveAspectRatio="xMinYMax meet"
                style={{
                  margin: '6px 0',
                  overflow: 'visible',
                  display: 'block',
                  maxWidth: 180,
                }}
              >
                {radii.map((r, i) => {
                  const cx = (vw / 4) * i + vw / 8;
                  const cy = vh - r;
                  return icon ? (
                    <image
                      key={i}
                      href={getColoredSvgUrl(iconName, colorArrays[i])}
                      x={cx - r}
                      y={cy - r}
                      width={r * 2}
                      height={r * 2}
                    />
                  ) : (
                    <circle key={i} cx={cx} cy={cy} r={r} fill={colors[i]} />
                  );
                })}
              </svg>
              <svg
                width="100%"
                viewBox={`0 0 ${vw} 14`}
                preserveAspectRatio="xMinYMin meet"
                style={{
                  display: 'block',
                  maxWidth: 180,
                  fontSize: 11,
                  fill: 'var(--ant-color-text-secondary, #888)',
                }}
              >
                <text x={vw / 8} y="11" textAnchor="middle">
                  {formatLegendNumber(lower)}
                </text>
                <text x={(vw * 7) / 8} y="11" textAnchor="middle">
                  {`${formatLegendNumber(upper)}${lower !== upper ? '+' : ''}`}
                </text>
              </svg>
            </>
          );
        })()}
      </div>
    ) : null;

  // --- Combined metric+size: 4 gradient-colored circles replacing gradient bar + size circles ---
  const combinedMetricSizeContent =
    isCombinedMetricSize && metricLegend && sizeLegend
      ? (() => {
          const { startSize, endSize, lower, upper } = sizeLegend;
          const tValues = [0, 0.33, 0.67, 1];
          const radii = tValues.map(t => {
            const raw = startSize + t * (endSize - startSize);
            return Math.min(Math.max(Math.round(raw), 3), 18);
          });
          const colors = tValues.map(t =>
            lerpColor(metricLegend.startColor, metricLegend.endColor, t),
          );
          const colorArrays = tValues.map(t =>
            lerpColorRgba(metricLegend.startColor, metricLegend.endColor, t),
          );
          const maxR = radii[radii.length - 1];
          const vw = 180;
          const vh = maxR * 2 + 2;
          const title =
            sizeLegend.legendTitle ||
            metricLegend.legendName ||
            toTitleCase(sizeLegend.valueColumn);
          const iconName = icon?.replace('-icon', '') || 'circle';

          return (
            <div className="metric-legend">
              <div className="legend-title">{title}</div>
              <svg
                width="100%"
                viewBox={`0 0 ${vw} ${vh}`}
                preserveAspectRatio="xMinYMax meet"
                style={{
                  margin: '6px 0',
                  overflow: 'visible',
                  display: 'block',
                  maxWidth: 180,
                }}
              >
                {radii.map((r, i) => {
                  const cx = (vw / 4) * i + vw / 8;
                  const cy = vh - r;
                  return icon ? (
                    <image
                      key={i}
                      href={getColoredSvgUrl(iconName, colorArrays[i])}
                      x={cx - r}
                      y={cy - r}
                      width={r * 2}
                      height={r * 2}
                    />
                  ) : (
                    <circle key={i} cx={cx} cy={cy} r={r} fill={colors[i]} />
                  );
                })}
              </svg>
              <svg
                width="100%"
                viewBox={`0 0 ${vw} 14`}
                preserveAspectRatio="xMinYMin meet"
                style={{
                  display: 'block',
                  maxWidth: 180,
                  fontSize: 11,
                  fill: 'var(--ant-color-text-secondary, #888)',
                }}
              >
                <text x={vw / 8} y="11" textAnchor="middle">
                  {formatLegendNumber(lower)}
                </text>
                <text x={(vw * 7) / 8} y="11" textAnchor="middle">
                  {`${formatLegendNumber(upper)}${lower !== upper ? '+' : ''}`}
                </text>
              </svg>
            </div>
          );
        })()
      : null;

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
        const { startSize, endSize, lower, upper } = sizeLegend!;
        const r1 = Math.min(startSize, 8);
        const rMid = Math.min(Math.round((startSize + endSize) / 2), 13);
        const r3 = Math.min(endSize, 18);
        const cellSize = r3 * 2 + 4;
        const midValue = Math.round((lower + upper) / 2);
        const radii = [r1, rMid, r3];

        return (
          <div className="metric-legend">
            <div className="legend-title">
              {sizeLegend!.legendTitle || toTitleCase(sizeLegend!.valueColumn)}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `auto repeat(3, 1fr)`,
                gap: '4px 2px',
                alignItems: 'center',
              }}
            >
              {categoryEntries.map(([k, v]) => {
                const rawColor = v.color ?? [0, 0, 0, 255];
                const color = (
                  rawColor.length === 4
                    ? rawColor
                    : [...rawColor, 255].slice(0, 4)
                ) as RGBAColor;
                const displayColor: RGBAColor = v.enabled
                  ? color
                  : [color[0], color[1], color[2], 100];
                const rgba = `rgba(${displayColor[0]},${displayColor[1]},${displayColor[2]},${displayColor[3] / 255})`;
                const label = v.legend_name || formatCategoryLabel(k);

                return (
                  <Fragment key={k}>
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
                      style={{
                        textDecoration: 'none',
                        color: 'inherit',
                        opacity: v.enabled ? 1 : 0.5,
                        paddingRight: 8,
                      }}
                    >
                      {label}
                    </a>
                    {radii.map((r, i) => {
                      const iconN = icon?.replace('-icon', '') || 'circle';
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'flex-end',
                            height: cellSize,
                            paddingBottom: 2,
                          }}
                        >
                          {icon ? (
                            <img
                              src={getColoredSvgUrl(iconN, displayColor)}
                              alt=""
                              width={r * 2}
                              height={r * 2}
                            />
                          ) : (
                            <svg width={r * 2} height={r * 2}>
                              <circle cx={r} cy={r} r={r} fill={rgba} />
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </Fragment>
                );
              })}
              {/* Size value labels */}
              <span />
              {[lower, midValue, upper].map((val, i) => (
                <span
                  key={i}
                  style={{
                    textAlign: 'center',
                    fontSize: 11,
                    color: 'var(--ant-color-text-secondary, #888)',
                  }}
                >
                  {formatLegendNumber(val)}
                  {i === 2 && lower !== upper ? '+' : ''}
                </span>
              ))}
            </div>
          </div>
        );
      })()
    : null;

  // --- Standard category list (when not in combined mode) ---
  const categories = categoryEntries.map(([k, v]) => {
    const rawColor = v.color ?? [0, 0, 0, 255];
    const normalizedColor = (
      rawColor.length === 4 ? rawColor : [...rawColor, 255].slice(0, 4)
    ) as RGBAColor;

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
