/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import {
  resolveLayerAutozoom,
  normalizeDeckSlices,
  loadLayersOrchestrated,
  DeckSliceConfig,
} from '../../src/GeoSetMultiMap/multiUtils';

/** Helper: build a DeckSliceConfig with sensible defaults */
const makeConfig = (
  sliceId: number,
  overrides: Partial<DeckSliceConfig> = {},
): DeckSliceConfig => ({
  sliceId,
  autozoom: true,
  legendCollapsed: false,
  initiallyHidden: false,
  lazyLoading: false,
  ...overrides,
});

describe('resolveLayerAutozoom', () => {
  it('disables autozoom when lazyLoading is true', () => {
    expect(
      resolveLayerAutozoom({
        sliceId: 1,
        autozoom: true,
        legendCollapsed: false,
        initiallyHidden: false,
        lazyLoading: true,
      }),
    ).toBe(false);
  });

  it('disables autozoom when lazyLoading is true even if autozoom is explicitly false', () => {
    expect(
      resolveLayerAutozoom({
        sliceId: 1,
        autozoom: false,
        legendCollapsed: false,
        initiallyHidden: false,
        lazyLoading: true,
      }),
    ).toBe(false);
  });

  it('respects autozoom setting when lazyLoading is false', () => {
    expect(
      resolveLayerAutozoom({
        sliceId: 1,
        autozoom: true,
        legendCollapsed: false,
        initiallyHidden: false,
        lazyLoading: false,
      }),
    ).toBe(true);
  });

  it('respects autozoom: false when lazyLoading is false', () => {
    expect(
      resolveLayerAutozoom({
        sliceId: 1,
        autozoom: false,
        legendCollapsed: false,
        initiallyHidden: false,
        lazyLoading: false,
      }),
    ).toBe(false);
  });

  it('defaults autozoom to true when config is undefined', () => {
    expect(resolveLayerAutozoom(undefined)).toBe(true);
  });
});

describe('normalizeDeckSlices', () => {
  it('sets lazyLoading to false by default for legacy number entries', () => {
    const result = normalizeDeckSlices([1, 2]);
    result.forEach(slice => {
      expect(slice.lazyLoading).toBe(false);
    });
  });

  it('preserves lazyLoading: true from config objects', () => {
    const result = normalizeDeckSlices([
      {
        sliceId: 1,
        autozoom: true,
        legendCollapsed: false,
        initiallyHidden: false,
        lazyLoading: true,
      },
    ]);
    expect(result[0].lazyLoading).toBe(true);
  });

  it('autozoom resolves to false for a normalized lazy slice', () => {
    const result = normalizeDeckSlices([
      {
        sliceId: 1,
        autozoom: true,
        legendCollapsed: false,
        initiallyHidden: false,
        lazyLoading: true,
      },
    ]);
    expect(resolveLayerAutozoom(result[0])).toBe(false);
  });

  it('returns empty array when input is undefined', () => {
    expect(normalizeDeckSlices(undefined)).toEqual([]);
  });
});

