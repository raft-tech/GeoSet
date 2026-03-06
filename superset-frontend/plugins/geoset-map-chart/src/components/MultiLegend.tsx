/* eslint-disable no-console */
/* eslint-disable react-hooks/rules-of-hooks */
import { styled } from '@superset-ui/core';
import { useState, useEffect, useRef } from 'react';
import MapIcon from '@material-ui/icons/MapTwoTone';
import { RGBAColor } from '../utils/colors';
import type { LegendEntry, LegendGroup } from '../types';
import { Swatch } from '../utils/legendSwatch';
import { formatLegendNumber } from '../utils/formatNumber';

export type MultiLegendProps = {
  legendGroups: LegendGroup[];
  layerVisibility?: Record<string, boolean>;
  onToggleLayerVisibility?: (sliceIds: string[]) => void;
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
  min-width: 200px;
  max-width: 325px;
  width: max-content;
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
  legendGroups,
  layerVisibility = {},
  onToggleLayerVisibility,
  onToggleCategory,
}) => {
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [optimisticVisibility, setOptimisticVisibility] = useState<
    Record<string, boolean>
  >({});

  if (legendGroups.length === 0) return null;

  const toggle = (title: string, initialCollapsed: boolean) => {
    const currentlyOpen = expanded[title] ?? !initialCollapsed;
    setExpanded(prev => ({ ...prev, [title]: !currentlyOpen }));
  };

  // Get default colors for title swatch based on layer type
  const getDefaultColors = (
    layer: LegendEntry,
  ): { fill: RGBAColor; stroke: RGBAColor } => {
    if (layer.simpleStyle) {
      return {
        fill: layer.simpleStyle.fillColor,
        stroke: layer.simpleStyle.strokeColor,
      };
    }
    if (layer.metric) {
      return { fill: layer.metric.startColor, stroke: layer.metric.startColor };
    }
    if (layer.categories && layer.categories.length > 0) {
      return {
        fill: layer.categories[0].fillColor,
        stroke: layer.categories[0].strokeColor,
      };
    }
    return { fill: [0, 122, 135, 255], stroke: [0, 122, 135, 255] };
  };

  const showGroupCheckboxes = legendGroups.length > 1;

  // Per-entry visibility checkbox for simple (non-categorical) layers inside
  // a legend group. Categorical layers already have per-category checkboxes.
  const GroupEntryCheckbox: React.FC<{
    sliceId: string;
    hasMultipleEntries: boolean;
  }> = ({ sliceId, hasMultipleEntries }) => {
    if (!hasMultipleEntries) return null;
    const entryVisible =
      sliceId in optimisticVisibility
        ? optimisticVisibility[sliceId]
        : layerVisibility[sliceId] !== false;
    return (
      <VisibilityCheckbox
        type="checkbox"
        checked={entryVisible}
        onChange={() => {
          setOptimisticVisibility(prev => ({
            ...prev,
            [sliceId]: !entryVisible,
          }));
          onToggleLayerVisibility?.([sliceId]);
        }}
      />
    );
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
          {legendGroups.map(legendGroup => {
            const { displayTitle, entries, initialCollapsed } = legendGroup;
            const allSliceIds = entries.map(e => e.sliceId);
            const isOpen = expanded[displayTitle] ?? !initialCollapsed;

            // Visibility: checked if ANY constituent layer is visible
            const visibleSliceIds = allSliceIds.filter(id => {
              if (id in optimisticVisibility) return optimisticVisibility[id];
              return layerVisibility[id] !== false;
            });
            const isVisible = visibleSliceIds.length > 0;

            // Indeterminate: some visible/some not, or any entry has partial categories
            const someVisibleSomeNot =
              visibleSliceIds.length > 0 &&
              visibleSliceIds.length < allSliceIds.length;
            const hasPartialCategories = entries.some(({ legendEntry }) => {
              const categories = legendEntry.categories || [];
              if (categories.length === 0) return false;
              const enabledCount = categories.filter(
                cat => cat.enabled !== false,
              ).length;
              return enabledCount > 0 && enabledCount < categories.length;
            });
            const isIndeterminate =
              someVisibleSomeNot || (isVisible && hasPartialCategories);

            return (
              <Group key={displayTitle}>
                {/* Header */}
                <Header>
                  {showGroupCheckboxes && (
                    <IndeterminateCheckbox
                      checked={isVisible}
                      indeterminate={isIndeterminate}
                      onChange={e => {
                        e.stopPropagation();
                        const newVal = !isVisible;
                        setOptimisticVisibility(prev => ({
                          ...prev,
                          ...Object.fromEntries(
                            allSliceIds.map(id => [id, newVal]),
                          ),
                        }));
                        onToggleLayerVisibility?.(allSliceIds);
                      }}
                    />
                  )}
                  <TitleRow
                    onClick={() => toggle(displayTitle, initialCollapsed)}
                  >
                    <LegendTitle>{displayTitle}</LegendTitle>
                    <ExpandIcon>{isOpen ? '▾' : '▸'}</ExpandIcon>
                  </TitleRow>
                </Header>

                {/* Content — render each entry's content sequentially */}
                {isOpen && (
                  <Content>
                    {entries.map(({ sliceId, legendEntry }) => {
                      const { fill, stroke } = getDefaultColors(legendEntry);
                      return (
                        <div key={sliceId}>
                          {/* SIMPLE - show icon and slice name */}
                          {legendEntry.type === 'simple' &&
                            legendEntry.simpleStyle && (
                              <CategoryRow>
                                <GroupEntryCheckbox
                                  sliceId={sliceId}
                                  hasMultipleEntries={entries.length > 1}
                                />
                                <Swatch
                                  fill={fill}
                                  stroke={stroke}
                                  icon={legendEntry.icon}
                                  geometryType={legendEntry.geometryType}
                                />
                                <div>{legendEntry.legendName}</div>
                              </CategoryRow>
                            )}

                          {/* CATEGORIES */}
                          {legendEntry.categories &&
                            legendEntry.categories.length > 0 &&
                            legendEntry.categories.map((cat, i) => {
                              const isEnabled = cat.enabled !== false;
                              const hasToggle = !!onToggleCategory;

                              const displayFillColor: RGBAColor = isEnabled
                                ? cat.fillColor
                                : [
                                    cat.fillColor[0],
                                    cat.fillColor[1],
                                    cat.fillColor[2],
                                    100,
                                  ];

                              return (
                                <CategoryRow key={`${sliceId}-${i}`}>
                                  {hasToggle && (
                                    <VisibilityCheckbox
                                      type="checkbox"
                                      checked={isEnabled}
                                      onChange={() =>
                                        onToggleCategory(sliceId, cat.label)
                                      }
                                    />
                                  )}
                                  <Swatch
                                    fill={displayFillColor}
                                    stroke={cat.strokeColor}
                                    icon={legendEntry.icon}
                                    geometryType={legendEntry.geometryType}
                                  />
                                  <div>{cat.label}</div>
                                </CategoryRow>
                              );
                            })}

                          {/* METRIC GRADIENT */}
                          {legendEntry.metric && (
                            <>
                              <GradientBar
                                gradient={`linear-gradient(to right,
                                  rgba(${legendEntry.metric.startColor[0]},${legendEntry.metric.startColor[1]},${legendEntry.metric.startColor[2]},${legendEntry.metric.startColor[3]}),
                                  rgba(${legendEntry.metric.endColor[0]},${legendEntry.metric.endColor[1]},${legendEntry.metric.endColor[2]},${legendEntry.metric.endColor[3]})
                                )`}
                              />
                              <Bounds>
                                <div>
                                  {formatLegendNumber(legendEntry.metric.lower)}
                                </div>
                                <div>{`${formatLegendNumber(legendEntry.metric.upper)}${legendEntry.metric.lower !== legendEntry.metric.upper ? '+' : ''}`}</div>
                              </Bounds>
                            </>
                          )}
                        </div>
                      );
                    })}
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
