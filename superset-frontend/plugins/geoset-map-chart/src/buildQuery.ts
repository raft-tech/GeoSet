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
  const metricColumn = colorByValue.valueColumn;
  const hoverCols = (formData.hoverDataColumns ?? []) as any[];
  const featureCols = (formData.featureInfoColumns ?? []) as any[];

  // Throw if duplicates within a column group
  const checkDupes = (cols: any[], label: string) => {
    const names = cols.map(c => (typeof c === 'string' ? c : c?.sqlExpression));
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    if (dupes.length) {
      throw new Error(
        `Duplicate columns in ${label}: ${[...new Set(dupes)].map(d => `"${d}"`).join(', ')}`,
      );
    }
  };
  checkDupes(hoverCols, 'Hover-Over Data');
  checkDupes(featureCols, 'Additional Details');

  // For Polygon layers, simplify geometry to reduce vertex count.
  // This dramatically improves deck.gl rendering performance for bordered
  // polygons by cutting tessellation work. Tolerance 0.001 ≈ 111 m at the equator.
  // The second arg to ST_AsGeoJSON limits coordinate decimal places (6 ≈ 0.1 m precision).
  const layerType = formData.geoJsonLayer || 'Polygon';
  const geojsonExpr =
    layerType === 'Polygon' || layerType === 'GeoJSON'
      ? `ST_AsGeoJSON(ST_SimplifyPreserveTopology(${geojsonCol}::geometry, 0.001), 6)`
      : `ST_AsGeoJSON(${geojsonCol}, 6)`;

  // Build columns array
  const columns: any[] = [
    {
      label: 'geojson',
      sqlExpression: geojsonExpr,
      expressionType: 'SQL',
    },
    dimension,
    ...hoverCols,
    ...featureCols,
    metricColumn,
  ].filter(Boolean);

  // Dedupe by label to prevent backend errors
  const seen = new Set<string>();
  const uniqueColumns = columns.filter(col => {
    const key =
      typeof col === 'string' ? col : col?.label || JSON.stringify(col);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      columns: uniqueColumns,
      metrics: [],
      groupby: [],
      row_limit: Number(formData.row_limit) || 10000,
    },
  ]);
}
