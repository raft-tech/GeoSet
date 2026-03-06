import { useEffect, useMemo, useState } from 'react';
import type { LegendEntry, LegendGroup } from '../types';

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Groups legend entries by display title so layers with the same name
 * appear under a single collapsible header.
 */
export function useGroupedLegend(
  legendsBySlice: Record<string, LegendEntry>,
): LegendGroup[] {
  return useMemo(() => {
    const groupMap = new Map<
      string,
      {
        entries: { sliceId: string; legendEntry: LegendEntry }[];
        allCollapsed: boolean;
      }
    >();

    for (const [sliceId, legendEntry] of Object.entries(legendsBySlice)) {
      const displayTitle =
        legendEntry.type === 'simple'
          ? legendEntry.legendParentTitle || legendEntry.sliceName
          : legendEntry.legendName;

      const existing = groupMap.get(displayTitle);
      if (existing) {
        existing.entries.push({ sliceId, legendEntry });
        // initialCollapsed only if ALL entries have it
        if (!legendEntry.initialCollapsed) {
          existing.allCollapsed = false;
        }
      } else {
        groupMap.set(displayTitle, {
          entries: [{ sliceId, legendEntry }],
          allCollapsed: !!legendEntry.initialCollapsed,
        });
      }
    }

    const result = Array.from(groupMap.entries()).map(
      ([displayTitle, { entries, allCollapsed }]) => ({
        displayTitle,
        entries,
        initialCollapsed: allCollapsed,
      }),
    );
    return result;
  }, [legendsBySlice]);
}
