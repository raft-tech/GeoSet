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
import computeBoundsFromPoints from '../../src/utils/computeBoundsFromPoints';
import { Point } from '../../src/types';

describe('computeBoundsFromPoints', () => {
  it('computes bounds for spread-out points', () => {
    const points: Point[] = [
      [-10, -20],
      [30, 40],
    ];
    const [[lngMin, latMin], [lngMax, latMax]] =
      computeBoundsFromPoints(points);

    expect(lngMin).toBe(-10);
    expect(latMin).toBe(-20);
    expect(lngMax).toBe(30);
    expect(latMax).toBe(40);
  });

  it('expands bounds for a single point', () => {
    const points: Point[] = [[10, 20]];
    const [[lngMin, latMin], [lngMax, latMax]] =
      computeBoundsFromPoints(points);

    // Single point → min === max, so expandIfNeeded pads by 0.25
    expect(lngMin).toBeLessThan(10);
    expect(lngMax).toBeGreaterThan(10);
    expect(latMin).toBeLessThan(20);
    expect(latMax).toBeGreaterThan(20);
  });

  it('expands bounds when all points are identical', () => {
    const points: Point[] = [
      [5, 5],
      [5, 5],
      [5, 5],
    ];
    const [[lngMin, latMin], [lngMax, latMax]] =
      computeBoundsFromPoints(points);

    expect(lngMin).toBeLessThan(5);
    expect(lngMax).toBeGreaterThan(5);
    expect(latMin).toBeLessThan(5);
    expect(latMax).toBeGreaterThan(5);
  });

  it('respects latitude limits (-90, 90)', () => {
    const points: Point[] = [
      [0, -90],
      [0, 90],
    ];
    const [[, latMin], [, latMax]] = computeBoundsFromPoints(points);

    expect(latMin).toBeGreaterThanOrEqual(-90);
    expect(latMax).toBeLessThanOrEqual(90);
  });

  it('respects longitude limits (-180, 180)', () => {
    const points: Point[] = [
      [-180, 0],
      [180, 0],
    ];
    const [[lngMin], [lngMax]] = computeBoundsFromPoints(points);

    expect(lngMin).toBeGreaterThanOrEqual(-180);
    expect(lngMax).toBeLessThanOrEqual(180);
  });

  it('handles negative coordinate ranges', () => {
    const points: Point[] = [
      [-50, -30],
      [-10, -5],
    ];
    const [[lngMin, latMin], [lngMax, latMax]] =
      computeBoundsFromPoints(points);

    expect(lngMin).toBe(-50);
    expect(lngMax).toBe(-10);
    expect(latMin).toBe(-30);
    expect(latMax).toBe(-5);
  });
});
