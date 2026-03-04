import { useEffect, useMemo, useState } from 'react';
import {
  ConsolidatedLegendGroup,
  LegendGroup,
} from '../components/MultiLegend';

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
 * consolidate under a single collapsible header.
 */
export function useConsolidatedLegend(
  legendsBySlice: Record<string, LegendGroup>,
): ConsolidatedLegendGroup[] {
  return useMemo(() => {
    const groupMap = new Map<
      string,
      {
        entries: { sliceId: string; group: LegendGroup }[];
        allCollapsed: boolean;
      }
    >();

    for (const [sliceId, group] of Object.entries(legendsBySlice)) {
      const displayTitle =
        group.type === 'simple'
          ? group.legendParentTitle || group.sliceName
          : group.legendName;

      const existing = groupMap.get(displayTitle);
      if (existing) {
        existing.entries.push({ sliceId, group });
        // initialCollapsed only if ALL entries have it
        if (!group.initialCollapsed) {
          existing.allCollapsed = false;
        }
      } else {
        groupMap.set(displayTitle, {
          entries: [{ sliceId, group }],
          allCollapsed: !!group.initialCollapsed,
        });
      }
    }

    return Array.from(groupMap.entries()).map(
      ([displayTitle, { entries, allCollapsed }]) => ({
        displayTitle,
        entries,
        initialCollapsed: allCollapsed,
      }),
    );
  }, [legendsBySlice]);
}
