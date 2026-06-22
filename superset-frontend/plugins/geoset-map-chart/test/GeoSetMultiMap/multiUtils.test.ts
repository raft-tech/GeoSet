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
  lassoSelectable: true,
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
        lassoSelectable: true,
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
        lassoSelectable: true,
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
        lassoSelectable: true,
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
        lassoSelectable: true,
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
        lassoSelectable: true,
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
        lassoSelectable: true,
      },
    ]);
    expect(resolveLayerAutozoom(result[0])).toBe(false);
  });

  it('returns empty array when input is undefined', () => {
    expect(normalizeDeckSlices(undefined)).toEqual([]);
  });

  it('sets lassoSelectable to true by default for legacy number entries', () => {
    const result = normalizeDeckSlices([1, 2]);
    result.forEach(slice => {
      expect(slice.lassoSelectable).toBe(true);
    });
  });

  it('preserves lassoSelectable: false from config objects', () => {
    const result = normalizeDeckSlices([
      makeConfig(1, { lassoSelectable: false }),
    ]);
    expect(result[0].lassoSelectable).toBe(false);
  });

  it('defaults lassoSelectable to true when field is missing from config object', () => {
    const configWithoutLasso = {
      sliceId: 1,
      autozoom: true,
      legendCollapsed: false,
      initiallyHidden: false,
      lazyLoading: false,
    } as any;
    const result = normalizeDeckSlices([configWithoutLasso]);
    expect(result[0].lassoSelectable).toBe(true);
  });
});

