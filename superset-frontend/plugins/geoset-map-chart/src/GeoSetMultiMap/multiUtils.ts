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
