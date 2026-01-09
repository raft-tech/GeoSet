/* eslint-disable no-restricted-globals */
/* eslint-disable no-plusplus */
import {
  ColorByValueConfig,
  computeMetricColorScaleUnified,
  RGBAColor,
} from './colors';

export function getMetricColor(
  value: number,
  metricSpec: ColorByValueConfig,
  domain: [number, number],
): RGBAColor | null {
  if (value == null || isNaN(value)) return null;

  const scale = computeMetricColorScaleUnified(metricSpec, domain);
  return scale(value);
}
