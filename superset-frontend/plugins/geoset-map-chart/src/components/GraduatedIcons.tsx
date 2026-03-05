import React from 'react';
import { RGBAColor, lerpColorCss, lerpColorRgba } from '../utils/colors';
import { getColoredSvgUrl } from '../utils/svgIcons';
import { formatLegendNumber } from '../utils/formatNumber';

export interface GraduatedIconsProps {
  startSize: number;
  endSize: number;
  lower: number;
  upper: number;
  startColor?: RGBAColor;
  endColor?: RGBAColor;
  fillColor?: RGBAColor;
  icon?: string;
  responsive?: boolean;
  usesPercentBounds?: boolean;
}

const T_VALUES = [0, 0.33, 0.67, 1];

const GraduatedIcons: React.FC<GraduatedIconsProps> = ({
  startSize,
  endSize,
  lower,
  upper,
  startColor,
  endColor,
  fillColor,
  icon,
  responsive = false,
  usesPercentBounds = false,
}) => {
  const MIN_R = 3;
  const MAX_R = 18;
  const radii = T_VALUES.map(t => Math.round(MIN_R + t * (MAX_R - MIN_R)));
  const maxR = radii[radii.length - 1];

  const hasGradient = startColor != null && endColor != null;
  const fallbackCss = fillColor
    ? `rgba(${fillColor[0]},${fillColor[1]},${fillColor[2]},0.8)`
    : 'rgba(0,122,135,0.8)';
  const fallbackRgba: RGBAColor = fillColor
    ? [fillColor[0], fillColor[1], fillColor[2], 204]
    : [0, 122, 135, 204];

  const colors = hasGradient
    ? T_VALUES.map(t => lerpColorCss(startColor!, endColor!, t))
    : T_VALUES.map(() => fallbackCss);
  const colorArrays: RGBAColor[] = hasGradient
    ? T_VALUES.map(t => lerpColorRgba(startColor!, endColor!, t))
    : T_VALUES.map(() => fallbackRgba);

  const iconName = icon?.replace('-icon', '') || 'circle';
  const hasRange = lower !== upper;
  const lowerLabel =
    hasRange && usesPercentBounds
      ? `≤\u2009${formatLegendNumber(lower)}`
      : formatLegendNumber(lower);
  const upperLabel = hasRange
    ? usesPercentBounds
      ? `>\u2009${formatLegendNumber(upper)}`
      : `${formatLegendNumber(upper)}+`
    : formatLegendNumber(upper);

  if (responsive) {
    const vw = 180;
    const vh = maxR * 2 + 2;
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
            {lowerLabel}
          </text>
          <text x={(vw * 7) / 8} y="11" textAnchor="middle">
            {upperLabel}
          </text>
        </svg>
      </>
    );
  }

  // Fixed pixel width mode (MultiLegend)
  const colW = Math.max(maxR * 2 + 8, 44);
  const svgW = colW * 4;
  const svgH = maxR * 2 + 2;
  return (
    <>
      <svg
        width={svgW}
        height={svgH}
        style={{
          margin: '6px 0',
          overflow: 'visible',
          display: 'block',
        }}
      >
        {radii.map((r, i) => {
          const cx = colW * (i + 0.5);
          const cy = svgH - r;
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
        width={svgW}
        height={16}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <text
          x={colW * 0.5}
          y={12}
          textAnchor="middle"
          fontSize={11}
          fill="currentColor"
        >
          {lowerLabel}
        </text>
        <text
          x={colW * 3.5}
          y={12}
          textAnchor="middle"
          fontSize={11}
          fill="currentColor"
        >
          {upperLabel}
        </text>
      </svg>
    </>
  );
};

export default GraduatedIcons;
