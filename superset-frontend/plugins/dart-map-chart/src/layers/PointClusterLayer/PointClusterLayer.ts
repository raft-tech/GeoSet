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

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CompositeLayer,
  UpdateParameters,
  PickingInfo,
  Layer,
} from '@deck.gl/core';
import { IconLayer, ScatterplotLayer } from '@deck.gl/layers';
import Supercluster from 'supercluster';
import type { PointFeature, ClusterFeature } from 'supercluster';
import {
  getClusterIconUrl,
  getClusterIconSize,
  getDominantCategoryColor,
} from '../../utils/clusterIcons';
import { getColoredSvgUrl } from '../../utils/svgIcons';

export type PointClusterLayerProps = {
  id: string;
  data: any[];
  getPosition: (d: any) => [number, number];
  getColor?: (d: any) => [number, number, number, number];
  categoryColors?: Record<string, number[]>;
  defaultColor?: number[];
  // Dimension column name for category lookup in feature.properties
  dimensionColumn?: string;
  // Set of enabled category names (lowercase) - features not in this set are excluded from clustering
  // If not provided, all features are included
  enabledCategories?: Set<string>;
  // IconLayer-specific (optional - if not provided, uses ScatterplotLayer for single points)
  iconName?: string;
  iconSize?: number;
  // ScatterplotLayer-specific
  pointRadius?: number;
  filled?: boolean;
  stroked?: boolean;
  strokeColor?: number[];
  lineWidth?: number;
  // Common
  onHover?: (info: PickingInfo) => void;
  onClick?: (info: PickingInfo) => void;
  pickable?: boolean;
};

const CLUSTER_RADIUS = 40; // pixels - controls how aggressively points cluster
const MAX_ZOOM = 20; // max zoom level for clustering

type ClusterData = PointFeature<any> | ClusterFeature<any>;

// Store Supercluster index outside of layer to survive layer recreation during cloning
// Key is layer ID, value is { index, dataLength } so we can detect stale caches
const indexCache = new Map<
  string,
  {
    index: Supercluster<any, any>;
    dataLength: number;
    enabledCategoriesKey: string;
  }
>();

export default class PointClusterLayer extends CompositeLayer<PointClusterLayerProps> {
  initializeState() {
    // Build or restore the Supercluster index immediately
    this.ensureIndexExists();
  }

  shouldUpdateState({
    changeFlags,
  }: UpdateParameters<PointClusterLayer>): boolean {
    // Must include viewportChanged to trigger renderLayers on zoom
    return !!(
      changeFlags.dataChanged ||
      changeFlags.propsChanged ||
      changeFlags.viewportChanged
    );
  }

  updateState({ changeFlags }: UpdateParameters<PointClusterLayer>) {
    // Rebuild index if data changed
    if (changeFlags.dataChanged) {
      this.buildClusterIndex();
    }

    // Ensure index exists (restore from cache if needed)
    this.ensureIndexExists();
  }

  // Get a stable string key from enabledCategories for cache comparison
  getEnabledCategoriesKey(): string {
    const { enabledCategories } = this.props;
    if (!enabledCategories) return 'all';
    // Sort for consistent key regardless of iteration order
    return Array.from(enabledCategories).sort().join('|');
  }

