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
 * - Numbers < 1000: up to 3 decimal places (trailing zeros removed)
 * - Numbers >= 1,000: uses K suffix (e.g., 1.255K)
 * - Numbers >= 1,000,000: uses M suffix (e.g., 1.253M)
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
 * Formats a number to up to 3 decimal places, removing trailing zeros.
 */
function trimDecimals(value: number): string {
  // Round to 3 decimal places
  const rounded = Math.round(value * 1000) / 1000;
  // Convert to string and remove trailing zeros after decimal
  return rounded.toString();
}
