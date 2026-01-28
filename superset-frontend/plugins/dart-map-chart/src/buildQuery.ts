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

  // Helper to find all duplicates in an array
  const findDuplicates = (arr: string[]): string[] => [
    ...new Set(arr.filter((col, i) => arr.indexOf(col) !== i)),
  ];

  // Add hover tooltip columns
  const hoverCols = (formData.hoverDataColumns ?? []) as string[];
  const hoverDupes = findDuplicates(hoverCols);
  if (hoverDupes.length) {
    throw new Error(
      `Duplicate column labels in Hover-Over Data: ${hoverDupes.map(d => `"${d}"`).join(', ')}. Please make sure all columns have a unique label.`,
    );
  }
  columns.push(...hoverCols);

  // Add Feature Info popup columns
  const featureCols = (formData.featureInfoColumns ?? []) as string[];
  const featureDupes = findDuplicates(featureCols);
  if (featureDupes.length) {
    throw new Error(
      `Duplicate column labels in Additional Details: ${featureDupes.map(d => `"${d}"`).join(', ')}. Please make sure all columns have a unique label.`,
    );
  }
  const newFeatureCols = featureCols.filter(col => !hoverCols.includes(col));
  columns.push(...newFeatureCols);

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
