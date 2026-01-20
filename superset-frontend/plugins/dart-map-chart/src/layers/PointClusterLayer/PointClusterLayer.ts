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

const CLUSTER_RADIUS = 50; // pixels - controls how aggressively points cluster
const MAX_ZOOM = 20; // max zoom level for clustering

type ClusterData = PointFeature<any> | ClusterFeature<any>;

type ClusterState = {
  data: ClusterData[];
  index: Supercluster<any, any>;
  z: number;
};

export default class PointClusterLayer extends CompositeLayer<PointClusterLayerProps> {
  // Access state with type assertion since deck.gl manages state internally
  private get clusterState(): ClusterState {
    return this.state as unknown as ClusterState;
  }

  shouldUpdateState({ changeFlags }: UpdateParameters<this>) {
    return changeFlags.somethingChanged;
  }

  updateState({ props, changeFlags }: UpdateParameters<this>) {
    const rebuildIndex = changeFlags.dataChanged;

    if (rebuildIndex) {
      const index = new Supercluster<any, any>({
        maxZoom: MAX_ZOOM,
        radius: CLUSTER_RADIUS,
      });

      index.load(
        props.data.map((d: any) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: props.getPosition(d),
          },
          properties: d,
        })),
      );

      this.setState({ index });
    }

    const z = Math.floor(this.context.viewport.zoom);
    if (rebuildIndex || z !== this.clusterState.z) {
      this.setState({
        data: this.clusterState.index.getClusters([-180, -85, 180, 85], z),
        z,
      });
    }
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
      if (pickedObject.cluster && mode !== 'hover' && pickedObject.cluster_id) {
        objects = this.clusterState.index
          .getLeaves(pickedObject.cluster_id, 25)
          .map((f: any) => f.properties);
      }
      return { ...info, object: pickedObject, objects } as PickingInfo;
    }
    return { ...info, object: undefined };
  }

  renderLayers(): Layer[] {
    const { data } = this.clusterState;
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

    // Separate clusters from single points
    const clusters = data.filter((d: ClusterData) => d.properties?.cluster);
    const singlePoints = data.filter(
      (d: ClusterData) => !d.properties?.cluster,
    );

    const layers: Layer[] = [];

    // 1. Cluster layer (always IconLayer with numbered circles)
    if (clusters.length > 0) {
      layers.push(
        new IconLayer({
          id: `${this.props.id}-clusters`,
          data: clusters,
          pickable,
          onHover,
          onClick,

          getPosition: (d: ClusterData) =>
            d.geometry.coordinates as [number, number],

          getIcon: (d: ClusterData) => {
            const clusterId = d.properties?.cluster_id;
            const leaves = this.clusterState.index.getLeaves(clusterId, 100);
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
              anchorY: height, // Anchor at bottom tip of pin
            };
          },

          getSize: (d: ClusterData) => {
            const count = d.properties?.point_count || 0;
            // Return height since pin is taller than wide
            return getClusterIconSize(count).height;
          },

          sizeScale: 1,
          sizeUnits: 'pixels' as const,

          updateTriggers: {
            getIcon: [
              categoryColors,
              defaultColor,
              dimensionColumn,
              this.clusterState.z,
            ],
            getSize: [this.clusterState.z],
          },
        }),
      );
    }

    // 2. Single points layer - IconLayer or ScatterplotLayer depending on iconName
    if (singlePoints.length > 0) {
      if (iconName) {
        // Use IconLayer for single points
        layers.push(
          new IconLayer({
            id: `${this.props.id}-icons`,
            data: singlePoints,
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
                anchorY: 128, // Bottom anchor for markers
              };
            },

            getSize: () => iconSize,

            sizeScale: 2,
            sizeUnits: 'pixels' as const,

            updateTriggers: {
              getIcon: [iconName, defaultColor],
            },
          }),
        );
      } else {
        // Use ScatterplotLayer for single points (colored dots)
        layers.push(
          new ScatterplotLayer({
            id: `${this.props.id}-points`,
            data: singlePoints,
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
    }

    return layers;
  }
}
