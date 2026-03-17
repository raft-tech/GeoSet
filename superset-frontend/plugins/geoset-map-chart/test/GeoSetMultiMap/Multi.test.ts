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
} from '../../src/GeoSetMultiMap/multiUtils';

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

  it('disables autozoom when lazyLoading is true even if autozoom is explicitly true', () => {
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