  // Build a new Supercluster index from current props data
  buildClusterIndex() {
    const { id, data, getPosition, enabledCategories, dimensionColumn } =
      this.props;

    if (!data || data.length === 0) {
      return;
    }

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

    // Filter out invalid features and features with disabled categories
    const validFeatures = features.filter((f: any) => {
      // Check for valid coordinates
      const hasValidCoords =
        f.geometry.coordinates &&
        f.geometry.coordinates.length === 2 &&
        !Number.isNaN(f.geometry.coordinates[0]) &&
        !Number.isNaN(f.geometry.coordinates[1]);

      if (!hasValidCoords) return false;

      // If enabledCategories is provided, filter by category
      if (enabledCategories) {
        const categoryRaw =
          f.properties?.categoryName ??
          (dimensionColumn
            ? f.properties?.properties?.[dimensionColumn]
            : null);

        if (categoryRaw != null) {
          const categoryKey =
            typeof categoryRaw === 'string'
              ? categoryRaw.trim().toLowerCase()
              : String(categoryRaw).trim().toLowerCase();

          if (!enabledCategories.has(categoryKey)) {
            return false;
          }
        }
      }

      return true;
    });

    const newIndex = new Supercluster<any, any>({
      maxZoom: MAX_ZOOM,
      radius: CLUSTER_RADIUS,
    });

    newIndex.load(validFeatures);

    // Cache the index globally (survives layer cloning)
    // Store dataLength and enabledCategoriesKey to detect when rebuild is needed
    indexCache.set(id, {
      index: newIndex,
      dataLength: data.length,
      enabledCategoriesKey: this.getEnabledCategoriesKey(),
    });
  }

  // Ensure we have an index available (build or restore from cache)
  ensureIndexExists() {
    const layerId = this.props.id;
    const currentDataLength = this.props.data?.length ?? 0;
    const cached = indexCache.get(layerId);

    // Don't rebuild if we have no data (likely a cloned layer) but cache exists
    if (currentDataLength === 0 && cached) {
      return;
    }

    const currentCategoriesKey = this.getEnabledCategoriesKey();

    // Rebuild if no cache OR if data length changed OR if enabled categories changed
    if (
      !cached ||
      cached.dataLength !== currentDataLength ||
      cached.enabledCategoriesKey !== currentCategoriesKey
    ) {
      this.buildClusterIndex();
    }
  }

  // Get the current Supercluster index (from cache)
  getClusterIndex(): Supercluster<any, any> | null {
    const cached = indexCache.get(this.props.id);
    return cached?.index || null;
  }

  getPickingInfo({
    info,
    mode,
  }: {
    info: PickingInfo;
    mode: string;
  }): PickingInfo {
    const pickedObject = (info.object as any)?.properties;
    if (pickedObject) {
      let objects: any[] | undefined;
      const index = this.getClusterIndex();
      if (
        pickedObject.cluster &&
        mode !== 'hover' &&
        pickedObject.cluster_id &&
        index
      ) {
        objects = index
          .getLeaves(pickedObject.cluster_id, 25)
          .map((f: any) => f.properties);
      }
      return { ...info, object: pickedObject, objects } as PickingInfo;
    }
    return { ...info, object: undefined };
  }