describe('loadLayersOrchestrated', () => {
  // ── Phase 1: Autozoom layers ──────────────────────────────────────

  it('loads autozoom layers in parallel and calls onAutozoomComplete', async () => {
    const loadFn = jest.fn((subslice: { slice_id: number }) =>
      Promise.resolve(`layer-${subslice.slice_id}`),
    );
    const onAutozoomComplete = jest.fn();
    const onEagerAppend = jest.fn();
    const onLazyAppend = jest.fn();

    await loadLayersOrchestrated(
      [{ slice_id: 1 }, { slice_id: 2 }],
      [makeConfig(1), makeConfig(2)],
      {
        loadFn,
        onAutozoomComplete,
        onEagerAppend,
        onLazyAppend,
        isStale: () => false,
      },
    );

    expect(loadFn).toHaveBeenCalledTimes(2);
    expect(onAutozoomComplete).toHaveBeenCalledWith(['layer-1', 'layer-2']);
    expect(onEagerAppend).not.toHaveBeenCalled();
    expect(onLazyAppend).not.toHaveBeenCalled();
  });

  it('filters null results from autozoom batch', async () => {
    const loadFn = jest.fn((subslice: { slice_id: number }) =>
      subslice.slice_id === 1
        ? Promise.resolve(null)
        : Promise.resolve(`layer-${subslice.slice_id}`),
    );
    const onAutozoomComplete = jest.fn();

    await loadLayersOrchestrated(
      [{ slice_id: 1 }, { slice_id: 2 }],
      [makeConfig(1), makeConfig(2)],
      {
        loadFn,
        onAutozoomComplete,
        onEagerAppend: jest.fn(),
        onLazyAppend: jest.fn(),
        isStale: () => false,
      },
    );

    expect(onAutozoomComplete).toHaveBeenCalledWith(['layer-2']);
  });

  it('calls onAutozoomComplete with empty array when no autozoom layers exist', async () => {
    const onAutozoomComplete = jest.fn();
    const onEagerAppend = jest.fn();
    const onLazyAppend = jest.fn();

    await loadLayersOrchestrated(
      [{ slice_id: 1 }, { slice_id: 2 }],
      [
        makeConfig(1, { autozoom: false }),
        makeConfig(2, { lazyLoading: true }),
      ],
      {
        loadFn: (subslice: { slice_id: number }) =>
          Promise.resolve(`layer-${subslice.slice_id}`),
        onAutozoomComplete,
        onEagerAppend,
        onLazyAppend,
        isStale: () => false,
      },
    );

    expect(onAutozoomComplete).toHaveBeenCalledWith([]);
    expect(onEagerAppend).toHaveBeenCalledWith('layer-1');
    expect(onLazyAppend).toHaveBeenCalledWith('layer-2');
  });

  // ── Phase 2: Eager (non-autozoom) layers ──────────────────────────

  it('loads eager non-autozoom layers in phase 2 after autozoom completes', async () => {
    const callOrder: string[] = [];
    const loadFn = jest.fn((subslice: { slice_id: number }) => {
      callOrder.push(`load-${subslice.slice_id}`);
      return Promise.resolve(`layer-${subslice.slice_id}`);
    });
    const onAutozoomComplete = jest.fn(() =>
      callOrder.push('autozoom-complete'),
    );
    const onEagerAppend = jest.fn((layer: string) =>
      callOrder.push(`eager-${layer}`),
    );

    await loadLayersOrchestrated(
      [{ slice_id: 1 }, { slice_id: 2 }, { slice_id: 3 }],
      [
        makeConfig(1, { autozoom: true }),
        makeConfig(2, { autozoom: false }),
        makeConfig(3, { autozoom: false }),
      ],
      {
        loadFn,
        onAutozoomComplete,
        onEagerAppend,
        onLazyAppend: jest.fn(),
        isStale: () => false,
      },
    );

    expect(onAutozoomComplete).toHaveBeenCalledWith(['layer-1']);
    expect(onEagerAppend).toHaveBeenCalledTimes(2);

    // Verify ordering: autozoom completes before eager loads start
    const autozoomIdx = callOrder.indexOf('autozoom-complete');
    const firstEagerLoadIdx = callOrder.indexOf('load-2');
    expect(autozoomIdx).toBeLessThan(firstEagerLoadIdx);
  });

  it('skips null results from eager phase without aborting', async () => {
    const loadFn = jest.fn((subslice: { slice_id: number }) =>
      subslice.slice_id === 2
        ? Promise.resolve(null)
        : Promise.resolve(`layer-${subslice.slice_id}`),
    );
    const onEagerAppend = jest.fn();

    await loadLayersOrchestrated(
      [{ slice_id: 1 }, { slice_id: 2 }, { slice_id: 3 }],
      [
        makeConfig(1, { autozoom: true }),
        makeConfig(2, { autozoom: false }),
        makeConfig(3, { autozoom: false }),
      ],
      {
        loadFn,
        onAutozoomComplete: jest.fn(),
        onEagerAppend,
        onLazyAppend: jest.fn(),
        isStale: () => false,
      },
    );

    // Slice 2 returned null — skipped, but slice 3 still appends
    expect(onEagerAppend).toHaveBeenCalledTimes(1);
    expect(onEagerAppend).toHaveBeenCalledWith('layer-3');
  });

  // ── Phase 3: Lazy layers ──────────────────────────────────────────

  it('loads lazy layers in batches after eager layers', async () => {
    const callOrder: string[] = [];
    const loadFn = jest.fn((subslice: { slice_id: number }) => {
      callOrder.push(`load-${subslice.slice_id}`);
      return Promise.resolve(`layer-${subslice.slice_id}`);
    });
    const onAutozoomComplete = jest.fn(() =>
      callOrder.push('autozoom-complete'),
    );
    const onEagerAppend = jest.fn((layer: string) =>
      callOrder.push(`eager-${layer}`),
    );
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
      {
        loadFn,
        onAutozoomComplete,
        onEagerAppend,
        onLazyAppend,
        isStale: () => false,
      },
    );

    expect(onAutozoomComplete).toHaveBeenCalledWith(['layer-1']);
    expect(onLazyAppend).toHaveBeenCalledTimes(2);
    expect(onLazyAppend).toHaveBeenNthCalledWith(1, 'layer-2');
    expect(onLazyAppend).toHaveBeenNthCalledWith(2, 'layer-3');

    // Verify ordering: autozoom completes before lazy loads start
    const autozoomIdx = callOrder.indexOf('autozoom-complete');
    const firstLazyLoadIdx = callOrder.indexOf('load-2');
    expect(autozoomIdx).toBeLessThan(firstLazyLoadIdx);
  });

  it('respects batch size — batches do not overlap', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const loadFn = jest.fn(
      (subslice: { slice_id: number }) =>
        new Promise<string>(resolve => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          // Resolve async to let all concurrent calls register
          setTimeout(() => {
            inFlight -= 1;
            resolve(`layer-${subslice.slice_id}`);
          }, 0);
        }),
    );
    const onLazyAppend = jest.fn();

    await loadLayersOrchestrated(
      [
        { slice_id: 1 },
        { slice_id: 2 },
        { slice_id: 3 },
        { slice_id: 4 },
        { slice_id: 5 },
      ],
      [
        makeConfig(1, { lazyLoading: true }),
        makeConfig(2, { lazyLoading: true }),
        makeConfig(3, { lazyLoading: true }),
        makeConfig(4, { lazyLoading: true }),
        makeConfig(5, { lazyLoading: true }),
      ],
      {
        loadFn,
        onAutozoomComplete: jest.fn(),
        onEagerAppend: jest.fn(),
        onLazyAppend,
        isStale: () => false,
      },
    );

    // Batch size is 2, so max concurrent lazy loads should be 2
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(onLazyAppend).toHaveBeenCalledTimes(5);
  });

  it('handles all-lazy slices (no autozoom or eager phase)', async () => {
    const loadFn = jest.fn((subslice: { slice_id: number }) =>
      Promise.resolve(`layer-${subslice.slice_id}`),
    );
    const onAutozoomComplete = jest.fn();
    const onEagerAppend = jest.fn();
    const onLazyAppend = jest.fn();

    await loadLayersOrchestrated(
      [{ slice_id: 1 }, { slice_id: 2 }],
      [
        makeConfig(1, { lazyLoading: true }),
        makeConfig(2, { lazyLoading: true }),
      ],
      {
        loadFn,
        onAutozoomComplete,
        onEagerAppend,
        onLazyAppend,
        isStale: () => false,
      },
    );

    // onAutozoomComplete still called with empty array
    expect(onAutozoomComplete).toHaveBeenCalledWith([]);
    expect(onEagerAppend).not.toHaveBeenCalled();
    expect(onLazyAppend).toHaveBeenCalledTimes(2);
    expect(onLazyAppend).toHaveBeenNthCalledWith(1, 'layer-1');
    expect(onLazyAppend).toHaveBeenNthCalledWith(2, 'layer-2');
  });

  // ── Three-phase ordering ──────────────────────────────────────────

  it('runs all three phases in order: autozoom → eager → lazy', async () => {
    const callOrder: string[] = [];
    const loadFn = jest.fn((subslice: { slice_id: number }) => {
      callOrder.push(`load-${subslice.slice_id}`);
      return Promise.resolve(`layer-${subslice.slice_id}`);
    });

    await loadLayersOrchestrated(
      [{ slice_id: 1 }, { slice_id: 2 }, { slice_id: 3 }],
      [
        makeConfig(1, { autozoom: true }), // phase 1: autozoom
        makeConfig(2, { autozoom: false }), // phase 2: eager non-autozoom
        makeConfig(3, { lazyLoading: true }), // phase 3: lazy
      ],
      {
        loadFn,
        onAutozoomComplete: () => callOrder.push('autozoom-complete'),
        onEagerAppend: (layer: string) => callOrder.push(`eager-${layer}`),
        onLazyAppend: (layer: string) => callOrder.push(`lazy-${layer}`),
        isStale: () => false,
      },
    );

    // Verify strict phase ordering
    const autozoomCompleteIdx = callOrder.indexOf('autozoom-complete');
    const eagerLoadIdx = callOrder.indexOf('load-2');
    const eagerAppendIdx = callOrder.indexOf('eager-layer-2');
    const lazyLoadIdx = callOrder.indexOf('load-3');

    expect(autozoomCompleteIdx).toBeLessThan(eagerLoadIdx);
    expect(eagerAppendIdx).toBeLessThan(lazyLoadIdx);
  });

  it('handles all-eager-no-autozoom slices', async () => {
    const onAutozoomComplete = jest.fn();
    const onEagerAppend = jest.fn();
    const onLazyAppend = jest.fn();

    await loadLayersOrchestrated(
      [{ slice_id: 1 }, { slice_id: 2 }],
      [
        makeConfig(1, { autozoom: false }),
        makeConfig(2, { autozoom: false }),
      ],
      {
        loadFn: (subslice: { slice_id: number }) =>
          Promise.resolve(`layer-${subslice.slice_id}`),
        onAutozoomComplete,
        onEagerAppend,
        onLazyAppend,
        isStale: () => false,
      },
    );

    expect(onAutozoomComplete).toHaveBeenCalledWith([]);
    expect(onEagerAppend).toHaveBeenCalledTimes(2);
    expect(onLazyAppend).not.toHaveBeenCalled();
  });

  // ── Staleness ─────────────────────────────────────────────────────

  it('aborts when isStale returns true before autozoom phase completes', async () => {
    let stale = false;
    const loadFn = jest.fn(() => {
      stale = true;
      return Promise.resolve('layer');
    });
    const onAutozoomComplete = jest.fn();
    const onEagerAppend = jest.fn();

    await loadLayersOrchestrated([{ slice_id: 1 }], [makeConfig(1)], {
      loadFn,
      onAutozoomComplete,
      onEagerAppend,
      onLazyAppend: jest.fn(),
      isStale: () => stale,
    });

    expect(loadFn).toHaveBeenCalledTimes(1);
    expect(onAutozoomComplete).not.toHaveBeenCalled();
  });

  it('aborts lazy chain mid-way when isStale becomes true across batch boundaries', async () => {
    let stale = false;
    let lazyAppendCount = 0;
    const loadFn = jest.fn((subslice: { slice_id: number }) =>
      Promise.resolve(`layer-${subslice.slice_id}`),
    );
    const onAutozoomComplete = jest.fn();
    const onLazyAppend = jest.fn(() => {
      lazyAppendCount += 1;
      // Mark stale after the second lazy layer appends (end of first batch)
      if (lazyAppendCount === 2) {
        stale = true;
      }
    });

    // 1 autozoom + 4 lazy = 2 lazy batches of size 2
    await loadLayersOrchestrated(
      [
        { slice_id: 1 },
        { slice_id: 2 },
        { slice_id: 3 },
        { slice_id: 4 },
        { slice_id: 5 },
      ],
      [
        makeConfig(1),
        makeConfig(2, { lazyLoading: true }),
        makeConfig(3, { lazyLoading: true }),
        makeConfig(4, { lazyLoading: true }),
        makeConfig(5, { lazyLoading: true }),
      ],
      {
        loadFn,
        onAutozoomComplete,
        onEagerAppend: jest.fn(),
        onLazyAppend,
        isStale: () => stale,
      },
    );

    expect(onAutozoomComplete).toHaveBeenCalledWith(['layer-1']);
    // First batch (slices 2 & 3) completes, then staleness aborts before second batch
    expect(onLazyAppend).toHaveBeenCalledTimes(2);
    expect(onLazyAppend).toHaveBeenNthCalledWith(1, 'layer-2');
    expect(onLazyAppend).toHaveBeenNthCalledWith(2, 'layer-3');
  });

  // ── Null handling ─────────────────────────────────────────────────

  it('skips null results from lazy loadFn without aborting', async () => {
    const loadFn = jest.fn((subslice: { slice_id: number }) =>
      subslice.slice_id === 2
        ? Promise.resolve(null)
        : Promise.resolve(`layer-${subslice.slice_id}`),
    );
    const onAutozoomComplete = jest.fn();
    const onLazyAppend = jest.fn();

    await loadLayersOrchestrated(
      [{ slice_id: 1 }, { slice_id: 2 }, { slice_id: 3 }],
      [
        makeConfig(1),
        makeConfig(2, { lazyLoading: true }),
        makeConfig(3, { lazyLoading: true }),
      ],
      {
        loadFn,
        onAutozoomComplete,
        onEagerAppend: jest.fn(),
        onLazyAppend,
        isStale: () => false,
      },
    );

    expect(onAutozoomComplete).toHaveBeenCalledWith(['layer-1']);
    // Slice 2 returned null — skipped, but slice 3 still loads
    expect(onLazyAppend).toHaveBeenCalledTimes(1);
    expect(onLazyAppend).toHaveBeenCalledWith('layer-3');
  });

  // ── Edge cases ────────────────────────────────────────────────────

  it('resolves immediately for empty slices array', async () => {
    const loadFn = jest.fn();
    const onAutozoomComplete = jest.fn();

    await loadLayersOrchestrated([], [], {
      loadFn,
      onAutozoomComplete,
      onEagerAppend: jest.fn(),
      onLazyAppend: jest.fn(),
      isStale: () => false,
    });

    expect(loadFn).not.toHaveBeenCalled();
    expect(onAutozoomComplete).not.toHaveBeenCalled();
  });

  // ── Error propagation ─────────────────────────────────────────────

  it('rejects when an autozoom loadFn returns a rejected promise', async () => {
    const loadFn = jest.fn(() => Promise.reject(new Error('network failure')));
    const onAutozoomComplete = jest.fn();

    await expect(
      loadLayersOrchestrated([{ slice_id: 1 }], [makeConfig(1)], {
        loadFn,
        onAutozoomComplete,
        onEagerAppend: jest.fn(),
        onLazyAppend: jest.fn(),
        isStale: () => false,
      }),
    ).rejects.toThrow('network failure');

    expect(onAutozoomComplete).not.toHaveBeenCalled();
  });

  it('rejects when an eager loadFn returns a rejected promise', async () => {
    const loadFn = jest.fn((subslice: { slice_id: number }) =>
      subslice.slice_id === 2
        ? Promise.reject(new Error('eager failure'))
        : Promise.resolve(`layer-${subslice.slice_id}`),
    );
    const onAutozoomComplete = jest.fn();
    const onEagerAppend = jest.fn();

    await expect(
      loadLayersOrchestrated(
        [{ slice_id: 1 }, { slice_id: 2 }],
        [makeConfig(1), makeConfig(2, { autozoom: false })],
        {
          loadFn,
          onAutozoomComplete,
          onEagerAppend,
          onLazyAppend: jest.fn(),
          isStale: () => false,
        },
      ),
    ).rejects.toThrow('eager failure');

    expect(onAutozoomComplete).toHaveBeenCalledWith(['layer-1']);
    expect(onEagerAppend).not.toHaveBeenCalled();
  });

  it('rejects when a lazy loadFn returns a rejected promise', async () => {
    const loadFn = jest.fn((subslice: { slice_id: number }) =>
      subslice.slice_id === 2
        ? Promise.reject(new Error('lazy failure'))
        : Promise.resolve(`layer-${subslice.slice_id}`),
    );
    const onAutozoomComplete = jest.fn();
    const onLazyAppend = jest.fn();

    await expect(
      loadLayersOrchestrated(
        [{ slice_id: 1 }, { slice_id: 2 }],
        [makeConfig(1), makeConfig(2, { lazyLoading: true })],
        {
          loadFn,
          onAutozoomComplete,
          onEagerAppend: jest.fn(),
          onLazyAppend,
          isStale: () => false,
        },
      ),
    ).rejects.toThrow('lazy failure');

    expect(onAutozoomComplete).toHaveBeenCalledWith(['layer-1']);
    expect(onLazyAppend).not.toHaveBeenCalled();
  });

  it('rejects when loadFn throws synchronously', async () => {
    const loadFn = jest.fn(() => {
      throw new Error('sync throw');
    });
    const onAutozoomComplete = jest.fn();

    await expect(
      loadLayersOrchestrated([{ slice_id: 1 }], [makeConfig(1)], {
        loadFn,
        onAutozoomComplete,
        onEagerAppend: jest.fn(),
        onLazyAppend: jest.fn(),
        isStale: () => false,
      }),
    ).rejects.toThrow('sync throw');

    expect(onAutozoomComplete).not.toHaveBeenCalled();
  });
});
