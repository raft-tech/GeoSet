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
export function validateLayerType(
  userLayerType: string,
  geometryType?: string,
): string {
  if (!geometryType) return userLayerType;

  // Text Overlay uses point geometry but renders as text — don't override to 'Point'
  if (userLayerType === 'TextOverlay') return 'TextOverlay';

  // If user selected GeoJSON, always allow it
  if (userLayerType === 'GeoJSON') return 'GeoJSON';

  switch (geometryType) {
    case 'Point':
    case 'MultiPoint':
      return 'Point';

    case 'Line':
      return 'Line';

    case 'LineString':
    case 'MultiLineString':
      return 'LineString';

    case 'Polygon':
    case 'MultiPolygon':
      return 'Polygon';

    case 'GeometryCollection':
    case 'FeatureCollection':
      return 'GeoJSON';

    default:
      return userLayerType;
  }
}
