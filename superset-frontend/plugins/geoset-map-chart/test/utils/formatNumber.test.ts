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
  formatLegendNumber,
  formatBoundLabel,
} from '../../src/utils/formatNumber';

// ─── formatLegendNumber ─────────────────────────────────────────────────────

describe('formatLegendNumber', () => {
  it('returns "0" for zero', () => {
    expect(formatLegendNumber(0)).toBe('0');
  });

  it('formats small numbers without suffix', () => {
    expect(formatLegendNumber(42)).toBe('42');
    expect(formatLegendNumber(999)).toBe('999');
  });

  it('formats numbers with up to one decimal', () => {
    expect(formatLegendNumber(3.7)).toBe('3.7');
    expect(formatLegendNumber(0.5)).toBe('0.5');
  });

  it('formats thousands with K suffix', () => {
    expect(formatLegendNumber(1000)).toBe('1K');
    expect(formatLegendNumber(1500)).toBe('1.5K');
    expect(formatLegendNumber(45000)).toBe('45K');
  });

  it('formats millions with M suffix', () => {
    expect(formatLegendNumber(1000000)).toBe('1M');
    expect(formatLegendNumber(2500000)).toBe('2.5M');
  });

  it('formats billions with B suffix', () => {
    expect(formatLegendNumber(1000000000)).toBe('1B');
    expect(formatLegendNumber(7500000000)).toBe('7.5B');
  });

  it('handles negative numbers', () => {
    expect(formatLegendNumber(-500)).toBe('-500');
    expect(formatLegendNumber(-2500)).toBe('-2.5K');
  });
});

// ─── formatBoundLabel ───────────────────────────────────────────────────────

describe('formatBoundLabel', () => {
  it('returns plain number when hasRange is false', () => {
    expect(formatBoundLabel(100, 'lower', false, false)).toBe('100');
    expect(formatBoundLabel(100, 'upper', false, true)).toBe('100');
  });

  it('returns plain number for lower bound without percentile', () => {
    expect(formatBoundLabel(50, 'lower', true, false)).toBe('50');
  });

  it('adds ≤ prefix for lower bound with percentile', () => {
    const result = formatBoundLabel(50, 'lower', true, true);
    expect(result).toContain('≤');
    expect(result).toContain('50');
  });

  it('adds + suffix for upper bound without percentile', () => {
    expect(formatBoundLabel(5000, 'upper', true, false)).toBe('5K+');
  });

  it('adds > prefix for upper bound with percentile', () => {
    const result = formatBoundLabel(5000, 'upper', true, true);
    expect(result).toContain('>');
    expect(result).toContain('5K');
  });
});
