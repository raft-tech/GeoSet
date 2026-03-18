import { renderHook, act } from '@testing-library/react-hooks';
import { useGroupedLegend, useDebouncedValue } from '../../src/utils/hooks';
import {
  createSimpleLegendEntry,
  createCategoricalLegendEntry,
  createMetricLegendEntry,
} from '../testFixtures';

describe('useGroupedLegend', () => {
  it('returns empty array for empty input', () => {
    const { result } = renderHook(() => useGroupedLegend({}));
    expect(result.current).toEqual([]);
  });

  it('groups simple entry by legendParentTitle', () => {
    const input = {
      '1': createSimpleLegendEntry({
        legendParentTitle: 'Parent Title',
        sliceName: 'Slice Name',
      }),
    };
    const { result } = renderHook(() => useGroupedLegend(input));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].displayTitle).toBe('Parent Title');
  });

  it('falls back to sliceName when no legendParentTitle for simple type', () => {
    const input = {
      '1': createSimpleLegendEntry({
        legendParentTitle: undefined,
        sliceName: 'My Slice',
      }),
    };
    const { result } = renderHook(() => useGroupedLegend(input));
    expect(result.current[0].displayTitle).toBe('My Slice');
  });

  it('groups categorical entry by legendName', () => {
    const input = {
      '1': createCategoricalLegendEntry({ legendName: 'Cat Legend' }),
    };
    const { result } = renderHook(() => useGroupedLegend(input));
    expect(result.current[0].displayTitle).toBe('Cat Legend');
  });

  it('groups metric entry by legendName', () => {
    const input = {
      '1': createMetricLegendEntry({ legendName: 'Metric Legend' }),
    };
    const { result } = renderHook(() => useGroupedLegend(input));
    expect(result.current[0].displayTitle).toBe('Metric Legend');
  });

  it('merges entries with same displayTitle into one group', () => {
    const input = {
      '1': createSimpleLegendEntry({
        legendParentTitle: 'Shared Title',
      }),
      '2': createSimpleLegendEntry({
        legendParentTitle: 'Shared Title',
        legendName: 'Layer 2',
      }),
    };
    const { result } = renderHook(() => useGroupedLegend(input));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].entries).toHaveLength(2);
  });

  it('keeps entries with different titles as separate groups', () => {
    const input = {
      '1': createSimpleLegendEntry({ legendParentTitle: 'Group A' }),
      '2': createSimpleLegendEntry({ legendParentTitle: 'Group B' }),
    };
    const { result } = renderHook(() => useGroupedLegend(input));
    expect(result.current).toHaveLength(2);
  });

  it('sets initialCollapsed=true only when ALL entries have it', () => {
    const input = {
      '1': createSimpleLegendEntry({
        legendParentTitle: 'Group',
        initialCollapsed: true,
      }),
      '2': createSimpleLegendEntry({
        legendParentTitle: 'Group',
        initialCollapsed: true,
      }),
    };
    const { result } = renderHook(() => useGroupedLegend(input));
    expect(result.current[0].initialCollapsed).toBe(true);
  });

  it('sets initialCollapsed=false when any entry lacks it', () => {
    const input = {
      '1': createSimpleLegendEntry({
        legendParentTitle: 'Group',
        initialCollapsed: true,
      }),
      '2': createSimpleLegendEntry({
        legendParentTitle: 'Group',
        initialCollapsed: false,
      }),
    };
    const { result } = renderHook(() => useGroupedLegend(input));
    expect(result.current[0].initialCollapsed).toBe(false);
  });
});

describe('useDebouncedValue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('does not update during delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'initial' } },
    );
    rerender({ value: 'updated' });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe('initial');
  });

  it('updates after delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'initial' } },
    );
    rerender({ value: 'updated' });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe('updated');
  });

  it('cancels pending update on rapid value changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'first' } },
    );
    rerender({ value: 'second' });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    rerender({ value: 'third' });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe('third');
  });
});
