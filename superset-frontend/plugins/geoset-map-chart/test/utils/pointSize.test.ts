import { getDynamicPointZoomScale } from '../../src/utils/pointSize';

describe('getDynamicPointZoomScale', () => {
  it('keeps the configured size through zoom 4', () => {
    expect(getDynamicPointZoomScale(0)).toBe(1);
    expect(getDynamicPointZoomScale(4)).toBe(1);
  });

  it('gradually increases point size above zoom 4', () => {
    expect(getDynamicPointZoomScale(6)).toBe(3);
    expect(getDynamicPointZoomScale(8)).toBe(5);
  });

  it('caps the multiplier at 8', () => {
    expect(getDynamicPointZoomScale(24)).toBe(8);
    expect(getDynamicPointZoomScale(30)).toBe(8);
  });

  it('falls back safely for an invalid zoom', () => {
    expect(getDynamicPointZoomScale(Number.NaN)).toBe(1);
  });
});
