import { renderHook, act } from '@testing-library/react-hooks';
import { useLassoResults } from '../../src/hooks/useLassoResults';
import type { Coordinate } from '../../src/utils/measureDistance';

describe('useLassoResults', () => {
  it('returns correct initial state', () => {
    const { result } = renderHook(() => useLassoResults());
    expect(result.current.selectedFeatures).toEqual([]);
    expect(result.current.lassoPolygon).toBeNull();
    expect(result.current.anchorGeoCoord).toBeNull();
  });

  it('stores polygon and calls onPolygonComplete when handleLassoComplete fires', () => {
    const onPolygonComplete = jest.fn();
    const { result } = renderHook(() =>
      useLassoResults({ onPolygonComplete }),
    );

    const polygon: Coordinate[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ];
    act(() => result.current.handleLassoComplete(polygon));

    expect(result.current.lassoPolygon).toEqual(polygon);
    expect(onPolygonComplete).toHaveBeenCalledWith(polygon);
  });

  it('clearSelection resets features, polygon, and anchor', () => {
    const { result } = renderHook(() => useLassoResults());

    act(() => {
      result.current.handleLassoComplete([
        [0, 0],
        [1, 0],
        [1, 1],
      ]);
      result.current.setSelectedFeatures([
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: {},
        },
      ]);
      result.current.setAnchorGeoCoord([10, 20]);
    });

    expect(result.current.selectedFeatures).toHaveLength(1);
    expect(result.current.lassoPolygon).not.toBeNull();
    expect(result.current.anchorGeoCoord).not.toBeNull();

    act(() => result.current.clearSelection());

    expect(result.current.selectedFeatures).toEqual([]);
    expect(result.current.lassoPolygon).toBeNull();
    expect(result.current.anchorGeoCoord).toBeNull();
  });

  it('uses latest onPolygonComplete callback without stale closures', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { result, rerender } = renderHook(
      ({ cb }) => useLassoResults({ onPolygonComplete: cb }),
      { initialProps: { cb: first } },
    );

    rerender({ cb: second });

    const polygon: Coordinate[] = [[0, 0]];
    act(() => result.current.handleLassoComplete(polygon));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(polygon);
  });
});
