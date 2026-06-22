import { renderHook, act } from '@testing-library/react-hooks';

// Mock the editable-layers library — EditableGeoJsonLayer requires WebGL.
// Use a global ref so the mock factory (which is hoisted) can access it.
let mockLayerCalls: any[] = [];

jest.mock('@deck.gl-community/editable-layers', () => {
  class FakeDrawPolygonByDraggingMode {}
  class FakeDrawPolygonMode {}
  class FakeDrawCircleFromCenterMode {}
  class FakeDrawRectangleMode {}
  class FakeViewMode {}

  function MockEditableGeoJsonLayer(props: any) {
    mockLayerCalls.push(props);
    return { id: props.id, props };
  }

  return {
    EditableGeoJsonLayer: MockEditableGeoJsonLayer,
    DrawPolygonByDraggingMode: FakeDrawPolygonByDraggingMode,
    DrawPolygonMode: FakeDrawPolygonMode,
    DrawCircleFromCenterMode: FakeDrawCircleFromCenterMode,
    DrawRectangleMode: FakeDrawRectangleMode,
    ViewMode: FakeViewMode,
  };
});

import { useLassoLayer } from '../../src/components/useLassoLayer';

beforeEach(() => {
  mockLayerCalls = [];
});

describe('useLassoLayer', () => {
  it('returns empty layers when inactive', () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() => useLassoLayer(false, onComplete));
    expect(result.current.layers).toEqual([]);
  });

  it('returns one layer when active', () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() => useLassoLayer(true, onComplete));
    expect(result.current.layers).toHaveLength(1);
    expect(mockLayerCalls.length).toBeGreaterThan(0);
  });

  it('creates layer with correct id', () => {
    const onComplete = jest.fn();
    renderHook(() => useLassoLayer(true, onComplete));
    expect(mockLayerCalls[0]).toEqual(
      expect.objectContaining({ id: 'lasso-editable-layer' }),
    );
  });

  it('calls onPolygonComplete when addFeature edit occurs', () => {
    const onComplete = jest.fn();
    renderHook(() => useLassoLayer(true, onComplete));

    const { onEdit } = mockLayerCalls[0];

    const fakePolygon = {
      type: 'FeatureCollection',
      features: [
        {
          geometry: {
            coordinates: [
              [
                [10, 20],
                [30, 40],
                [50, 60],
                [10, 20],
              ],
            ],
          },
        },
      ],
    };

    act(() => {
      onEdit({ updatedData: fakePolygon, editType: 'addFeature' });
    });

    expect(onComplete).toHaveBeenCalledWith([
      [10, 20],
      [30, 40],
      [50, 60],
      [10, 20],
    ]);
  });

  it('does not call onPolygonComplete for non-addFeature edits', () => {
    const onComplete = jest.fn();
    renderHook(() => useLassoLayer(true, onComplete));

    const { onEdit } = mockLayerCalls[0];

    act(() => {
      onEdit({
        updatedData: { type: 'FeatureCollection', features: [] },
        editType: 'movePosition',
      });
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('resets data when transitioning from inactive to active', () => {
    const onComplete = jest.fn();
    const { rerender } = renderHook(
      ({ active }) => useLassoLayer(active, onComplete),
      { initialProps: { active: false } },
    );

    mockLayerCalls = [];
    rerender({ active: true });

    expect(mockLayerCalls[0]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'FeatureCollection',
          features: [],
        }),
      }),
    );
  });

  it('returns empty layers when transitioning from active to inactive', () => {
    const onComplete = jest.fn();
    const { result, rerender } = renderHook(
      ({ active }) => useLassoLayer(active, onComplete),
      { initialProps: { active: true } },
    );

    expect(result.current.layers).toHaveLength(1);

    rerender({ active: false });
    expect(result.current.layers).toEqual([]);
  });

  it('creates a layer for circle draw mode with dragToDraw config', () => {
    const onComplete = jest.fn();
    renderHook(() => useLassoLayer(true, onComplete, 'circle'));
    const lastCall = mockLayerCalls[mockLayerCalls.length - 1];
    expect(lastCall).toEqual(
      expect.objectContaining({
        id: 'lasso-editable-layer',
        modeConfig: { dragToDraw: true },
      }),
    );
  });

  it('creates a layer for rectangle draw mode with dragToDraw config', () => {
    const onComplete = jest.fn();
    renderHook(() => useLassoLayer(true, onComplete, 'rectangle'));
    const lastCall = mockLayerCalls[mockLayerCalls.length - 1];
    expect(lastCall).toEqual(
      expect.objectContaining({
        id: 'lasso-editable-layer',
        modeConfig: { dragToDraw: true },
      }),
    );
  });

  it('does not set dragToDraw for polygon mode', () => {
    const onComplete = jest.fn();
    renderHook(() => useLassoLayer(true, onComplete, 'polygon'));
    const lastCall = mockLayerCalls[mockLayerCalls.length - 1];
    expect(lastCall.modeConfig).toBeUndefined();
  });

  it('renders completed polygon layers when completedPolygon is provided', () => {
    const onComplete = jest.fn();
    const completedPolygon = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ];
    const { result } = renderHook(() =>
      useLassoLayer(true, onComplete, 'freehand', completedPolygon as any),
    );
    // Should have the editable layer + 2 completed layers (fill + outline)
    expect(result.current.layers.length).toBeGreaterThanOrEqual(3);
  });
});
