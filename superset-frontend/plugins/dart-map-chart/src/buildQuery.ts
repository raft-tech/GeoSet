/* eslint-disable no-console */
import { buildQueryContext, QueryFormData } from '@superset-ui/core';

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

  // Collect all columns, then dedupe (preserves first occurrence)
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
