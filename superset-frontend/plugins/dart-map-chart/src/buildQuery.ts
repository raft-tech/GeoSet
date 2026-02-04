/* eslint-disable no-console */
import { buildQueryContext, QueryFormData } from '@superset-ui/core';

/** Extract column name from string or object format */
const getColName = (col: any): string =>
  typeof col === 'string' ? col : col?.sqlExpression || col?.column_name || '';

/** Throw if duplicate column names exist in the array */
const assertNoDuplicates = (cols: any[], label: string): void => {
  const names = cols.map(getColName).filter(Boolean);
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const name of names) {
    if (seen.has(name)) dupes.push(name);
    seen.add(name);
  }
  if (dupes.length) {
    throw new Error(
      `Duplicate columns in ${label}: ${[...new Set(dupes)].map(d => `"${d}"`).join(', ')}. ` +
        'Please remove duplicate columns.',
    );
  }
};

/**
 * Builds the query for the DART Map chart.
 */
export default function buildQuery(formData: QueryFormData) {
  const geojsonCol =
    typeof formData.geojson === 'string'
      ? formData.geojson
      : formData.geojson?.column_name;

  if (!geojsonCol) {
    console.warn('Missing geojson column — skipping query.');
    return buildQueryContext(formData, () => []);
  }

  // Parse geojsonConfig JSON blob
  let geojsonConfig: any = {};
  try {
    geojsonConfig =
      typeof formData.geojsonConfig === 'string'
        ? JSON.parse(formData.geojsonConfig)
        : formData.geojsonConfig || {};
  } catch (err) {
    console.warn('[GeoJSON] Invalid geojsonConfig JSON:', err);
  }

  const colorByCategory = geojsonConfig?.colorByCategory ?? {};
  const colorByValue = geojsonConfig?.colorByValue ?? {};
  const dimension = colorByCategory.dimension || formData.dimension;
  const metricColumn = colorByValue.valueColumn;
  const hoverCols = (formData.hoverDataColumns ?? []) as string[];
  const featureCols = (formData.featureInfoColumns ?? []) as string[];

  // Validate no duplicates within each column group
  assertNoDuplicates(hoverCols, 'Hover-Over Data');
  assertNoDuplicates(featureCols, 'Additional Details');

  // Collect all columns, then dedupe (preserves first occurrence, avoids backend error querying same column)
  const allCols = [
    dimension,
    ...hoverCols,
    ...featureCols,
    metricColumn,
  ].filter(Boolean);
  const uniqueCols = [...new Set(allCols)];

  const columns: any[] = [
    {
      label: 'geojson',
      sqlExpression: `ST_AsGeoJSON(${geojsonCol})`,
      expressionType: 'SQL',
    },
    ...uniqueCols,
  ];

  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      columns,
      metrics: [],
      groupby: [],
      row_limit: Number(formData.row_limit) || 10000,
    },
  ]);
}
