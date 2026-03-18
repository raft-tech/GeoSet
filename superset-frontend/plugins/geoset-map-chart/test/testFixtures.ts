import type { RGBAColor } from '../src/utils/colors';
import type { LegendEntry, LegendGroup, CategoryEntry } from '../src/types';
import type { SizeLegend } from '../src/components/Legend';

// Color constants
export const RED: RGBAColor = [255, 0, 0, 255];
export const GREEN: RGBAColor = [0, 255, 0, 255];
export const BLUE: RGBAColor = [0, 0, 255, 255];
export const TEAL: RGBAColor = [0, 122, 135, 255];

export function createCategoryEntry(
  overrides?: Partial<CategoryEntry>,
): CategoryEntry {
  return {
    label: 'Category A',
    fillColor: RED,
    strokeColor: BLUE,
    enabled: true,
    ...overrides,
  };
}

export function createSimpleLegendEntry(
  overrides?: Partial<LegendEntry>,
): LegendEntry {
  return {
    legendName: 'Test Layer',
    sliceName: 'Slice 1',
    type: 'simple',
    simpleStyle: { fillColor: RED, strokeColor: BLUE },
    ...overrides,
  };
}

export function createCategoricalLegendEntry(
  overrides?: Partial<LegendEntry>,
): LegendEntry {
  return {
    legendName: 'Categories',
    sliceName: 'Slice 2',
    type: 'categorical',
    categories: [
      createCategoryEntry({ label: 'Cat A', fillColor: RED }),
      createCategoryEntry({ label: 'Cat B', fillColor: GREEN }),
    ],
    ...overrides,
  };
}

export function createMetricLegendEntry(
  overrides?: Partial<LegendEntry>,
): LegendEntry {
  return {
    legendName: 'Metric Layer',
    sliceName: 'Slice 3',
    type: 'metric',
    metric: { lower: 0, upper: 100, startColor: GREEN, endColor: RED },
    ...overrides,
  };
}

export function createSizeLegend(
  overrides?: Partial<SizeLegend>,
): SizeLegend {
  return {
    lower: 0,
    upper: 100,
    startSize: 5,
    endSize: 50,
    valueColumn: 'value',
    ...overrides,
  };
}

export function createLegendGroup(
  overrides?: Partial<LegendGroup>,
): LegendGroup {
  return {
    displayTitle: 'Test Group',
    entries: [{ sliceId: '1', legendEntry: createSimpleLegendEntry() }],
    initialCollapsed: false,
    ...overrides,
  };
}
