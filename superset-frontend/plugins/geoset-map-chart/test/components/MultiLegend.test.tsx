import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiLegend } from '../../src/components/MultiLegend';
import { renderWithTheme } from '../testHelpers';
import {
  createSimpleLegendEntry,
  createCategoricalLegendEntry,
  createMetricLegendEntry,
  createLegendGroup,
  createCategoryEntry,
  RED,
  GREEN,
} from '../testFixtures';

import '../mocks/svgIcons';

// Mock GraduatedIcons to isolate legend rendering behavior
jest.mock('../../src/components/GraduatedIcons', () => {
  const MockGraduatedIcons = (props: any) => (
    <div
      data-test="graduated-icons"
      data-lower={props.lower}
      data-upper={props.upper}
    />
  );
  MockGraduatedIcons.displayName = 'MockGraduatedIcons';
  return { __esModule: true, default: MockGraduatedIcons };
});

jest.mock('../../src/components/CategorySizeGrid', () => {
  const MockCategorySizeGrid = (props: any) => (
    <div data-test="category-size-grid">
      {props.categories.map((cat: any) => (
        <span key={cat.key}>{props.renderLabel(cat)}</span>
      ))}
    </div>
  );
  MockCategorySizeGrid.displayName = 'MockCategorySizeGrid';
  return { __esModule: true, default: MockCategorySizeGrid };
});

// Mock Material-UI icon to avoid transform issues
jest.mock('@material-ui/icons/MapTwoTone', () => {
  const MockMapIcon = (props: any) => (
    <span data-testid="map-icon" {...props} />
  );
  MockMapIcon.displayName = 'MockMapIcon';
  return { __esModule: true, default: MockMapIcon };
});

// Stable reference to avoid infinite useEffect loop from default `layerVisibility = {}`
const EMPTY_VISIBILITY: Record<string, boolean> = {};

