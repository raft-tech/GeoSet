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
  /** Called once with all eager layers after they finish loading in parallel. */
  onEagerComplete: (layers: TLayer[]) => void;
  /** Called for each lazy layer as it finishes loading sequentially. */
  onLazyAppend: (layer: TLayer) => void;
  /** Return true to abort — checked before each phase and between lazy loads. */
  isStale: () => boolean;
}

/**
 * Orchestrates two-phase layer loading:
 *   Phase 1 — load all eager (non-lazy) layers in parallel.
 *   Phase 2 — load lazy layers one-by-one, calling onLazyAppend after each.
 *
 * Returns a promise that resolves when the full chain (eager + lazy) finishes
 * or is aborted due to staleness.
 */
export function loadLayersOrchestrated<TLayer>(
  slices: { slice_id: number }[],
  deckSlicesConfig: DeckSliceConfig[],
  callbacks: OrchestrationCallbacks<TLayer>,
): Promise<void> {
  if (!slices || slices.length === 0) return Promise.resolve();

  const configById = new Map(deckSlicesConfig.map(c => [c.sliceId, c]));

  const eagerSlices: { slice_id: number }[] = [];
  const lazySlices: { slice_id: number }[] = [];

  slices.forEach(subslice => {
    const config = configById.get(subslice.slice_id);
    if (config?.lazyLoading) {
      lazySlices.push(subslice);
    } else {
      eagerSlices.push(subslice);
    }
  });

  // Phase 1: Load all eager layers in parallel
  const eagerPromise =
    eagerSlices.length > 0
      ? Promise.all(
          eagerSlices.map(subslice =>
            callbacks.loadFn(subslice, configById.get(subslice.slice_id)),
          ),
        ).then(results => results.filter((e): e is TLayer => e !== null))
      : Promise.resolve([] as TLayer[]);

  return eagerPromise.then(eagerLayers => {
    if (callbacks.isStale()) return;

    callbacks.onEagerComplete(eagerLayers);

    if (lazySlices.length === 0) return;

    // Phase 2: Load lazy layers sequentially, appending each as it completes
    return lazySlices
      .reduce(
        (chain, subslice) =>
          chain.then(() => {
            if (callbacks.isStale()) return Promise.resolve();

            return callbacks
              .loadFn(subslice, configById.get(subslice.slice_id))
              .then(layerEntry => {
                if (layerEntry && !callbacks.isStale()) {
                  callbacks.onLazyAppend(layerEntry);
                }
              });
          }),
        Promise.resolve(),
      )
      .then(() => {});
  });
}
