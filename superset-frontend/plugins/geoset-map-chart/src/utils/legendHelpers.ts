import type { RGBAColor } from './colors';
import type { LegendEntry, CategoryEntry } from '../types';

/** Resolve the default fill/stroke colors for a legend entry. */
export const getDefaultColors = (
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

/** Apply enabled state to legend categories based on visibility map. */
export const applyCategoryEnabledState = (
  categories: CategoryEntry[] | undefined,
  visibility: Record<string, boolean>,
): CategoryEntry[] | undefined =>
  categories?.map(cat => ({
    ...cat,
    enabled: visibility[cat.label] !== false,
  }));
