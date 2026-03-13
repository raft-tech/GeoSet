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

/**
 * Formats a number for human-readable display in legends.
 * - Numbers < 1000: up to 1 decimal place (trailing zeros removed)
 * - Numbers >= 1,000: uses K suffix (e.g., 1.3K)
 * - Numbers >= 1,000,000: uses M suffix (e.g., 1.3M)
 * - Numbers >= 1,000,000,000: uses B suffix (e.g., 2.5B)
 */
export function formatLegendNumber(value: number): string {
  if (value === 0) return '0';

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  let result: string;

  if (absValue >= 1_000_000_000) {
    // Billions
    result = `${sign}${trimDecimals(absValue / 1_000_000_000)}B`;
  } else if (absValue >= 1_000_000) {
    // Millions
    result = `${sign}${trimDecimals(absValue / 1_000_000)}M`;
  } else if (absValue >= 1_000) {
    // Thousands
    result = `${sign}${trimDecimals(absValue / 1_000)}K`;
  } else {
    // Small numbers - show up to 3 decimal places
    result = `${sign}${trimDecimals(absValue)}`;
  }

  return result;
}

/**
 * Formats a bound value for legend display, adding the appropriate
 * prefix/suffix based on whether percentile bounds are used.
 *
 * - Lower bound with percentile: "≤ 1.2K"
 * - Upper bound with percentile: "> 5K"
 * - Upper bound without percentile: "5K+"
 * - No range (lower === upper): plain number
 */
export function formatBoundLabel(
  value: number,
  position: 'lower' | 'upper',
  hasRange: boolean,
  usesPercentBounds = false,
): string {
  const formatted = formatLegendNumber(value);
  if (!hasRange) return formatted;
  if (position === 'lower') {
    return usesPercentBounds ? `≤\u2009${formatted}` : formatted;
  }
  return usesPercentBounds ? `>\u2009${formatted}` : `${formatted}+`;
}

/**
 * Formats a number to up to 1 decimal place, removing trailing zeros.
 */
function trimDecimals(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toString();
}
