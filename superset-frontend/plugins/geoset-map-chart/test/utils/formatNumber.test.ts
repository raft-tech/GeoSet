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
import { formatLegendNumber } from '../../src/utils/formatNumber';

describe('formatLegendNumber', () => {
  it('returns "0" for zero', () => {
    expect(formatLegendNumber(0)).toBe('0');
  });

  it('formats small numbers without suffix', () => {
    expect(formatLegendNumber(42)).toBe('42');
    expect(formatLegendNumber(999)).toBe('999');
    expect(formatLegendNumber(0.5)).toBe('0.5');
  });

  it('formats thousands with K suffix', () => {
    expect(formatLegendNumber(1000)).toBe('1K');
    expect(formatLegendNumber(1500)).toBe('1.5K');
    expect(formatLegendNumber(999999)).toBe('1000K');
  });

  it('formats millions with M suffix', () => {
    expect(formatLegendNumber(1_000_000)).toBe('1M');
    expect(formatLegendNumber(2_500_000)).toBe('2.5M');
  });

  it('formats billions with B suffix', () => {
    expect(formatLegendNumber(1_000_000_000)).toBe('1B');
    expect(formatLegendNumber(7_500_000_000)).toBe('7.5B');
  });

  it('handles negative numbers', () => {
    expect(formatLegendNumber(-42)).toBe('-42');
    expect(formatLegendNumber(-1500)).toBe('-1.5K');
    expect(formatLegendNumber(-2_500_000)).toBe('-2.5M');
    expect(formatLegendNumber(-1_000_000_000)).toBe('-1B');
  });

  it('removes trailing zeros from decimals', () => {
    expect(formatLegendNumber(1000)).toBe('1K');
    // 1000 / 1000 = 1.0 → trimmed to "1"
    expect(formatLegendNumber(1_000_000)).toBe('1M');
  });
});
