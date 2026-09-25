import { getDynamicPointZoomScale } from '../../src/utils/pointSize';

describe('getDynamicPointZoomScale', () => {
  it('keeps the configured size through zoom 8', () => {
    expect(getDynamicPointZoomScale(0)).toBe(1);
    expect(getDynamicPointZoomScale(8)).toBe(1);
  });

  it('gradually increases point size above zoom 8', () => {
    expect(getDynamicPointZoomScale(10)).toBeCloseTo(1.38, 2);
    expect(getDynamicPointZoomScale(12)).toBeCloseTo(1.91, 2);
  });

  it('caps the multiplier at 3.5', () => {
    expect(getDynamicPointZoomScale(16)).toBe(3.5);
    expect(getDynamicPointZoomScale(22)).toBe(3.5);
  });

  it('falls back safely for an invalid zoom', () => {
    expect(getDynamicPointZoomScale(Number.NaN)).toBe(1);
  });
});
