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
  hasValidFill,
  normalizeRGBA,
  normalizeColorToHex,
  rgbaArrayToCssString,
  rgbaObjectToArray,
} from '../../src/utils/colorsFallback';
import { DEFAULT_SUPERSET_COLOR, RGBAColor } from '../../src/utils/colors';

// ---------------------------------------------------------------------------
// hasValidFill
// ---------------------------------------------------------------------------
describe('hasValidFill', () => {
  it('returns true for a 3-element array', () => {
    expect(hasValidFill([255, 0, 0] as unknown as RGBAColor)).toBe(true);
  });

  it('returns true for a 4-element array', () => {
    expect(hasValidFill([255, 0, 0, 128] as RGBAColor)).toBe(true);
  });

  it('returns false for an empty array', () => {
    expect(hasValidFill([] as any)).toBe(false);
  });

  it('returns false for a 2-element array', () => {
    expect(hasValidFill([255, 0] as any)).toBe(false);
  });

  it('returns false for non-array inputs', () => {
    expect(hasValidFill(null as any)).toBe(false);
    expect(hasValidFill(undefined as any)).toBe(false);
    expect(hasValidFill('red' as any)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizeRGBA
// ---------------------------------------------------------------------------
describe('normalizeRGBA', () => {
  it('returns fallback for non-array input', () => {
    expect(normalizeRGBA(undefined)).toEqual([...DEFAULT_SUPERSET_COLOR]);
    expect(normalizeRGBA(null as any)).toEqual([...DEFAULT_SUPERSET_COLOR]);
  });

  it('fills missing channels with fallback values', () => {
    const sparse = [100, undefined, 200, undefined] as any;
    const fb: RGBAColor = [10, 20, 30, 40];
    expect(normalizeRGBA(sparse, fb)).toEqual([100, 20, 200, 40]);
  });

  it('returns a complete RGBA array for a valid input', () => {
    expect(normalizeRGBA([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });

  it('uses custom fallback', () => {
    const fb: RGBAColor = [99, 88, 77, 66];
    expect(normalizeRGBA(undefined, fb)).toEqual([99, 88, 77, 66]);
  });
});

// ---------------------------------------------------------------------------
// normalizeColorToHex
// ---------------------------------------------------------------------------
describe('normalizeColorToHex', () => {
  it('passes through a string color', () => {
    expect(normalizeColorToHex('#ff0000')).toBe('#ff0000');
    expect(normalizeColorToHex('rgb(0,0,0)')).toBe('rgb(0,0,0)');
  });

  it('converts an array to hex', () => {
    expect(normalizeColorToHex([255, 0, 0])).toBe('#ff0000');
    expect(normalizeColorToHex([0, 255, 0])).toBe('#00ff00');
    expect(normalizeColorToHex([0, 0, 255])).toBe('#0000ff');
  });

  it('converts an object {r,g,b} to hex', () => {
    expect(normalizeColorToHex({ r: 255, g: 128, b: 0 })).toBe('#ff8000');
  });

  it('returns defaultColor for undefined', () => {
    expect(normalizeColorToHex(undefined)).toBe('#000000');
    expect(normalizeColorToHex(undefined, '#ffffff')).toBe('#ffffff');
  });
});

// ---------------------------------------------------------------------------
// rgbaArrayToCssString
// ---------------------------------------------------------------------------
describe('rgbaArrayToCssString', () => {
  it('converts RGBA array to CSS string', () => {
    expect(rgbaArrayToCssString([255, 0, 0, 255])).toBe(
      'rgba(255, 0, 0, 1)',
    );
  });

  it('handles partial alpha', () => {
    expect(rgbaArrayToCssString([0, 128, 255, 127.5])).toBe(
      'rgba(0, 128, 255, 0.5)',
    );
  });

  it('handles zero alpha', () => {
    expect(rgbaArrayToCssString([0, 0, 0, 0])).toBe('rgba(0, 0, 0, 0)');
  });
});

// ---------------------------------------------------------------------------
// rgbaObjectToArray
// ---------------------------------------------------------------------------
describe('rgbaObjectToArray', () => {
  it('converts object with alpha to array', () => {
    expect(rgbaObjectToArray({ r: 255, g: 128, b: 0, a: 0.5 })).toEqual([
      255, 128, 0, 128,
    ]);
  });

  it('defaults alpha to 1 (255) when not provided', () => {
    expect(rgbaObjectToArray({ r: 10, g: 20, b: 30 })).toEqual([
      10, 20, 30, 255,
    ]);
  });

  it('handles alpha=0', () => {
    expect(rgbaObjectToArray({ r: 0, g: 0, b: 0, a: 0 })).toEqual([
      0, 0, 0, 0,
    ]);
  });
});
