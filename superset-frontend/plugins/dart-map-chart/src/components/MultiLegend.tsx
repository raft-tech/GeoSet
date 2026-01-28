/* eslint-disable no-console */
/* eslint-disable react-hooks/rules-of-hooks */
import { styled } from '@superset-ui/core';
import { useState, useEffect, useRef } from 'react';
import MapIcon from '@material-ui/icons/MapTwoTone';
import { RGBAColor } from '../utils/colors';
import { Swatch } from '../utils/legendSwatch';
import { formatLegendNumber } from '../utils/formatNumber';

export type CategoryEntry = {
  label: string;
  fillColor: RGBAColor;
  strokeColor: RGBAColor;
  enabled?: boolean; // Whether category is visible (default true)
};

export type MetricEntry = {
  lower: number;
  upper: number;
  startColor: RGBAColor;
  endColor: RGBAColor;
};

export type LegendGroup = {
  legendName: string;
  legendParentTitle?: string;
  sliceName: string;
  icon?: string;
  geometryType?: string;
  type: 'simple' | 'categorical' | 'metric';
  simpleStyle?: { fillColor: RGBAColor; strokeColor: RGBAColor };
  categories?: CategoryEntry[];
  metric?: MetricEntry;
};

export type MultiLegendProps = {
  legendsBySlice: Record<string, LegendGroup>;
  layerVisibility?: Record<string, boolean>;
  onToggleLayerVisibility?: (sliceId: string) => void;
  // Toggle a single category within a slice
  onToggleCategory?: (sliceId: string, categoryLabel: string) => void;
};

// Control margin for legend positioning
const LEGEND_MARGIN = 12;

const LegendContainer = styled.div`
  position: absolute;
  top: ${LEGEND_MARGIN}px;
  left: ${LEGEND_MARGIN}px;
  bottom: ${LEGEND_MARGIN}px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  pointer-events: none;
`;

const CollapsedButton = styled.button(
  ({ theme }) => `
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px 15px;
  border-radius: 6px;
  background: ${theme.colorBgElevated};
  border: 1px solid ${theme.colorBorderSecondary};
  box-shadow: 0 2px 6px ${theme.colorText}1F;
  cursor: pointer;
  font-family: inherit;
  pointer-events: auto;

  &:hover {
    background: ${theme.colorBgContainer};
  }
`,
);

const LegendButtonText = styled.div(
  ({ theme }) => `
  font-size: 11px;
  font-weight: 600;
  color: ${theme.colorText};
  text-transform: uppercase;
`,
);

const LegendWrapper = styled.div(
  ({ theme }) => `
  background: ${theme.colorBgElevated};
  padding: 12px;
  border-radius: 6px;
  box-shadow: 0 2px 6px ${theme.colorText}1F;
  font-family: inherit;
  max-height: 100%;
  max-width: 350px;
  overflow-y: auto;
  pointer-events: auto;
`,
);

const LegendHeader = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 4px;
`;

const CloseButton = styled.button(
  ({ theme }) => `
  background: none;
  border: none;
  font-size: 16px;
  color: ${theme.colorTextSecondary};
  cursor: pointer;
  padding: 0;
  line-height: 1;

  &:hover {
    color: ${theme.colorText};
  }
`,
);

const Group = styled.div`
  margin-bottom: 12px;
  &:last-child {
    margin-bottom: 0;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  cursor: pointer;
  gap: 6px;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
`;

const LegendTitle = styled.div(
  ({ theme }) => `
  font-weight: 600;
  font-size: 14px;
  color: ${theme.colorText};
  flex: 1;
`,
);

const ExpandIcon = styled.div(
  ({ theme }) => `
  font-size: 16px;
  color: ${theme.colorTextSecondary};
`,
);

const Content = styled.div`
  margin-top: 8px;
  padding-left: 20px;
`;

const CategoryRow = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 6px;
  gap: 8px;
`;

const GradientBar = styled.div<{ gradient: string }>`
  height: 12px;
  width: 100%;
  border-radius: 4px;
  margin: 6px 0;
  background: ${({ gradient }) => gradient};
`;

const Bounds = styled.div(
  ({ theme }) => `
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: ${theme.colorTextSecondary};
`,
);

const VisibilityCheckbox = styled.input`
  width: 14px;
  height: 14px;
  cursor: pointer;
  margin: 0 !important;
  flex-shrink: 0;
`;

// Checkbox that supports indeterminate state (shows minus sign when some but not all are selected)
const IndeterminateCheckbox: React.FC<{
  checked: boolean;
  indeterminate: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ checked, indeterminate, onChange }) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <VisibilityCheckbox
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
    />
  );
};

