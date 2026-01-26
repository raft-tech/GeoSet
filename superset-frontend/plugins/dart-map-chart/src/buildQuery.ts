/* eslint-disable no-console */
import { buildQueryContext, QueryFormData } from '@superset-ui/core';

export default function buildQuery(formData: QueryFormData) {
  const geojsonCol =
    typeof formData.geojson === 'string'
      ? formData.geojson
      : formData.geojson?.column_name;

  if (!geojsonCol) {
    console.warn('Missing geojson column — skipping query.');
    return buildQueryContext(formData, () => []); // return no queries
  }

  // Parse geojsonConfig JSON blob safely
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
  const columns: any[] = [
    {
      label: 'geojson',
      sqlExpression: `ST_AsGeoJSON(${geojsonCol})`,
      expressionType: 'SQL',
    },
  ];

  // Add dimension column if defined
  if (dimension) {
    columns.push(dimension);
  }

  // Add js_columns for hover tooltip data
  if (formData.hoverDataColumns && Array.isArray(formData.hoverDataColumns)) {
    formData.hoverDataColumns.forEach((col: any) => {
      columns.push(col);
    });
  }

  // Add columns for Feature Info popup
  if (
    formData.featureInfoColumns &&
    Array.isArray(formData.featureInfoColumns)
  ) {
    formData.featureInfoColumns.forEach((col: any) => {
      // Avoid duplicates if column is already added via hoverDataColumns
      const colName = col.column_name || col.label || col;
      const alreadyAdded = columns.some((c: any) => {
        const existingName = c.column_name || c.label || c;
        return existingName === colName;
      });
      if (!alreadyAdded) {
        columns.push(col);
      }
    });
  }

  // Handle metric config properly
  const metricConfig = colorByValue.valueColumn;
  if (metricConfig) {
    columns.push(metricConfig);
  }

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
