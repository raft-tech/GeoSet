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

import Supercluster from 'supercluster';
import type { PointFeature, ClusterFeature } from 'supercluster';

const CLUSTER_RADIUS = 40; // pixels - controls how aggressively points cluster
const MAX_ZOOM = 20; // max zoom level for clustering

export type ClusterPoint = PointFeature<any> | ClusterFeature<any>;

export interface ClusterIndex {
  index: Supercluster<any, any>;
  dataHash: string;
}

// Global cache for cluster indices, keyed by a hash of the data
const clusterIndexCache = new Map<string, ClusterIndex>();

/**
 * Create a simple hash from data to detect changes
 */
function createDataHash(data: any[]): string {
  if (!data || data.length === 0) return 'empty';
  // Use length + first and last item coordinates as a simple hash
  const first = data[0]?.geometry?.coordinates;
  const last = data[data.length - 1]?.geometry?.coordinates;
  return `${data.length}-${first?.[0]}-${first?.[1]}-${last?.[0]}-${last?.[1]}`;
}

/**
 * Build or retrieve a cached Supercluster index for the given data
 */
export function getClusterIndex(
  cacheKey: string,
  data: any[],
  getPosition: (d: any) => [number, number],
): Supercluster<any, any> | null {
  if (!data || data.length === 0) return null;

  const dataHash = createDataHash(data);
  const cached = clusterIndexCache.get(cacheKey);

  // Return cached index if data hasn't changed
  if (cached && cached.dataHash === dataHash) {
    return cached.index;
  }

  // Build new index
  const features = data.map((d: any) => {
    const coords = getPosition(d);
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: coords,
      },
      properties: d,
    };
  });

  // Filter out invalid features
  const validFeatures = features.filter(
    (f: any) =>
      f.geometry.coordinates &&
      f.geometry.coordinates.length === 2 &&
      !Number.isNaN(f.geometry.coordinates[0]) &&
      !Number.isNaN(f.geometry.coordinates[1]),
  );

  if (validFeatures.length === 0) return null;

  const index = new Supercluster<any, any>({
    maxZoom: MAX_ZOOM,
    radius: CLUSTER_RADIUS,
  });

  index.load(validFeatures);

  // Cache it
  clusterIndexCache.set(cacheKey, { index, dataHash });

  return index;
}

/**
 * Get clusters and single points for a given zoom level
 */
export function getClustersAtZoom(
  index: Supercluster<any, any> | null,
  zoom: number,
): { clusters: ClusterPoint[]; singlePoints: ClusterPoint[] } {
  if (!index) {
    return { clusters: [], singlePoints: [] };
  }

  const z = Math.floor(zoom);
  const allData = index.getClusters([-180, -85, 180, 85], z);

  const clusters = allData.filter((d: ClusterPoint) => d.properties?.cluster);
  const singlePoints = allData.filter(
    (d: ClusterPoint) => !d.properties?.cluster,
  );

  return { clusters, singlePoints };
}

/**
 * Clear the cluster cache (useful for testing or memory management)
 */
export function clearClusterCache(): void {
  clusterIndexCache.clear();
}
