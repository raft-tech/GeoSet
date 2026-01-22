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

// Cache for cluster icon data URLs
const clusterIconCache = new Map<string, string>();

/**
 * Scale factor: 1.0x for 1 item, up to 1.4x for 100+ items
 * Uses logarithmic scaling for a more gradual size increase
 */
export function getClusterScale(count: number): number {
  // Log scale gives more gradual growth: 1.0 at count=1, ~1.2 at 10, ~1.4 at 100+
  const logScale = Math.log10(Math.max(1, count)) / 2;
  return 1 + Math.min(0.4, logScale);
}

/**
 * Format cluster count for display.
 * - 1-9: show exact number
 * - 10-99: show rounded to nearest 10 with + (e.g., "10+", "20+")
 * - 100-999: show rounded to nearest 100 with + (e.g., "100+", "200+")
 * - 1000+: show "1k+", "2k+", etc.
 */
export function formatClusterCount(count: number): string {
  if (count < 10) {
    return String(count);
  }
  if (count < 100) {
    const rounded = Math.floor(count / 10) * 10;
    return `${rounded}+`;
  }
  if (count < 1000) {
    const rounded = Math.floor(count / 100) * 100;
    return `${rounded}+`;
  }
  const rounded = Math.floor(count / 1000);
  return `${rounded}k+`;
}

/**
 * Generate cluster marker SVG with count and color (pin/teardrop shape)
 */
export function getClusterSvg(
  count: number,
  rgba: [number, number, number, number],
  baseSize = 36,
): string {
  const [r, g, b, a] = rgba;
  const scale = getClusterScale(count);
  const width = Math.round(baseSize * scale);
  const height = Math.round(width * 1.4); // Pin is taller than wide
  const circleRadius = width / 2 - 4;
  const circleCenterY = circleRadius + 4; // Circle center position from top

  // Format the count for display (e.g., "10+", "20+", "100+", "1k+")
  const displayCount = formatClusterCount(count);

  // Adjust font size based on display string length and icon size
  const baseFontSize = Math.max(10, Math.round(width * 0.35));
  let fontSize = baseFontSize;
  if (displayCount.length >= 4) {
    fontSize = Math.round(baseFontSize * 0.7);
  } else if (displayCount.length >= 3) {
    fontSize = Math.round(baseFontSize * 0.85);
  }

  // Create pin/teardrop shape: circle at top with pointed bottom
  // The path creates a rounded top that tapers to a point at the bottom
  const cx = width / 2;
  const pinTipY = height - 2;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow-${count}" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.3"/>
      </filter>
    </defs>
    <path d="M ${cx} ${pinTipY}
             C ${cx - circleRadius * 0.6} ${circleCenterY + circleRadius * 1.2}
               ${cx - circleRadius} ${circleCenterY + circleRadius * 0.5}
               ${cx - circleRadius} ${circleCenterY}
             A ${circleRadius} ${circleRadius} 0 1 1 ${cx + circleRadius} ${circleCenterY}
             C ${cx + circleRadius} ${circleCenterY + circleRadius * 0.5}
               ${cx + circleRadius * 0.6} ${circleCenterY + circleRadius * 1.2}
               ${cx} ${pinTipY} Z"
          fill="rgb(${r},${g},${b})" fill-opacity="${a / 255}"
          stroke="white" stroke-width="2"
          filter="url(#shadow-${count})"/>
    <text x="${cx}" y="${circleCenterY}" text-anchor="middle" dominant-baseline="central" fill="white" font-family="system-ui, sans-serif" font-size="${fontSize}" font-weight="bold">${displayCount}</text>
  </svg>`;
}

/**
 * Get cluster icon dimensions for a given count
 */
export function getClusterIconSize(
  count: number,
  baseSize = 36,
): { width: number; height: number } {
  const scale = getClusterScale(count);
  const width = Math.round(baseSize * scale);
  const height = Math.round(width * 1.4);
  return { width, height };
}

/**
 * Get cached data URL for cluster icon
 */
export function getClusterIconUrl(
  count: number,
  rgba: [number, number, number, number],
  baseSize = 36,
): string {
  const scale = getClusterScale(count);
  const size = Math.round(baseSize * scale);
  const cacheKey = `cluster-${count}-${rgba.join('-')}-${size}`;

  if (clusterIconCache.has(cacheKey)) {
    return clusterIconCache.get(cacheKey)!;
  }

  const svg = getClusterSvg(count, rgba, baseSize);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  clusterIconCache.set(cacheKey, url);
  return url;
}

/**
 * Determine dominant category color from clustered features.
 * Category names are normalized to lowercase for lookup since
 * categoryColors keys are stored as lowercase.
 *
 * @param features - Array of feature objects
 * @param categoryColors - Map of category names (lowercase) to color arrays
 * @param defaultColor - Fallback color if no category match
 * @param dimensionColumn - Optional column name to look up category from properties
 */
export function getDominantCategoryColor(
  features: Array<{
    color?: number[];
    categoryName?: string;
    properties?: Record<string, unknown>;
  }>,
  categoryColors: Record<string, number[]>,
  defaultColor: number[],
  dimensionColumn?: string,
): [number, number, number, number] {
  const categoryCounts: Record<string, number> = {};

  for (const f of features) {
    // Try categoryName first, then fall back to dimension column in properties
    const rawCat: unknown =
      f.categoryName ??
      (dimensionColumn ? f.properties?.[dimensionColumn] : undefined) ??
      'unknown';

    // Normalize category name to lowercase for consistent lookup
    const cat =
      typeof rawCat === 'string'
        ? rawCat.trim().toLowerCase()
        : String(rawCat).trim().toLowerCase();
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  let maxCount = 0;
  let dominantCategory = 'unknown';

  for (const [cat, count] of Object.entries(categoryCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantCategory = cat;
    }
  }

  const color = categoryColors[dominantCategory] || defaultColor;
  return [color[0] ?? 0, color[1] ?? 0, color[2] ?? 0, color[3] ?? 255];
}
