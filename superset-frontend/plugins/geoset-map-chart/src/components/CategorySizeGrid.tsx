import React, { Fragment } from 'react';
import { RGBAColor } from '../utils/colors';
import { getColoredSvgUrl } from '../utils/svgIcons';
import { formatLegendNumber } from '../utils/formatNumber';

export type CategorySizeGridItem = {
  key: string;
  label: string;
  fillColor: RGBAColor;
  enabled: boolean;
};

export type CategorySizeGridProps = {
  categories: CategorySizeGridItem[];
  lower: number;
  upper: number;
  icon?: string;
  usesPercentBounds?: boolean;
  renderLabel: (item: CategorySizeGridItem) => React.ReactNode;
};

const T_VALUES = [0, 0.5, 1];
const MIN_R = 3;
const MAX_R = 13;

const CategorySizeGrid: React.FC<CategorySizeGridProps> = ({
  categories,
  lower,
  upper,
  icon,
  usesPercentBounds = false,
  renderLabel,
}) => {
  const radii = T_VALUES.map(t => Math.round(MIN_R + t * (MAX_R - MIN_R)));
  const cellSize = radii[radii.length - 1] * 2 + 4;
  const midValue = Math.round((lower + upper) / 2);
  const iconName = icon?.replace('-icon', '') || 'circle';
  const hasRange = lower !== upper;

  const values = [lower, midValue, upper];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `auto repeat(3, 1fr)`,
        gap: '4px 2px',
        alignItems: 'center',
      }}
    >
      {categories.map(item => {
        const displayColor: RGBAColor = item.enabled
          ? item.fillColor
          : [item.fillColor[0], item.fillColor[1], item.fillColor[2], 100];
        const rgba = `rgba(${displayColor[0]},${displayColor[1]},${displayColor[2]},${displayColor[3] / 255})`;

        return (
          <Fragment key={item.key}>
            {renderLabel(item)}
            {radii.map((r, j) => (
              <div
                key={j}
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
                    src={getColoredSvgUrl(iconName, displayColor)}
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
            ))}
          </Fragment>
        );
      })}
      {/* Size value labels */}
      <span />
      {values.map((val, i) => {
        let text = formatLegendNumber(val);
        if (hasRange && i === 0 && usesPercentBounds) {
          text = `≤\u2009${text}`;
        }
        if (hasRange && i === 2) {
          text = usesPercentBounds ? `>\u2009${text}` : `${text}+`;
        }
        return (
          <span
            key={i}
            style={{
              textAlign: 'center',
              fontSize: 11,
              color: 'var(--ant-color-text-secondary, #888)',
            }}
          >
            {text}
          </span>
        );
      })}
    </div>
  );
};

export default CategorySizeGrid;
