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
  categoryColors?: Record<string, number[]>;
  defaultColor?: number[];
  // Dimension column name for category lookup in feature.properties
  dimensionColumn?: string;
  // Set of enabled category names (lowercase) - features not in this set are excluded from clustering
  // If not provided, all features are included
  enabledCategories?: Set<string>;
  // Clustering configuration
  clusterMaxZoom?: number; // Zoom level at which clustering stops (default: 14)
  clusterMinPoints?: number; // Minimum points to form a cluster (default: 2)
  clusterRadius?: number; // Proximity radius in pixels (default: 40)
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

// Default clustering configuration values
const DEFAULT_CLUSTER_RADIUS = 40; // pixels - controls how aggressively points cluster
const DEFAULT_MAX_ZOOM = 14; // max zoom level for clustering
const DEFAULT_MIN_POINTS = 2; // minimum points to form a cluster

type ClusterData = PointFeature<any> | ClusterFeature<any>;

// Store Supercluster index outside of layer to survive layer recreation during cloning
// Key is layer ID, value is { index, features, dataLength, config } so we can detect stale caches
// We store features so we can rebuild the index when config changes even if layer has no data
const indexCache = new Map<
  string,
  {
    index: Supercluster<any, any>;
    features: any[]; // Store features for rebuilding when config changes
    dataLength: number;
    enabledCategoriesKey: string;
    clusterConfigKey: string; // Track clustering config changes
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

  // Get a stable string key from clustering config for cache comparison
  getClusterConfigKey(): string {
    const {
      clusterMaxZoom = DEFAULT_MAX_ZOOM,
      clusterMinPoints = DEFAULT_MIN_POINTS,
      clusterRadius = DEFAULT_CLUSTER_RADIUS,
    } = this.props;
    return `${clusterMaxZoom}-${clusterMinPoints}-${clusterRadius}`;
  }

  // Build a new Supercluster index from current props data
  buildClusterIndex() {
    const {
      id,
      data,
      getPosition,
      enabledCategories,
      dimensionColumn,
      clusterMaxZoom = DEFAULT_MAX_ZOOM,
      clusterMinPoints = DEFAULT_MIN_POINTS,
      clusterRadius = DEFAULT_CLUSTER_RADIUS,
    } = this.props;

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
      maxZoom: clusterMaxZoom,
      minPoints: clusterMinPoints,
      radius: clusterRadius,
    });

    newIndex.load(validFeatures);

    // Cache the index globally (survives layer cloning)
    // Store features, dataLength, enabledCategoriesKey, and clusterConfigKey to detect when rebuild is needed
    indexCache.set(id, {
      index: newIndex,
      features: validFeatures,
      dataLength: data.length,
      enabledCategoriesKey: this.getEnabledCategoriesKey(),
      clusterConfigKey: this.getClusterConfigKey(),
    });
  }

  // Rebuild the index using cached features with new clustering config
  rebuildIndexFromCachedFeatures(
    features: any[],
    clusterMaxZoom: number,
    clusterMinPoints: number,
    clusterRadius: number,
  ) {
    const { id, enabledCategories, dimensionColumn } = this.props;

    // Filter features by enabled categories if needed
    const filteredFeatures = enabledCategories
      ? features.filter((f: any) => {
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

            return enabledCategories.has(categoryKey);
          }
          return true;
        })
      : features;

    const newIndex = new Supercluster<any, any>({
      maxZoom: clusterMaxZoom,
      minPoints: clusterMinPoints,
      radius: clusterRadius,
    });

    newIndex.load(filteredFeatures);

    // Update cache with new index but keep the same features
    indexCache.set(id, {
      index: newIndex,
      features,
      dataLength: features.length,
      enabledCategoriesKey: this.getEnabledCategoriesKey(),
      clusterConfigKey: this.getClusterConfigKey(),
    });
  }

  // Ensure we have an index available (build or restore from cache)
  ensureIndexExists() {
    const layerId = this.props.id;
    const currentDataLength = this.props.data?.length ?? 0;
    const cached = indexCache.get(layerId);
    const currentCategoriesKey = this.getEnabledCategoriesKey();
    const currentConfigKey = this.getClusterConfigKey();

    const {
      clusterMaxZoom = DEFAULT_MAX_ZOOM,
      clusterMinPoints = DEFAULT_MIN_POINTS,
      clusterRadius = DEFAULT_CLUSTER_RADIUS,
    } = this.props;

    // Check if cached config matches current props
    const cacheConfigMatches =
      cached &&
      cached.enabledCategoriesKey === currentCategoriesKey &&
      cached.clusterConfigKey === currentConfigKey;

    // If cache exists and config matches, nothing to do
    if (cacheConfigMatches) {
      return;
    }

    // If we have current data, rebuild from current data
    if (currentDataLength > 0) {
      this.buildClusterIndex();
      return;
    }

    // If we have no current data but have cached features and config changed,
    // rebuild the index using cached features with new config
    if (cached && cached.features && cached.features.length > 0) {
      this.rebuildIndexFromCachedFeatures(
        cached.features,
        clusterMaxZoom,
        clusterMinPoints,
        clusterRadius,
      );
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
    // Ensure index is current before rendering
    // This can now rebuild from cached features even without current data
    this.ensureIndexExists();

    // Get the Supercluster index from cache
    const index = this.getClusterIndex();

    // Get current zoom from the viewport context - this is always current
    const currentZoom = this.context.viewport?.zoom ?? 0;
    const z = Math.floor(currentZoom);

    // Calculate clusters directly from the current zoom level
    // This ensures we always render based on the current viewport
    let clusterData: ClusterData[] = [];
    let singlePointData: ClusterData[] = [];

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

    if (index) {
      const allData = index.getClusters([-180, -85, 180, 85], z);
      clusterData = allData.filter((d: ClusterData) => d.properties?.cluster);
      const unsortedSinglePoints = allData.filter(
        (d: ClusterData) => !d.properties?.cluster,
      );

      // Sort single points by category order for z-index rendering
      // Categories earlier in categoryColors render on top (last in draw order)
      // This matches DartLayer's behavior for non-clustered Point/Icon layers
      const categoryKeys = Object.keys(categoryColors);
      const UNCATEGORIZED_INDEX = Number.MAX_SAFE_INTEGER;

      singlePointData = [...unsortedSinglePoints].sort((a, b) => {
        const getCategoryIndex = (d: ClusterData): number => {
          const props = d.properties;
          const categoryRaw =
            props?.categoryName ??
            (dimensionColumn ? props?.properties?.[dimensionColumn] : null);

          if (categoryRaw == null) return UNCATEGORIZED_INDEX;

          const lookupKey =
            typeof categoryRaw === 'string'
              ? categoryRaw.trim().toLowerCase()
              : String(categoryRaw).trim().toLowerCase();

          const idx = categoryKeys.indexOf(lookupKey);
          return idx === -1 ? UNCATEGORIZED_INDEX : idx;
        };

        // Reverse order: higher index drawn first (bottom), lower index drawn last (top)
        return getCategoryIndex(b) - getCategoryIndex(a);
      });
    } else {
      // No index available - return empty layers
      return [];
    }

    const layers: Layer[] = [];

    // If parent layer is not visible, return empty array
    if (this.props.visible === false) {
      return layers;
    }

    // 1. Cluster layer (IconLayer with numbered pin markers)
    // Use stable IDs so deck.gl can reuse layers across zoom changes
    // updateTriggers handle re-computation of accessors when zoom changes
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
            anchorY: height / 2,
          };
        },

        getSize: (d: ClusterData) => {
          const count = d.properties?.point_count || 0;
          // Return half the icon height since we generate 2x resolution icons
          return getClusterIconSize(count).height / 2;
        },

        sizeScale: 1,
        sizeUnits: 'pixels' as const,
        billboard: true,
        sizeMinPixels: 1,
        sizeMaxPixels: 500,
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
        }),
      );
    }

    return layers;
  }
}