export const MultiLegend: React.FC<MultiLegendProps> = ({
  legendsBySlice,
  layerVisibility = {},
  onToggleLayerVisibility,
  onToggleCategory,
}) => {
  const sliceIds = Object.keys(legendsBySlice);

  if (sliceIds.length === 0) return null;

  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !(prev[id] ?? true) }));
  };

  // Get default colors for title swatch based on group type
  const getDefaultColors = (
    group: LegendGroup,
  ): { fill: RGBAColor; stroke: RGBAColor } => {
    if (group.simpleStyle) {
      return {
        fill: group.simpleStyle.fillColor,
        stroke: group.simpleStyle.strokeColor,
      };
    }
    if (group.metric) {
      return { fill: group.metric.startColor, stroke: group.metric.startColor };
    }
    if (group.categories && group.categories.length > 0) {
      return {
        fill: group.categories[0].fillColor,
        stroke: group.categories[0].strokeColor,
      };
    }
    return { fill: [0, 122, 135, 255], stroke: [0, 122, 135, 255] };
  };

  return (
    <LegendContainer>
      {!isLegendOpen ? (
        <CollapsedButton onClick={() => setIsLegendOpen(true)}>
          <MapIcon style={{ fontSize: 30, marginBottom: 4 }} />
          <LegendButtonText>Legend</LegendButtonText>
        </CollapsedButton>
      ) : (
        <LegendWrapper>
          <LegendHeader>
            <CloseButton onClick={() => setIsLegendOpen(false)}>✕</CloseButton>
          </LegendHeader>
          {sliceIds.map(id => {
            const group = legendsBySlice[id];
            const isOpen = expanded[id] ?? true;
            const { fill, stroke } = getDefaultColors(group);

            const isVisible = layerVisibility[id] !== false; // default to visible

            // Calculate indeterminate state for categorical layers
            const categories = group.categories || [];
            const enabledCount = categories.filter(
              cat => cat.enabled !== false,
            ).length;
            const isIndeterminate =
              categories.length > 0 &&
              enabledCount > 0 &&
              enabledCount < categories.length;

            return (
              <Group key={id}>
                {/* Header */}
                <Header>
                  {sliceIds.length > 1 && (
                    <IndeterminateCheckbox
                      checked={isVisible}
                      indeterminate={isIndeterminate}
                      onChange={e => {
                        e.stopPropagation();
                        onToggleLayerVisibility?.(id);
                      }}
                    />
                  )}
                  <TitleRow onClick={() => toggle(id)}>
                    <LegendTitle>
                      {group.type === 'simple'
                        ? group.legendParentTitle
                        : group.legendName}
                    </LegendTitle>
                    <ExpandIcon>{isOpen ? '▾' : '▸'}</ExpandIcon>
                  </TitleRow>
                </Header>

                {/* Content */}
                {isOpen && (
                  <Content>
                    {/* SIMPLE - show icon and slice name */}
                    {group.type === 'simple' && group.simpleStyle && (
                      <CategoryRow>
                        <Swatch
                          fill={fill}
                          stroke={stroke}
                          icon={group.icon}
                          geometryType={group.geometryType}
                        />
                        <div>{group.legendName}</div>
                      </CategoryRow>
                    )}

                    {/* CATEGORIES */}
                    {group.categories && group.categories.length > 0 && (
                      <>
                        {group.categories.map((cat, i) => {
                          const isEnabled = cat.enabled !== false;
                          const hasToggle = !!onToggleCategory;

                          // Apply opacity to color when disabled
                          const displayFillColor: RGBAColor = isEnabled
                            ? cat.fillColor
                            : [
                                cat.fillColor[0],
                                cat.fillColor[1],
                                cat.fillColor[2],
                                100,
                              ];

                          return (
                            <CategoryRow key={i}>
                              {hasToggle && (
                                <VisibilityCheckbox
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={() =>
                                    onToggleCategory(id, cat.label)
                                  }
                                />
                              )}
                              <Swatch
                                fill={displayFillColor}
                                stroke={cat.strokeColor}
                                icon={group.icon}
                                geometryType={group.geometryType}
                              />
                              <div>{cat.label}</div>
                            </CategoryRow>
                          );
                        })}
                      </>
                    )}

                    {/* METRIC GRADIENT */}
                    {group.metric && (
                      <>
                        <GradientBar
                          gradient={`linear-gradient(to right,
                            rgba(${group.metric.startColor[0]},${group.metric.startColor[1]},${group.metric.startColor[2]},${group.metric.startColor[3]}),
                            rgba(${group.metric.endColor[0]},${group.metric.endColor[1]},${group.metric.endColor[2]},${group.metric.endColor[3]})
                          )`}
                        />
                        <Bounds>
                          <div>{formatLegendNumber(group.metric.lower)}</div>
                          <div>{`${formatLegendNumber(group.metric.upper)}+`}</div>
                        </Bounds>
                      </>
                    )}
                  </Content>
                )}
              </Group>
            );
          })}
        </LegendWrapper>
      )}
    </LegendContainer>
  );
};

export default MultiLegend;
