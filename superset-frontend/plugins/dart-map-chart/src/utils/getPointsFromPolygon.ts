/* eslint-disable no-console */
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
import { Feature, Polygon, MultiPolygon } from 'geojson';

/** Ensures a polygon ring is closed (first == last vertex) - returns new array if modification needed */
function closeRing(ring: number[][]): number[][] {
  if (!ring || ring.length < 3) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  // Check if already closed
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring; // Already closed, return as-is
  }
  // Return new array with closing point (avoid mutating input)
  return [...ring, [first[0], first[1]]];
}

export default function getPointsFromPolygon(
  feature: Feature<Polygon | MultiPolygon>,
): number[][][] | number[][][][] {
  const { geometry } = feature;
  if (!geometry) return [];

  // --- GeoJSON Feature ---
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map(closeRing);
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map(polygon => polygon.map(closeRing));
  }

  console.warn('Unknown polygon feature format:', feature);
  return [];
}
