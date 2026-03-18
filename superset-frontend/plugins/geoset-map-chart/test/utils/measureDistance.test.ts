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
  calculateHaversineDistance,
  formatDistance,
  Coordinate,
} from '../../src/utils/measureDistance';

describe('calculateHaversineDistance', () => {
  it('returns 0 for identical points', () => {
    const p: Coordinate = [-77.0369, 38.9072]; // Washington DC
    expect(calculateHaversineDistance(p, p)).toBe(0);
  });

  it('calculates distance between DC and NYC (~328 km)', () => {
    const dc: Coordinate = [-77.0369, 38.9072];
    const nyc: Coordinate = [-74.006, 40.7128];
    const distance = calculateHaversineDistance(dc, nyc);
    // Should be approximately 328 km
    expect(distance).toBeGreaterThan(320_000);
    expect(distance).toBeLessThan(340_000);
  });

  it('calculates distance between London and Paris (~344 km)', () => {
    const london: Coordinate = [-0.1278, 51.5074];
    const paris: Coordinate = [2.3522, 48.8566];
    const distance = calculateHaversineDistance(london, paris);
    expect(distance).toBeGreaterThan(335_000);
    expect(distance).toBeLessThan(350_000);
  });

  it('handles antipodal points (half Earth circumference)', () => {
    const p1: Coordinate = [0, 0];
    const p2: Coordinate = [180, 0];
    const distance = calculateHaversineDistance(p1, p2);
    // Half circumference ≈ 20,015 km
    expect(distance).toBeGreaterThan(20_000_000);
    expect(distance).toBeLessThan(20_100_000);
  });

  it('handles negative longitudes correctly', () => {
    const p1: Coordinate = [-180, 0];
    const p2: Coordinate = [180, 0];
    // These are the same point — distance should be ~0
    expect(calculateHaversineDistance(p1, p2)).toBeLessThan(1);
  });
});

describe('formatDistance', () => {
  it('formats distances >= 0.1 miles in miles', () => {
    // 0.1 miles = ~160.9 meters
    expect(formatDistance(200)).toBe('0.12 mi');
  });

  it('formats large distances in miles', () => {
    // 1 mile = 1609.344 meters
    expect(formatDistance(1609.344)).toBe('1.00 mi');
    expect(formatDistance(8046.72)).toBe('5.00 mi');
  });

  it('formats small distances in feet', () => {
    // 30 meters = ~98 feet, which is < 0.1 miles
    expect(formatDistance(30)).toBe('98 ft');
  });

  it('formats very small distances in feet', () => {
    // 1 meter ≈ 3.28 feet
    expect(formatDistance(1)).toBe('3 ft');
  });

  it('formats 0 meters as 0 ft', () => {
    expect(formatDistance(0)).toBe('0 ft');
  });
});