describe('MultiLegend', () => {
  describe('collapsed/expanded state', () => {
    it('renders collapsed button with "Legend" text', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[createLegendGroup()]}
          layerVisibility={EMPTY_VISIBILITY}
        />,
      );
      expect(screen.getByText('Legend')).toBeInTheDocument();
    });

    it('returns null when legendGroups is empty', () => {
      const { container } = renderWithTheme(
        <MultiLegend legendGroups={[]} layerVisibility={EMPTY_VISIBILITY} />,
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('opens legend on button click and shows group titles', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[createLegendGroup({ displayTitle: 'My Layer' })]}
          layerVisibility={EMPTY_VISIBILITY}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      expect(screen.getByText('My Layer')).toBeInTheDocument();
    });

    it('closes legend on close button click', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[createLegendGroup({ displayTitle: 'My Layer' })]}
          layerVisibility={EMPTY_VISIBILITY}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      expect(screen.getByText('My Layer')).toBeInTheDocument();
      userEvent.click(screen.getByText('✕'));
      expect(screen.queryByText('My Layer')).not.toBeInTheDocument();
      expect(screen.getByText('Legend')).toBeInTheDocument();
    });
  });

  describe('group expand/collapse', () => {
    it('groups start expanded when initialCollapsed is false', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              displayTitle: 'Open Group',
              initialCollapsed: false,
              entries: [
                { sliceId: '1', legendEntry: createSimpleLegendEntry() },
              ],
            }),
          ]}
          layerVisibility={EMPTY_VISIBILITY}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      expect(screen.getByText('▾')).toBeInTheDocument();
      expect(screen.getByText('Test Layer')).toBeInTheDocument();
    });

    it('groups start collapsed when initialCollapsed is true', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              displayTitle: 'Closed Group',
              initialCollapsed: true,
              entries: [
                {
                  sliceId: '1',
                  legendEntry: createSimpleLegendEntry({
                    legendName: 'Hidden Layer',
                  }),
                },
              ],
            }),
          ]}
          layerVisibility={EMPTY_VISIBILITY}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      expect(screen.getByText('▸')).toBeInTheDocument();
      expect(screen.queryByText('Hidden Layer')).not.toBeInTheDocument();
    });

    it('toggles group on title click', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              displayTitle: 'Toggle Group',
              initialCollapsed: false,
              entries: [
                {
                  sliceId: '1',
                  legendEntry: createSimpleLegendEntry({
                    legendName: 'Toggled Layer',
                  }),
                },
              ],
            }),
          ]}
          layerVisibility={EMPTY_VISIBILITY}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      expect(screen.getByText('Toggled Layer')).toBeInTheDocument();
      userEvent.click(screen.getByText('Toggle Group'));
      expect(screen.queryByText('Toggled Layer')).not.toBeInTheDocument();
      expect(screen.getByText('▸')).toBeInTheDocument();
      userEvent.click(screen.getByText('Toggle Group'));
      expect(screen.getByText('Toggled Layer')).toBeInTheDocument();
      expect(screen.getByText('▾')).toBeInTheDocument();
    });
  });

  describe('layer visibility checkboxes', () => {
    it('does not show group checkboxes when only one group', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[createLegendGroup()]}
          layerVisibility={EMPTY_VISIBILITY}
          onToggleLayerVisibility={jest.fn()}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('shows group checkboxes when multiple groups', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({ displayTitle: 'Group A' }),
            createLegendGroup({ displayTitle: 'Group B' }),
          ]}
          layerVisibility={EMPTY_VISIBILITY}
          onToggleLayerVisibility={jest.fn()}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    });

    it('checkbox is checked when all slices are visible', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              displayTitle: 'A',
              entries: [
                { sliceId: '1', legendEntry: createSimpleLegendEntry() },
              ],
            }),
            createLegendGroup({
              displayTitle: 'B',
              entries: [
                { sliceId: '2', legendEntry: createSimpleLegendEntry() },
              ],
            }),
          ]}
          layerVisibility={{ '1': true, '2': true }}
          onToggleLayerVisibility={jest.fn()}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeChecked();
    });

    it('checkbox is unchecked when all slices are hidden', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              displayTitle: 'A',
              entries: [
                { sliceId: '1', legendEntry: createSimpleLegendEntry() },
              ],
            }),
            createLegendGroup({
              displayTitle: 'B',
              entries: [
                { sliceId: '2', legendEntry: createSimpleLegendEntry() },
              ],
            }),
          ]}
          layerVisibility={{ '1': false, '2': true }}
          onToggleLayerVisibility={jest.fn()}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).not.toBeChecked();
    });

    it('calls onToggleLayerVisibility with all group sliceIds', () => {
      const onToggle = jest.fn();
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              displayTitle: 'A',
              entries: [
                { sliceId: '1', legendEntry: createSimpleLegendEntry() },
                { sliceId: '2', legendEntry: createSimpleLegendEntry() },
              ],
            }),
            createLegendGroup({ displayTitle: 'B' }),
          ]}
          layerVisibility={EMPTY_VISIBILITY}
          onToggleLayerVisibility={onToggle}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      const checkboxes = screen.getAllByRole('checkbox');
      userEvent.click(checkboxes[0]);
      expect(onToggle).toHaveBeenCalledWith(['1', '2']);
    });
  });

  describe('indeterminate state', () => {
    it('is indeterminate when some slices visible, some not', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              displayTitle: 'Mixed',
              entries: [
                { sliceId: '1', legendEntry: createSimpleLegendEntry() },
                { sliceId: '2', legendEntry: createSimpleLegendEntry() },
              ],
            }),
            createLegendGroup({ displayTitle: 'Other' }),
          ]}
          layerVisibility={{ '1': true, '2': false }}
          onToggleLayerVisibility={jest.fn()}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      const checkbox = screen.getAllByRole('checkbox')[0] as HTMLInputElement;
      expect(checkbox.indeterminate).toBe(true);
    });

    it('is indeterminate when categories are partially enabled', () => {
      const entry = createCategoricalLegendEntry({
        categories: [
          createCategoryEntry({ label: 'Enabled', enabled: true }),
          createCategoryEntry({ label: 'Disabled', enabled: false }),
        ],
      });
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              displayTitle: 'Partial',
              entries: [{ sliceId: '1', legendEntry: entry }],
            }),
            createLegendGroup({ displayTitle: 'Other' }),
          ]}
          layerVisibility={{ '1': true }}
          onToggleLayerVisibility={jest.fn()}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      const checkbox = screen.getAllByRole('checkbox')[0] as HTMLInputElement;
      expect(checkbox.indeterminate).toBe(true);
    });
  });

  describe('category checkboxes', () => {
    it('renders category checkboxes when onToggleCategory is provided', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              entries: [
                { sliceId: '1', legendEntry: createCategoricalLegendEntry() },
              ],
            }),
          ]}
          layerVisibility={EMPTY_VISIBILITY}
          onToggleCategory={jest.fn()}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    });

    it('does not render category checkboxes when onToggleCategory is undefined', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              entries: [
                { sliceId: '1', legendEntry: createCategoricalLegendEntry() },
              ],
            }),
          ]}
          layerVisibility={EMPTY_VISIBILITY}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('calls onToggleCategory with correct sliceId and label', () => {
      const onToggleCategory = jest.fn();
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              entries: [
                {
                  sliceId: '42',
                  legendEntry: createCategoricalLegendEntry({
                    categories: [
                      createCategoryEntry({ label: 'Buildings' }),
                      createCategoryEntry({ label: 'Roads' }),
                    ],
                  }),
                },
              ],
            }),
          ]}
          layerVisibility={EMPTY_VISIBILITY}
          onToggleCategory={onToggleCategory}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      const checkboxes = screen.getAllByRole('checkbox');
      userEvent.click(checkboxes[0]);
      expect(onToggleCategory).toHaveBeenCalledWith('42', 'Buildings');
    });
  });

  describe('entry-level checkboxes', () => {
    it('shows per-entry checkboxes when group has multiple entries', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              entries: [
                {
                  sliceId: '1',
                  legendEntry: createSimpleLegendEntry({
                    legendName: 'Layer A',
                  }),
                },
                {
                  sliceId: '2',
                  legendEntry: createSimpleLegendEntry({
                    legendName: 'Layer B',
                  }),
                },
              ],
            }),
          ]}
          layerVisibility={EMPTY_VISIBILITY}
          onToggleLayerVisibility={jest.fn()}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(2);
    });

    it('does not show per-entry checkboxes when group has single entry', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              entries: [
                { sliceId: '1', legendEntry: createSimpleLegendEntry() },
              ],
            }),
          ]}
          layerVisibility={EMPTY_VISIBILITY}
          onToggleLayerVisibility={jest.fn()}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
  });

  describe('optimistic visibility (no toggle lag)', () => {
    it('group checkbox updates immediately on click without waiting for layerVisibility prop to change', () => {
      const onToggle = jest.fn();
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              displayTitle: 'A',
              entries: [
                { sliceId: '1', legendEntry: createSimpleLegendEntry() },
              ],
            }),
            createLegendGroup({
              displayTitle: 'B',
              entries: [
                { sliceId: '2', legendEntry: createSimpleLegendEntry() },
              ],
            }),
          ]}
          layerVisibility={{ '1': true, '2': true }}
          onToggleLayerVisibility={onToggle}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      const checkboxes = screen.getAllByRole('checkbox');
      // Group A checkbox starts checked
      expect(checkboxes[0]).toBeChecked();
      // Click to toggle — layerVisibility prop does NOT change (simulates async parent update)
      userEvent.click(checkboxes[0]);
      // Checkbox should immediately reflect the toggled state via optimistic local state,
      // without needing the parent to re-render with a new layerVisibility prop.
      expect(checkboxes[0]).not.toBeChecked();
      expect(onToggle).toHaveBeenCalledWith(['1']);
    });

    it('group checkbox re-toggles correctly on second click', () => {
      const onToggle = jest.fn();
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              displayTitle: 'A',
              entries: [
                { sliceId: '1', legendEntry: createSimpleLegendEntry() },
              ],
            }),
            createLegendGroup({
              displayTitle: 'B',
              entries: [
                { sliceId: '2', legendEntry: createSimpleLegendEntry() },
              ],
            }),
          ]}
          layerVisibility={{ '1': true, '2': true }}
          onToggleLayerVisibility={onToggle}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      const checkboxes = screen.getAllByRole('checkbox');
      userEvent.click(checkboxes[0]); // toggle off
      expect(checkboxes[0]).not.toBeChecked();
      userEvent.click(checkboxes[0]); // toggle back on
      expect(checkboxes[0]).toBeChecked();
      expect(onToggle).toHaveBeenCalledTimes(2);
    });
  });

  describe('legend entry content rendering', () => {
    it('renders swatch and legend name for simple entry', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              entries: [
                {
                  sliceId: '1',
                  legendEntry: createSimpleLegendEntry({
                    legendName: 'Simple Layer',
                  }),
                },
              ],
            }),
          ]}
          layerVisibility={EMPTY_VISIBILITY}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      expect(screen.getByText('Simple Layer')).toBeInTheDocument();
    });

    it('renders category labels for categorical entry', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              entries: [
                {
                  sliceId: '1',
                  legendEntry: createCategoricalLegendEntry({
                    categories: [
                      createCategoryEntry({ label: 'Forests' }),
                      createCategoryEntry({ label: 'Lakes' }),
                    ],
                  }),
                },
              ],
            }),
          ]}
          layerVisibility={EMPTY_VISIBILITY}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      expect(screen.getByText('Forests')).toBeInTheDocument();
      expect(screen.getByText('Lakes')).toBeInTheDocument();
    });

    it('renders metric gradient with bounds', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              entries: [
                {
                  sliceId: '1',
                  legendEntry: createMetricLegendEntry({
                    metric: {
                      lower: 0,
                      upper: 500,
                      startColor: GREEN,
                      endColor: RED,
                    },
                  }),
                },
              ],
            }),
          ]}
          layerVisibility={EMPTY_VISIBILITY}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('500+')).toBeInTheDocument();
    });
  });

  describe('empty layer state', () => {
    it('shows checkbox and "no data" label instead of spinner for empty entry', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              displayTitle: 'Empty Group',
              entries: [
                {
                  sliceId: '1',
                  legendEntry: createSimpleLegendEntry({
                    legendName: 'Empty Layer',
                    empty: true,
                  }),
                },
              ],
            }),
            createLegendGroup({ displayTitle: 'Other' }),
          ]}
          layerVisibility={EMPTY_VISIBILITY}
          onToggleLayerVisibility={jest.fn()}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      expect(screen.getByText('Empty Layer')).toBeInTheDocument();
      expect(screen.getByText('Visible but Empty')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('does not show "no data" label for non-empty entry', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              entries: [
                {
                  sliceId: '1',
                  legendEntry: createSimpleLegendEntry({
                    legendName: 'Normal Layer',
                  }),
                },
              ],
            }),
          ]}
          layerVisibility={EMPTY_VISIBILITY}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      expect(screen.getByText('Normal Layer')).toBeInTheDocument();
      expect(screen.queryByText('Visible but Empty')).not.toBeInTheDocument();
    });

    it('group header shows checkbox (not spinner) when all entries are empty', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              displayTitle: 'All Empty',
              entries: [
                {
                  sliceId: '1',
                  legendEntry: createSimpleLegendEntry({ empty: true }),
                },
                {
                  sliceId: '2',
                  legendEntry: createSimpleLegendEntry({ empty: true }),
                },
              ],
            }),
            createLegendGroup({ displayTitle: 'Other' }),
          ]}
          layerVisibility={EMPTY_VISIBILITY}
          onToggleLayerVisibility={jest.fn()}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      // Group header should render a checkbox, not a loading spinner
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThanOrEqual(2);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('group header checkbox is present when some entries have data', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              displayTitle: 'Mixed',
              entries: [
                {
                  sliceId: '1',
                  legendEntry: createSimpleLegendEntry({ empty: true }),
                },
                {
                  sliceId: '2',
                  legendEntry: createSimpleLegendEntry({ empty: false }),
                },
              ],
            }),
            createLegendGroup({ displayTitle: 'Other' }),
          ]}
          layerVisibility={EMPTY_VISIBILITY}
          onToggleLayerVisibility={jest.fn()}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    });

    it('shows spinner when loading, even if empty is also true', () => {
      renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              displayTitle: 'Loading',
              entries: [
                {
                  sliceId: '1',
                  legendEntry: createSimpleLegendEntry({
                    loading: true,
                    empty: true,
                  }),
                },
              ],
            }),
            createLegendGroup({
              displayTitle: 'Other',
              entries: [
                {
                  sliceId: '2',
                  legendEntry: createSimpleLegendEntry({
                    loading: true,
                  }),
                },
              ],
            }),
          ]}
          layerVisibility={EMPTY_VISIBILITY}
          onToggleLayerVisibility={jest.fn()}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      // Both group headers should show spinners, not checkboxes
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(screen.queryByText('Visible but Empty')).not.toBeInTheDocument();
    });

    it('transitions from loading to empty without spinner', () => {
      const { rerender } = renderWithTheme(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              displayTitle: 'Transitioning',
              entries: [
                {
                  sliceId: '1',
                  legendEntry: createSimpleLegendEntry({
                    legendName: 'Trans Layer',
                    loading: true,
                  }),
                },
              ],
            }),
            createLegendGroup({ displayTitle: 'Other' }),
          ]}
          layerVisibility={EMPTY_VISIBILITY}
          onToggleLayerVisibility={jest.fn()}
        />,
      );
      userEvent.click(screen.getByText('Legend'));
      expect(screen.queryByText('Visible but Empty')).not.toBeInTheDocument();

      // Re-render with loading finished and empty result
      rerender(
        <MultiLegend
          legendGroups={[
            createLegendGroup({
              displayTitle: 'Transitioning',
              entries: [
                {
                  sliceId: '1',
                  legendEntry: createSimpleLegendEntry({
                    legendName: 'Trans Layer',
                    loading: false,
                    empty: true,
                  }),
                },
              ],
            }),
            createLegendGroup({ displayTitle: 'Other' }),
          ]}
          layerVisibility={EMPTY_VISIBILITY}
          onToggleLayerVisibility={jest.fn()}
        />,
      );
      expect(screen.getByText('Trans Layer')).toBeInTheDocument();
      expect(screen.getByText('Visible but Empty')).toBeInTheDocument();
    });
  });
});
