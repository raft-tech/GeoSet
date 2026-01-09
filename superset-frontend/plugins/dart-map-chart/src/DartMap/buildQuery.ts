import { buildQueryContext, QueryFormData } from '@superset-ui/core';

/**
 * buildQuery for the DartMap Multi chart.
 *
 * The Multi chart doesn't query data directly - it fetches data for each
 * subslice separately in Multi.tsx. But we need to return a valid query
 * so Superset's pipeline continues to transformProps and loadChart.
 */
export default function buildQuery(formData: QueryFormData) {
  // Return a minimal valid query - just select a literal 1
  // This satisfies the backend and allows the pipeline to continue
  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      columns: [
        {
          label: 'Dart MAP',
          sqlExpression: '1',
          expressionType: 'SQL',
        },
      ],
      metrics: [],
      groupby: [],
      row_limit: 1,
    },
  ]);
}
