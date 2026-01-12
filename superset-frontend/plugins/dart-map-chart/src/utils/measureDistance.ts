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

export type Coordinate = [number, number]; // [longitude, latitude]

const EARTH_RADIUS_METERS = 6371000;
const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the distance between two geographic points using the Haversine formula.
 * @param point1 - [longitude, latitude]
 * @param point2 - [longitude, latitude]
 * @returns Distance in meters
 */
export function calculateHaversineDistance(
  point1: Coordinate,
  point2: Coordinate,
): number {
  const [lon1, lat1] = point1;
  const [lon2, lat2] = point2;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Format distance for display with appropriate units.
 * Uses miles/feet for distances (imperial units to match the existing scale control).
 */
export function formatDistance(meters: number): string {
  const miles = meters / METERS_PER_MILE;

  if (miles >= 0.1) {
    return `${miles.toFixed(2)} mi`;
  }

  const feet = meters / METERS_PER_FOOT;
  return `${Math.round(feet)} ft`;
}