describe('loadLayersOrchestrated', () => {
  it('loads eager layers in parallel and calls onEagerComplete', async () => {
    const loadFn = jest.fn((subslice: { slice_id: number }) =>
      Promise.resolve(`layer-${subslice.slice_id}`),
    );
    const onEagerComplete = jest.fn();
    const onLazyAppend = jest.fn();

    await loadLayersOrchestrated(
      [{ slice_id: 1 }, { slice_id: 2 }],
      [makeConfig(1), makeConfig(2)],
      { loadFn, onEagerComplete, onLazyAppend, isStale: () => false },
    );

    expect(loadFn).toHaveBeenCalledTimes(2);
    expect(onEagerComplete).toHaveBeenCalledWith(['layer-1', 'layer-2']);
    expect(onLazyAppend).not.toHaveBeenCalled();
  });

  it('loads lazy layers sequentially after eager layers', async () => {
    const callOrder: string[] = [];
    const loadFn = jest.fn((subslice: { slice_id: number }) => {
      callOrder.push(`load-${subslice.slice_id}`);
      return Promise.resolve(`layer-${subslice.slice_id}`);
    });
    const onEagerComplete = jest.fn(() => callOrder.push('eager-complete'));
    const onLazyAppend = jest.fn((layer: string) =>
      callOrder.push(`lazy-${layer}`),
    );

    await loadLayersOrchestrated(
      [{ slice_id: 1 }, { slice_id: 2 }, { slice_id: 3 }],
      [
        makeConfig(1),
        makeConfig(2, { lazyLoading: true }),
        makeConfig(3, { lazyLoading: true }),
      ],
      { loadFn, onEagerComplete, onLazyAppend, isStale: () => false },
    );

    // Eager layer loaded first, then lazy layers one-by-one
    expect(onEagerComplete).toHaveBeenCalledWith(['layer-1']);
    expect(onLazyAppend).toHaveBeenCalledTimes(2);
    expect(onLazyAppend).toHaveBeenNthCalledWith(1, 'layer-2');
    expect(onLazyAppend).toHaveBeenNthCalledWith(2, 'layer-3');

    // Verify ordering: eager completes before lazy loads start
    const eagerIdx = callOrder.indexOf('eager-complete');
    const firstLazyLoadIdx = callOrder.indexOf('load-2');
    expect(eagerIdx).toBeLessThan(firstLazyLoadIdx);
  });

  it('handles all-lazy slices (no eager phase)', async () => {
    const loadFn = jest.fn((subslice: { slice_id: number }) =>
      Promise.resolve(`layer-${subslice.slice_id}`),
    );
    const onEagerComplete = jest.fn();
    const onLazyAppend = jest.fn();

    await loadLayersOrchestrated(
      [{ slice_id: 1 }, { slice_id: 2 }],
      [
        makeConfig(1, { lazyLoading: true }),
        makeConfig(2, { lazyLoading: true }),
      ],
      { loadFn, onEagerComplete, onLazyAppend, isStale: () => false },
    );

    // onEagerComplete still called with empty array
    expect(onEagerComplete).toHaveBeenCalledWith([]);
    expect(onLazyAppend).toHaveBeenCalledTimes(2);
    expect(onLazyAppend).toHaveBeenNthCalledWith(1, 'layer-1');
    expect(onLazyAppend).toHaveBeenNthCalledWith(2, 'layer-2');
  });

  it('aborts when isStale returns true before eager phase completes', async () => {
    let stale = false;
    const loadFn = jest.fn(() => {
      // Simulate staleness occurring while eager layers load
      stale = true;
      return Promise.resolve('layer');
    });
    const onEagerComplete = jest.fn();
    const onLazyAppend = jest.fn();

    await loadLayersOrchestrated(
      [{ slice_id: 1 }],
      [makeConfig(1)],
      { loadFn, onEagerComplete, onLazyAppend, isStale: () => stale },
    );

    expect(loadFn).toHaveBeenCalledTimes(1);
    expect(onEagerComplete).not.toHaveBeenCalled();
  });

  it('aborts lazy chain mid-way when isStale becomes true', async () => {
    let stale = false;
    const loadFn = jest.fn((subslice: { slice_id: number }) =>
      Promise.resolve(`layer-${subslice.slice_id}`),
    );
    const onEagerComplete = jest.fn();
    const onLazyAppend = jest.fn(() => {
      // Mark stale after the first lazy layer appends
      stale = true;
    });

    await loadLayersOrchestrated(
      [{ slice_id: 1 }, { slice_id: 2 }, { slice_id: 3 }],
      [
        makeConfig(1),
        makeConfig(2, { lazyLoading: true }),
        makeConfig(3, { lazyLoading: true }),
      ],
      { loadFn, onEagerComplete, onLazyAppend, isStale: () => stale },
    );

    expect(onEagerComplete).toHaveBeenCalledWith(['layer-1']);
    // Only the first lazy layer should append; the second is skipped
    expect(onLazyAppend).toHaveBeenCalledTimes(1);
    expect(onLazyAppend).toHaveBeenCalledWith('layer-2');
  });

  it('skips null results from loadFn without aborting', async () => {
    const loadFn = jest.fn((subslice: { slice_id: number }) =>
      subslice.slice_id === 2
        ? Promise.resolve(null)
        : Promise.resolve(`layer-${subslice.slice_id}`),
    );
    const onEagerComplete = jest.fn();
    const onLazyAppend = jest.fn();

    await loadLayersOrchestrated(
      [{ slice_id: 1 }, { slice_id: 2 }, { slice_id: 3 }],
      [
        makeConfig(1),
        makeConfig(2, { lazyLoading: true }),
        makeConfig(3, { lazyLoading: true }),
      ],
      { loadFn, onEagerComplete, onLazyAppend, isStale: () => false },
    );

    expect(onEagerComplete).toHaveBeenCalledWith(['layer-1']);
    // Slice 2 returned null — skipped, but slice 3 still loads
    expect(onLazyAppend).toHaveBeenCalledTimes(1);
    expect(onLazyAppend).toHaveBeenCalledWith('layer-3');
  });

  it('filters null results from eager batch', async () => {
    const loadFn = jest.fn((subslice: { slice_id: number }) =>
      subslice.slice_id === 1
        ? Promise.resolve(null)
        : Promise.resolve(`layer-${subslice.slice_id}`),
    );
    const onEagerComplete = jest.fn();

    await loadLayersOrchestrated(
      [{ slice_id: 1 }, { slice_id: 2 }],
      [makeConfig(1), makeConfig(2)],
      {
        loadFn,
        onEagerComplete,
        onLazyAppend: jest.fn(),
        isStale: () => false,
      },
    );

    // Null result for slice 1 is filtered out
    expect(onEagerComplete).toHaveBeenCalledWith(['layer-2']);
  });

  it('resolves immediately for empty slices array', async () => {
    const loadFn = jest.fn();
    const onEagerComplete = jest.fn();

    await loadLayersOrchestrated([], [], {
      loadFn,
      onEagerComplete,
      onLazyAppend: jest.fn(),
      isStale: () => false,
    });

    expect(loadFn).not.toHaveBeenCalled();
    expect(onEagerComplete).not.toHaveBeenCalled();
  });
});
