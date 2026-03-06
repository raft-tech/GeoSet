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
// range and point actually have different value ranges
// and also are different concept-wise

import { Layer } from '@deck.gl/core';
import type { RGBAColor } from './utils/colors';

export type Range = [number, number];
export type Point = [number, number];
export interface ColorType {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface GeoJsonFeature {
  type: 'Feature';
  geometry: any;
  properties: { [key: string]: any };
  extraProps?: { [key: string]: any };
  color?: number[]; // optionally added by addColor
}

export function toHex(color: ColorType): string {
  const hex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');

  const alpha = Math.round(color.a * 255);

  return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}${hex(alpha)}`;
}

export function toColorType([r, g, b, a]: number[]): ColorType {
  return { r, g, b, a };
}

export type LayerState = {
  id: string;
  layer: Layer;
  options: {
    minZoom: number;
    maxZoom: number;
    userVisible?: boolean; // User-toggled visibility (undefined = visible)
  };
};

export type LegendItem = {
  style: {
    fillColor: ColorType;
    strokeColor: ColorType;
  };
  type: string;
  description: string;
};

export type CategoryEntry = {
  label: string;
  fillColor: RGBAColor;
  strokeColor: RGBAColor;
  enabled?: boolean; // Whether category is visible (default true)
};

export type MetricEntry = {
  lower: number;
  upper: number;
  startColor: RGBAColor;
  endColor: RGBAColor;
};

export type LayerInfo = {
  legendName: string;
  legendParentTitle?: string;
  sliceName: string;
  icon?: string;
  geometryType?: string;
  type: 'simple' | 'categorical' | 'metric';
  simpleStyle?: { fillColor: RGBAColor; strokeColor: RGBAColor };
  categories?: CategoryEntry[];
  metric?: MetricEntry;
  initialCollapsed?: boolean; // Whether this legend entry starts collapsed
};

export type LegendGroupEntry = {
  sliceId: string;
  group: LayerInfo;
};

export type LegendGroup = {
  displayTitle: string;
  entries: LegendGroupEntry[];
  initialCollapsed: boolean; // true only if ALL entries have initialCollapsed
};