  renderLayers(): Layer[] {
    // Get the Supercluster index from cache
    // IMPORTANT: Don't call ensureIndexExists here as cloned layers may have undefined data
    // The index should have been built when the layer was first created with real data
    const index = this.getClusterIndex();

    // Get current zoom from the viewport context - this is always current
    const currentZoom = this.context.viewport?.zoom ?? 0;
    const z = Math.floor(currentZoom);

    // Calculate clusters directly from the current zoom level
    // This ensures we always render based on the current viewport
    let clusterData: ClusterData[] = [];
    let singlePointData: ClusterData[] = [];

    if (index) {
      const allData = index.getClusters([-180, -85, 180, 85], z);
      clusterData = allData.filter((d: ClusterData) => d.properties?.cluster);
      singlePointData = allData.filter(
        (d: ClusterData) => !d.properties?.cluster,
      );
    } else {
      // No index available - return empty layers
      return [];
    }

    const {
      iconName,
      iconSize = 10,
      pointRadius = 5,
      filled = true,
      stroked = true,
      strokeColor = [255, 255, 255, 255],
      lineWidth = 1,
      categoryColors = {},
      defaultColor = [100, 100, 100, 255],
      dimensionColumn,
      pickable = true,
      onHover,
      onClick,
    } = this.props;

    const layers: Layer[] = [];

    // If parent layer is not visible, return empty array
    if (this.props.visible === false) {
      return layers;
    }

    // 1. Cluster layer (IconLayer with numbered pin markers)
    // Use zoom level in the layer ID to force recreation when zoom changes
    // This fixes rendering issues at certain zoom levels
    layers.push(
      new IconLayer({
        id: `${this.props.id}-clusters-z${z}`,
        data: clusterData,
        visible: clusterData.length > 0,
        pickable,
        onHover,
        onClick,

        getPosition: (d: ClusterData) =>
          d.geometry.coordinates as [number, number],

        getIcon: (d: ClusterData) => {
          if (!index) {
            return { url: '', width: 1, height: 1 };
          }
          const clusterId = d.properties?.cluster_id;
          const leaves = index.getLeaves(clusterId, 100);
          const features = leaves.map((l: any) => l.properties);
          const dominantColor = getDominantCategoryColor(
            features as Array<{
              color?: number[];
              categoryName?: string;
              properties?: Record<string, unknown>;
            }>,
            categoryColors,
            defaultColor,
            dimensionColumn,
          );
          const count = d.properties?.point_count || 0;
          const url = getClusterIconUrl(count, dominantColor);
          const { width, height } = getClusterIconSize(count);

          return {
            url,
            width,
            height,
            anchorY: height,
          };
        },

        getSize: (d: ClusterData) => {
          const count = d.properties?.point_count || 0;
          return getClusterIconSize(count).height;
        },

        sizeScale: 1,
        sizeUnits: 'pixels' as const,
        billboard: true,
        sizeMinPixels: 1,
        sizeMaxPixels: 500,

        updateTriggers: {
          getIcon: [categoryColors, defaultColor, dimensionColumn, z],
          getSize: [z],
          getPosition: [z],
        },

        // Force data update when zoom changes to ensure proper rendering
        dataComparator: (newData, oldData) => {
          const newArr = newData as ClusterData[];
          const oldArr = oldData as ClusterData[];
          if (newArr.length !== oldArr.length) return false;
          if (
            newArr[0]?.properties?.cluster_id !==
            oldArr[0]?.properties?.cluster_id
          ) {
            return false;
          }
          return true;
        },
      }),
    );

    // 2. Single points layer - IconLayer or ScatterplotLayer depending on iconName
    if (iconName) {
      layers.push(
        new IconLayer({
          id: `${this.props.id}-icons-z${z}`,
          data: singlePointData,
          visible: singlePointData.length > 0,
          pickable,
          onHover,
          onClick,

          getPosition: (d: ClusterData) =>
            d.geometry.coordinates as [number, number],

          getIcon: (d: ClusterData) => {
            const feature = d.properties;
            const rgba = feature?.color || defaultColor;
            const url = getColoredSvgUrl(iconName, rgba);

            return {
              url,
              width: 128,
              height: 128,
              anchorY: 128,
            };
          },

          getSize: () => iconSize,

          sizeScale: 2,
          sizeUnits: 'pixels' as const,

          updateTriggers: {
            getIcon: [iconName, defaultColor, z],
            getSize: [z],
          },
        }),
      );
    } else {
      layers.push(
        new ScatterplotLayer({
          id: `${this.props.id}-points-z${z}`,
          data: singlePointData,
          visible: singlePointData.length > 0,
          pickable,
          onHover,
          onClick,

          getPosition: (d: ClusterData) =>
            d.geometry.coordinates as [number, number],
          getFillColor: (d: ClusterData) => {
            const feature = d.properties;
            return (feature?.color || defaultColor) as [
              number,
              number,
              number,
              number,
            ];
          },
          getLineColor: () => strokeColor as [number, number, number, number],
          getRadius: () => pointRadius,

          filled,
          stroked,
          lineWidthUnits: 'pixels' as const,
          getLineWidth: lineWidth,
          radiusUnits: 'pixels' as const,
          radiusMinPixels: 1,
          radiusMaxPixels: 50,

          updateTriggers: {
            getFillColor: [z],
            getRadius: [z],
          },
        }),
      );
    }

    return layers;
  }
}
