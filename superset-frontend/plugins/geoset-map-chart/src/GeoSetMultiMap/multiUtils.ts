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

export interface DeckSliceConfig {
  sliceId: number;
  autozoom: boolean;
  legendCollapsed: boolean;
  initiallyHidden: boolean;
  lazyLoading: boolean;
}

/** Resolve effective autozoom for a slice: disabled when lazy loading is on */
export const resolveLayerAutozoom = (
  config: DeckSliceConfig | undefined,
): boolean => (config?.lazyLoading ? false : (config?.autozoom ?? true));

/** Normalize deck slices — converts legacy number[] format to DeckSliceConfig[] */
export const normalizeDeckSlices = (
  deckSlices: (DeckSliceConfig | number)[] | undefined,
): DeckSliceConfig[] =>
  deckSlices?.map(item =>
    typeof item === 'number'
      ? {
          sliceId: item,
          autozoom: true,
          legendCollapsed: false,
          initiallyHidden: false,
          lazyLoading: false,
        }
      : {
          sliceId: item.sliceId,
          autozoom: item.autozoom ?? true,
          legendCollapsed: item.legendCollapsed ?? false,
          initiallyHidden: item.initiallyHidden ?? false,
          lazyLoading: item.lazyLoading ?? false,
        },
  ) ?? [];

/** Callbacks for {@link loadLayersOrchestrated}. */
export interface OrchestrationCallbacks<TLayer> {
  /** Load a single slice, returning null on failure. */
  loadFn: (
    subslice: { slice_id: number },
    config: DeckSliceConfig | undefined,
  ) => Promise<TLayer | null>;
  /** Called once with autozoom layers after they finish loading (phase 1). */
  onAutozoomComplete: (layers: TLayer[]) => void;
  /** Called for each non-autozoom eager layer as it finishes (phase 2). */
  onEagerAppend: (layer: TLayer) => void;
  /** Called for each lazy layer as it finishes loading sequentially (phase 3). */
  onLazyAppend: (layer: TLayer) => void;
  /** Return true to abort — checked before each phase and between lazy loads. */
  isStale: () => boolean;
}

/** Number of lazy layers to load concurrently in each batch. */
const LAZY_BATCH_SIZE = 2;

/**
 * Orchestrates three-phase layer loading:
 *   Phase 1 — load autozoom layers in parallel (map canvas gates on this).
 *   Phase 2 — load remaining eager layers in parallel, appending each as it finishes.
 *   Phase 3 — load lazy layers in small batches, appending each as it finishes.
 *
 * Returns a promise that resolves when the full chain finishes
 * or is aborted due to staleness.
 */
export function loadLayersOrchestrated<TLayer>(
  slices: { slice_id: number }[],
  deckSlicesConfig: DeckSliceConfig[],
  callbacks: OrchestrationCallbacks<TLayer>,
): Promise<void> {
  if (!slices || slices.length === 0) return Promise.resolve();

  const configById = new Map(deckSlicesConfig.map(c => [c.sliceId, c]));

  const autozoomSlices: { slice_id: number }[] = [];
  const eagerSlices: { slice_id: number }[] = [];
  const lazySlices: { slice_id: number }[] = [];

  slices.forEach(subslice => {
    const config = configById.get(subslice.slice_id);
    if (config?.lazyLoading) {
      lazySlices.push(subslice);
    } else if (resolveLayerAutozoom(config)) {
      autozoomSlices.push(subslice);
    } else {
      eagerSlices.push(subslice);
    }
  });

  // Async wrapper ensures synchronous throws from loadFn become rejected promises
  const safeLoadFn = async (
    subslice: { slice_id: number },
    config: DeckSliceConfig | undefined,
  ): Promise<TLayer | null> => callbacks.loadFn(subslice, config);

  // Phase 1: Load autozoom layers in parallel
  const autozoomPromise =
    autozoomSlices.length > 0
      ? Promise.all(
          autozoomSlices.map(subslice =>
            safeLoadFn(subslice, configById.get(subslice.slice_id)),
          ),
        ).then(results => results.filter(e => e !== null) as TLayer[])
      : Promise.resolve([] as TLayer[]);

  return autozoomPromise.then(autozoomLayers => {
    if (callbacks.isStale()) return undefined;

    callbacks.onAutozoomComplete(autozoomLayers);

    // Phase 2 + 3 run sequentially after autozoom completes
    // eslint-disable-next-line consistent-return
    return (async () => {
      // Phase 2: Load remaining eager layers in parallel, append each as it finishes
      if (eagerSlices.length > 0) {
        const eagerResults = await Promise.all(
          eagerSlices.map(subslice =>
            safeLoadFn(subslice, configById.get(subslice.slice_id)),
          ),
        );

        for (const layerEntry of eagerResults) {
          if (layerEntry && !callbacks.isStale()) {
            callbacks.onEagerAppend(layerEntry);
          }
        }
      }

      // Phase 3: Load lazy layers in batches of LAZY_BATCH_SIZE
      for (let i = 0; i < lazySlices.length; i += LAZY_BATCH_SIZE) {
        if (callbacks.isStale()) return;

        const batch = lazySlices.slice(i, i + LAZY_BATCH_SIZE);
        // eslint-disable-next-line no-await-in-loop
        const results = await Promise.all(
          batch.map(subslice =>
            safeLoadFn(subslice, configById.get(subslice.slice_id)),
          ),
        );

        for (const layerEntry of results) {
          if (layerEntry && !callbacks.isStale()) {
            callbacks.onLazyAppend(layerEntry);
          }
        }
      }
    })();
  });
}
