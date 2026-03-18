import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Legend, { LegendProps } from '../../src/components/Legend';
import { renderWithTheme } from '../testHelpers';
import { RED, GREEN, BLUE } from '../testFixtures';
import '../mocks/svgIcons';

// Mock child components to isolate Legend behavior
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
  return {
    __esModule: true,
    default: MockCategorySizeGrid,
  };
});

const defaultProps: LegendProps = {
  format: null,
  categories: {
    'Category A': { enabled: true, color: [255, 0, 0, 255] },
    'Category B': { enabled: true, color: [0, 255, 0, 255] },
  },
};

function renderLegend(overrides?: Partial<LegendProps>) {
  return renderWithTheme(<Legend {...defaultProps} {...overrides} />);
}

describe('Legend', () => {
  describe('returns null when empty', () => {
    it('returns null when no categories and no legends', () => {
      const { container } = renderLegend({ categories: {} });
      expect(container).toBeEmptyDOMElement();
    });

    it('returns null when position is null', () => {
      const { container } = renderLegend({ position: null });
      expect(container).toBeEmptyDOMElement();
    });

    it('returns null when no metric/size legends and categories is empty', () => {
      const { container } = renderLegend({
        categories: {},
        metricLegend: null,
        sizeLegend: null,
      });
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('positioning', () => {
    it('defaults to top-right', () => {
      const { container } = renderLegend();
      const legend = container.firstChild as HTMLElement;
      expect(legend).toHaveStyle({ right: '10px' });
      expect(legend).toHaveStyle({ top: '0px' });
    });

    it('positions top-left for "tl"', () => {
      const { container } = renderLegend({ position: 'tl' });
      const legend = container.firstChild as HTMLElement;
      expect(legend).toHaveStyle({ left: '10px' });
      expect(legend).toHaveStyle({ top: '0px' });
    });

    it('positions bottom-right for "br"', () => {
      const { container } = renderLegend({ position: 'br' });
      const legend = container.firstChild as HTMLElement;
      expect(legend).toHaveStyle({ right: '10px' });
      expect(legend).toHaveStyle({ bottom: '0px' });
    });

    it('positions bottom-left for "bl"', () => {
      const { container } = renderLegend({ position: 'bl' });
      const legend = container.firstChild as HTMLElement;
      expect(legend).toHaveStyle({ left: '10px' });
      expect(legend).toHaveStyle({ bottom: '0px' });
    });

    it('defaults to bottom-right for an invalid position string', () => {
      const { container } = renderLegend({ position: 'invalid' as any });
      const legend = container.firstChild as HTMLElement;
      expect(legend).toHaveStyle({ right: '10px' });
      expect(legend).toHaveStyle({ bottom: '0px' });
    });
  });

  describe('category rendering', () => {
    it('renders category labels', () => {
      renderLegend();
      expect(screen.getByText('Category A')).toBeInTheDocument();
      expect(screen.getByText('Category B')).toBeInTheDocument();
    });

    it('uses legend_name when provided', () => {
      renderLegend({
        categories: {
          key_1: { enabled: true, color: RED, legend_name: 'Display Name' },
        },
      });
      expect(screen.getByText('Display Name')).toBeInTheDocument();
      expect(screen.queryByText('key_1')).not.toBeInTheDocument();
    });

    it('renders disabled categories with reduced alpha', () => {
      renderLegend({
        categories: {
          Disabled: { enabled: false, color: [255, 0, 0, 255] },
        },
      });
      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });

    it('renders each category as a list item', () => {
      renderLegend({
        categories: {
          A: { enabled: true, color: RED },
          B: { enabled: true, color: GREEN },
          C: { enabled: true, color: BLUE },
        },
      });
      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(3);
    });
  });

  describe('category interactions', () => {
    it('calls toggleCategory on click', () => {
      const toggleCategory = jest.fn();
      renderLegend({ toggleCategory });
      userEvent.click(screen.getByText('Category A'));
      expect(toggleCategory).toHaveBeenCalledWith('Category A');
    });

    it('calls showSingleCategory on double-click', () => {
      const showSingleCategory = jest.fn();
      renderLegend({ showSingleCategory });
      userEvent.dblClick(screen.getByText('Category B'));
      expect(showSingleCategory).toHaveBeenCalledWith('Category B');
    });

    it('prevents default on click', () => {
      const toggleCategory = jest.fn();
      renderLegend({ toggleCategory });
      const link = screen.getByText('Category A').closest('a')!;
      const event = new MouseEvent('click', { bubbles: true });
      const spy = jest.spyOn(event, 'preventDefault');
      link.dispatchEvent(event);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('number formatting', () => {
    it('applies d3Format to category labels', () => {
      renderLegend({
        format: ',.0f',
        categories: {
          '1000': { enabled: true, color: RED },
        },
      });
      expect(screen.getByText('1,000')).toBeInTheDocument();
    });

    it('does not format when forceCategorical is true', () => {
      renderLegend({
        format: ',.0f',
        forceCategorical: true,
        categories: {
          '1000': { enabled: true, color: RED },
        },
      });
      expect(screen.getByText('1000')).toBeInTheDocument();
    });

    it('formats range categories with delimiter', () => {
      renderLegend({
        format: ',.0f',
        categories: {
          '1000 - 2000': { enabled: true, color: RED },
        },
      });
      expect(screen.getByText('1,000 - 2,000')).toBeInTheDocument();
    });

    it('displays raw label when format is null', () => {
      renderLegend({
        format: null,
        categories: {
          my_category: { enabled: true, color: RED },
        },
      });
      expect(screen.getByText('my_category')).toBeInTheDocument();
    });
  });

  describe('metric legend', () => {
    const metricLegend = {
      legendName: 'temperature',
      startColor: GREEN as [number, number, number, number],
      endColor: RED as [number, number, number, number],
      min: 0,
      max: 100,
    };

    it('renders metric legend title in Title Case', () => {
      renderLegend({ metricLegend });
      expect(screen.getByText('Temperature')).toBeInTheDocument();
    });

    it('renders gradient bar element', () => {
      const { container } = renderLegend({ metricLegend });
      const gradientBar = container.querySelector('.gradient-bar');
      expect(gradientBar).toBeInTheDocument();
    });

    it('renders min and max labels', () => {
      renderLegend({ metricLegend });
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('100+')).toBeInTheDocument();
    });

    it('handles null min/max gracefully', () => {
      renderLegend({
        metricLegend: {
          ...metricLegend,
          min: undefined as any,
          max: undefined as any,
        },
      });
      expect(screen.getByText('Temperature')).toBeInTheDocument();
    });

    it('renders with percentile bounds', () => {
      renderLegend({
        metricLegend: { ...metricLegend, usesPercentBounds: true },
      });
      const labels = screen.getByText('Temperature').closest('.metric-legend')!;
      expect(labels).toBeInTheDocument();
    });

    it('converts snake_case legend names to Title Case', () => {
      renderLegend({
        metricLegend: { ...metricLegend, legendName: 'wind_speed' },
      });
      expect(screen.getByText('Wind Speed')).toBeInTheDocument();
    });

    it('renders metric legend alongside categories', () => {
      renderLegend({ metricLegend });
      expect(screen.getByText('Temperature')).toBeInTheDocument();
      expect(screen.getByText('Category A')).toBeInTheDocument();
      expect(screen.getByText('Category B')).toBeInTheDocument();
    });
  });

  describe('size legend', () => {
    const sizeLegend = {
      lower: 10,
      upper: 500,
      startSize: 5,
      endSize: 50,
      valueColumn: 'population',
    };

    it('renders GraduatedIcons when size legend has range', () => {
      renderLegend({ sizeLegend, categories: {} });
      expect(screen.getByTestId('graduated-icons')).toBeInTheDocument();
    });

    it('renders title from valueColumn in Title Case', () => {
      renderLegend({ sizeLegend, categories: {} });
      expect(screen.getByText('Population')).toBeInTheDocument();
    });

    it('uses legendTitle when provided', () => {
      renderLegend({
        sizeLegend: { ...sizeLegend, legendTitle: 'Custom Title' },
        categories: {},
      });
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('does not render when startSize equals endSize', () => {
      const { container } = renderLegend({
        sizeLegend: { ...sizeLegend, startSize: 20, endSize: 20 },
        categories: {},
      });
      expect(container).toBeEmptyDOMElement();
    });

    it('passes bounds to GraduatedIcons', () => {
      renderLegend({ sizeLegend, categories: {} });
      const icons = screen.getByTestId('graduated-icons');
      expect(icons).toHaveAttribute('data-lower', '10');
      expect(icons).toHaveAttribute('data-upper', '500');
    });
  });

  describe('combined metric + size', () => {
    const metricLegend = {
      legendName: 'metric_val',
      startColor: GREEN as [number, number, number, number],
      endColor: RED as [number, number, number, number],
      min: 0,
      max: 100,
    };

    const sizeLegend = {
      lower: 0,
      upper: 100,
      startSize: 5,
      endSize: 50,
      valueColumn: 'value',
    };

    it('renders combined GraduatedIcons when isCombinedMetricSize is true', () => {
      renderLegend({
        isCombinedMetricSize: true,
        metricLegend,
        sizeLegend,
        categories: {},
      });
      expect(screen.getByTestId('graduated-icons')).toBeInTheDocument();
    });

    it('uses sizeLegend legendTitle for combined display', () => {
      renderLegend({
        isCombinedMetricSize: true,
        metricLegend,
        sizeLegend: { ...sizeLegend, legendTitle: 'Combined Title' },
        categories: {},
      });
      expect(screen.getByText('Combined Title')).toBeInTheDocument();
    });

    it('falls back to metricLegend name when no legendTitle', () => {
      renderLegend({
        isCombinedMetricSize: true,
        metricLegend,
        sizeLegend,
        categories: {},
      });
      // Uses raw legendName (not title-cased) as the fallback
      expect(screen.getByText('metric_val')).toBeInTheDocument();
    });

    it('does not render gradient bar in combined mode', () => {
      const { container } = renderLegend({
        isCombinedMetricSize: true,
        metricLegend,
        sizeLegend,
        categories: {},
      });
      expect(container.querySelector('.gradient-bar')).not.toBeInTheDocument();
    });

    it('still renders categories alongside combined legend', () => {
      renderLegend({
        isCombinedMetricSize: true,
        metricLegend,
        sizeLegend,
      });
      expect(screen.getByText('Category A')).toBeInTheDocument();
      expect(screen.getByTestId('graduated-icons')).toBeInTheDocument();
    });
  });

  describe('combined category + size grid', () => {
    const sizeLegend = {
      lower: 0,
      upper: 100,
      startSize: 5,
      endSize: 50,
      valueColumn: 'total_count',
    };

    it('renders CategorySizeGrid when categories and size legend present', () => {
      renderLegend({ sizeLegend, metricLegend: undefined });
      expect(screen.getByTestId('category-size-grid')).toBeInTheDocument();
    });

    it('does not render CategorySizeGrid when metricLegend is also present', () => {
      renderLegend({
        sizeLegend,
        metricLegend: {
          legendName: 'metric',
          startColor: GREEN as [number, number, number, number],
          endColor: RED as [number, number, number, number],
          min: 0,
          max: 100,
        },
      });
      expect(
        screen.queryByTestId('category-size-grid'),
      ).not.toBeInTheDocument();
    });

    it('does not render standard category list when in combined mode', () => {
      renderLegend({ sizeLegend, metricLegend: undefined });
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('renders category labels inside the grid', () => {
      renderLegend({ sizeLegend, metricLegend: undefined });
      const grid = screen.getByTestId('category-size-grid');
      expect(within(grid).getByText('Category A')).toBeInTheDocument();
      expect(within(grid).getByText('Category B')).toBeInTheDocument();
    });

    it('uses legendTitle for the grid section', () => {
      renderLegend({
        sizeLegend: { ...sizeLegend, legendTitle: 'Size by Count' },
        metricLegend: undefined,
      });
      expect(screen.getByText('Size by Count')).toBeInTheDocument();
    });

    it('calls toggleCategory from grid label click', () => {
      const toggleCategory = jest.fn();
      renderLegend({
        sizeLegend,
        metricLegend: undefined,
        toggleCategory,
      });
      const grid = screen.getByTestId('category-size-grid');
      userEvent.click(within(grid).getByText('Category A'));
      expect(toggleCategory).toHaveBeenCalledWith('Category A');
    });

    it('calls showSingleCategory from grid label double-click', () => {
      const showSingleCategory = jest.fn();
      renderLegend({
        sizeLegend,
        metricLegend: undefined,
        showSingleCategory,
      });
      const grid = screen.getByTestId('category-size-grid');
      userEvent.dblClick(within(grid).getByText('Category B'));
      expect(showSingleCategory).toHaveBeenCalledWith('Category B');
    });
  });

  describe('renders with metric legend even when position is null', () => {
    it('renders when metricLegend is present and position is null', () => {
      const { container } = renderLegend({
        position: null,
        categories: {},
        metricLegend: {
          legendName: 'metric',
          startColor: GREEN as [number, number, number, number],
          endColor: RED as [number, number, number, number],
          min: 0,
          max: 50,
        },
      });
      expect(container).not.toBeEmptyDOMElement();
    });
  });
});
