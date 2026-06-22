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
import type { GeoJsonFeature } from '../types';
import { getRepresentativePoint } from './lassoSelection';

/**
 * Flatten feature properties into tabular rows for export.
 *
 * Uses an allowlist approach: only columns the user explicitly configured
 * (dimension, metric, size, hover-over data, additional details, text label)
 * are included. Any computed/styling properties injected during layer
 * processing (fillColor, color_*, sizeValue, etc.) are excluded by default.
 *
 * When no allowlist is provided, falls back to including all properties.
 */
export function featuresToRows(
  features: GeoJsonFeature[],
  allowedColumns?: string[],
): {
  headers: string[];
  rows: Record<string, any>[];
} {
  let propHeaders: string[];

  if (allowedColumns && allowedColumns.length > 0) {
    const allowed = new Set(allowedColumns);
    // Only include allowed keys that actually exist on at least one feature
    const present = new Set<string>();
    features.forEach(f => {
      if (f.properties) {
        Object.keys(f.properties).forEach(k => {
          if (allowed.has(k)) present.add(k);
        });
      }
    });
    // Preserve the caller's column order
    propHeaders = allowedColumns.filter(k => present.has(k));
  } else {
    // No allowlist — include all properties (fallback)
    const keySet = new Set<string>();
    features.forEach(f => {
      if (f.properties) {
        Object.keys(f.properties).forEach(k => keySet.add(k));
      }
    });
    propHeaders = Array.from(keySet).sort();
  }

  const headers = ['_geometry_type', '_longitude', '_latitude', ...propHeaders];

  const rows = features.map(f => {
    const pt = getRepresentativePoint(f);
    const row: Record<string, any> = {
      _geometry_type: f.geometry?.type ?? '',
      _longitude: pt?.[0] ?? '',
      _latitude: pt?.[1] ?? '',
    };
    propHeaders.forEach(key => {
      row[key] = f.properties?.[key] ?? '';
    });
    return row;
  });

  return { headers, rows };
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Sanitize a cell value for Excel export.
 * Prefixes formula-trigger characters with a single quote so they are treated
 * as literal text, matching the CSV injection protection in escapeCSV.
 */
export function sanitizeExcelValue(value: any): any {
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

export function escapeCSV(value: any): string {
  let str = String(value ?? '');
  // Guard against spreadsheet formula injection — only for non-numeric values
  // so legitimate negative numbers like -5.2 aren't prefixed with a quote
  if (typeof value === 'string' && /^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  if (
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\t')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Download selected features as a CSV file.
 */
export function exportToCSV(
  features: GeoJsonFeature[],
  allowedColumns?: string[],
  filename?: string,
): void {
  const { headers, rows } = featuresToRows(features, allowedColumns);
  const csvLines = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => headers.map(h => escapeCSV(row[h])).join(',')),
  ];
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
  triggerDownload(blob, filename ?? `lasso-selection-${timestamp()}.csv`);
}

// Cache the dynamic import so subsequent exports don't re-fetch the library
let xlsxModule: typeof import('xlsx') | null = null;

/**
 * Download selected features as an Excel (.xlsx) file.
 * xlsx is lazy-loaded to avoid adding to the initial bundle.
 */
export async function exportToExcel(
  features: GeoJsonFeature[],
  allowedColumns?: string[],
  filename?: string,
): Promise<void> {
  if (!xlsxModule) {
    xlsxModule = await import('xlsx');
  }
  const XLSX = xlsxModule;
  const { headers, rows } = featuresToRows(features, allowedColumns);
  const sanitizedRows = rows.map(row => {
    const sanitized: Record<string, any> = {};
    for (const key of headers) {
      sanitized[key] = sanitizeExcelValue(row[key]);
    }
    return sanitized;
  });
  const ws = XLSX.utils.json_to_sheet(sanitizedRows, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Lasso Selection');
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, filename ?? `lasso-selection-${timestamp()}.xlsx`);
}
