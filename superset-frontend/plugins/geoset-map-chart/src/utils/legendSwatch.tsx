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
import { styled } from '@superset-ui/core';
import { RGBAColor } from './colors';
import { getColoredSvgUrl } from './svgIcons';

// Helper to convert RGBA array to CSS rgba() string with proper alpha normalization
const toRgbaString = (color: RGBAColor) =>
  `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;

// Fixed-size wrapper to ensure all swatches align consistently
export const SwatchWrapper = styled.div`
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

// Polygon swatch - square with rounded corners (default)
export const PolygonSwatch = styled.div<{ fill: RGBAColor; stroke: RGBAColor }>`
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: ${({ fill }) => toRgbaString(fill)};
  border: ${({ stroke }) => `1px solid ${toRgbaString(stroke)}`};
`;

// Line swatch - horizontal line (no stroke outline)
export const LineSwatch = styled.div<{ fill: RGBAColor }>`
  width: 16px;
  height: 4px;
  background: ${({ fill }) => toRgbaString(fill)};
  border-radius: 2px;
`;

// Point/Circle swatch - circle (no stroke border)
export const PointSwatch = styled.div<{ fill: RGBAColor }>`
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: ${({ fill }) => toRgbaString(fill)};
`;

// Icon swatch - displays SVG icon
export const IconSwatch = styled.img`
  width: 16px;
  height: 16px;
`;

// Helper component to render the appropriate swatch based on icon/geometry
export type SwatchProps = {
  fill: RGBAColor;
  stroke: RGBAColor;
  icon?: string;
  geometryType?: string;
};

export const Swatch: React.FC<SwatchProps> = ({
  fill,
  stroke,
  icon,
  geometryType,
}) => {
  // If icon is provided, use IconSwatch
  if (icon) {
    const iconName = icon.replace('-icon', '') || 'circle';
    const svgUrl = getColoredSvgUrl(iconName, fill);
    return (
      <SwatchWrapper>
        <IconSwatch src={svgUrl} alt={iconName} />
      </SwatchWrapper>
    );
  }

  // Otherwise, pick swatch based on geometry type
  const geoType = geometryType?.toLowerCase() || 'polygon';

  if (
    geoType === 'line' ||
    geoType === 'multilinestring' ||
    geoType === 'linestring'
  ) {
    return (
      <SwatchWrapper>
        <LineSwatch fill={fill} />
      </SwatchWrapper>
    );
  }

  if (geoType === 'point' || geoType === 'multipoint') {
    return (
      <SwatchWrapper>
        <PointSwatch fill={fill} />
      </SwatchWrapper>
    );
  }

  // Default to polygon (Polygon, MultiPolygon, or unknown)
  return (
    <SwatchWrapper>
      <PolygonSwatch fill={fill} stroke={stroke} />
    </SwatchWrapper>
  );
};
