import { getDefaultColors, applyCategoryEnabledState } from '../../src/utils/legendHelpers';
import {
  RED,
  GREEN,
  BLUE,
  TEAL,
  createSimpleLegendEntry,
  createCategoricalLegendEntry,
  createMetricLegendEntry,
  createCategoryEntry,
} from '../testFixtures';

describe('getDefaultColors', () => {
  it('returns simpleStyle colors when present', () => {
    const entry = createSimpleLegendEntry({
      simpleStyle: { fillColor: RED, strokeColor: BLUE },
    });
    expect(getDefaultColors(entry)).toEqual({ fill: RED, stroke: BLUE });
  });

  it('returns metric startColor for both fill and stroke', () => {
    const entry = createMetricLegendEntry();
    expect(getDefaultColors(entry)).toEqual({ fill: GREEN, stroke: GREEN });
  });

  it('returns first category colors when no simpleStyle or metric', () => {
    const entry = createCategoricalLegendEntry();
    const result = getDefaultColors(entry);
    expect(result.fill).toEqual(RED);
    expect(result.stroke).toEqual(BLUE);
  });

  it('returns fallback teal when no style information', () => {
    const entry = createSimpleLegendEntry({ simpleStyle: undefined });
    expect(getDefaultColors(entry)).toEqual({ fill: TEAL, stroke: TEAL });
  });

  it('simpleStyle takes priority over metric', () => {
    const entry = createSimpleLegendEntry({
      simpleStyle: { fillColor: RED, strokeColor: BLUE },
      metric: { lower: 0, upper: 100, startColor: GREEN, endColor: GREEN },
    });
    expect(getDefaultColors(entry)).toEqual({ fill: RED, stroke: BLUE });
  });

  it('simpleStyle takes priority over categories', () => {
    const entry = createSimpleLegendEntry({
      simpleStyle: { fillColor: RED, strokeColor: BLUE },
      categories: [createCategoryEntry({ fillColor: GREEN, strokeColor: GREEN })],
    });
    expect(getDefaultColors(entry)).toEqual({ fill: RED, stroke: BLUE });
  });

  it('metric takes priority over categories', () => {
    const entry = createCategoricalLegendEntry({
      simpleStyle: undefined,
      metric: { lower: 0, upper: 100, startColor: GREEN, endColor: RED },
    });
    expect(getDefaultColors(entry)).toEqual({ fill: GREEN, stroke: GREEN });
  });

  it('returns undefined fill/stroke when simpleStyle has undefined inner properties', () => {
    const entry = createSimpleLegendEntry({
      simpleStyle: { fillColor: undefined as any, strokeColor: undefined as any },
    });
    expect(getDefaultColors(entry)).toEqual({ fill: undefined, stroke: undefined });
  });

  it('handles empty categories array with fallback teal', () => {
    const entry = createCategoricalLegendEntry({
      simpleStyle: undefined,
      categories: [],
    });
    expect(getDefaultColors(entry)).toEqual({ fill: TEAL, stroke: TEAL });
  });
});

describe('applyCategoryEnabledState', () => {
  it('returns undefined for undefined categories', () => {
    expect(applyCategoryEnabledState(undefined, {})).toBeUndefined();
  });

  it('sets enabled=true when label not in visibility map', () => {
    const categories = [createCategoryEntry({ label: 'A' })];
    const result = applyCategoryEnabledState(categories, {});
    expect(result![0].enabled).toBe(true);
  });

  it('sets enabled=false when visibility[label] is false', () => {
    const categories = [createCategoryEntry({ label: 'A' })];
    const result = applyCategoryEnabledState(categories, { A: false });
    expect(result![0].enabled).toBe(false);
  });

  it('handles mixed visibility states', () => {
    const categories = [
      createCategoryEntry({ label: 'A' }),
      createCategoryEntry({ label: 'B' }),
    ];
    const result = applyCategoryEnabledState(categories, { A: false, B: true });
    expect(result![0].enabled).toBe(false);
    expect(result![1].enabled).toBe(true);
  });

  it('treats null, 0, and empty string as enabled (only strict false disables)', () => {
    const categories = [
      createCategoryEntry({ label: 'A' }),
      createCategoryEntry({ label: 'B' }),
      createCategoryEntry({ label: 'C' }),
    ];
    const result = applyCategoryEnabledState(categories, {
      A: null as any, B: 0 as any, C: '' as any,
    });
    expect(result!.every(c => c.enabled)).toBe(true);
  });

  it('preserves other category properties', () => {
    const categories = [
      createCategoryEntry({ label: 'A', fillColor: RED, strokeColor: BLUE }),
    ];
    const result = applyCategoryEnabledState(categories, { A: false });
    expect(result![0].fillColor).toEqual(RED);
    expect(result![0].strokeColor).toEqual(BLUE);
    expect(result![0].label).toBe('A');
  });
});
