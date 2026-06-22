import {
  featuresToRows,
  escapeCSV,
  sanitizeExcelValue,
} from '../../src/utils/lassoExport';
import type { GeoJsonFeature } from '../../src/types';

describe('escapeCSV', () => {
  it('returns plain strings unchanged', () => {
    expect(escapeCSV('hello')).toBe('hello');
  });

  it('wraps strings with commas in quotes', () => {
    expect(escapeCSV('a,b')).toBe('"a,b"');
  });

  it('escapes embedded double quotes', () => {
    expect(escapeCSV('say "hi"')).toBe('"say ""hi"""');
  });

  it('wraps strings with newlines', () => {
    expect(escapeCSV('line1\nline2')).toBe('"line1\nline2"');
  });

  it('converts null/undefined to empty string', () => {
    expect(escapeCSV(null)).toBe('');
    expect(escapeCSV(undefined)).toBe('');
  });

  it('converts numbers to strings', () => {
    expect(escapeCSV(42)).toBe('42');
  });

  it('does not prefix negative numbers with a quote', () => {
    expect(escapeCSV(-5.2)).toBe('-5.2');
    expect(escapeCSV(-100)).toBe('-100');
  });

  it('prepends single quote for formula injection characters in strings', () => {
    expect(escapeCSV('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(escapeCSV('+cmd')).toBe("'+cmd");
    expect(escapeCSV('-exec')).toBe("'-exec");
    expect(escapeCSV('@import')).toBe("'@import");
  });

  it('wraps strings with tabs in quotes', () => {
    expect(escapeCSV('col1\tcol2')).toBe('"col1\tcol2"');
  });

  it('handles formula characters combined with commas', () => {
    // Should both prepend quote AND wrap in double quotes
    expect(escapeCSV('=SUM(A1),B2')).toBe("\"'=SUM(A1),B2\"");
  });
});

describe('sanitizeExcelValue', () => {
  it('returns non-string values unchanged', () => {
    expect(sanitizeExcelValue(42)).toBe(42);
    expect(sanitizeExcelValue(null)).toBe(null);
    expect(sanitizeExcelValue(undefined)).toBe(undefined);
    expect(sanitizeExcelValue(true)).toBe(true);
  });

  it('returns safe strings unchanged', () => {
    expect(sanitizeExcelValue('hello')).toBe('hello');
    expect(sanitizeExcelValue('123')).toBe('123');
  });

  it('prefixes formula-trigger characters with a single quote', () => {
    expect(sanitizeExcelValue('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(sanitizeExcelValue('+cmd')).toBe("'+cmd");
    expect(sanitizeExcelValue('-exec')).toBe("'-exec");
    expect(sanitizeExcelValue('@import')).toBe("'@import");
  });

  it('does not prefix negative numbers', () => {
    expect(sanitizeExcelValue(-5.2)).toBe(-5.2);
    expect(sanitizeExcelValue(-100)).toBe(-100);
  });
});

describe('featuresToRows', () => {
  const features: GeoJsonFeature[] = [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-77.0, 38.9] },
      properties: { name: 'DC', population: 700000 },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.4, 37.8] },
      properties: { name: 'SF', elevation: 16 },
    },
  ];

  it('returns sorted union of all property keys as headers', () => {
    const { headers } = featuresToRows(features);
    expect(headers).toEqual([
      '_geometry_type',
      '_longitude',
      '_latitude',
      'elevation',
      'name',
      'population',
    ]);
  });

  it('fills missing properties with empty string', () => {
    const { rows } = featuresToRows(features);
    expect(rows[0].elevation).toBe('');
    expect(rows[1].population).toBe('');
  });

  it('includes geometry metadata columns', () => {
    const { rows } = featuresToRows(features);
    expect(rows[0]._geometry_type).toBe('Point');
    expect(rows[0]._longitude).toBe(-77.0);
    expect(rows[0]._latitude).toBe(38.9);
  });

  it('returns empty headers (except meta) for features with no properties', () => {
    const bare: GeoJsonFeature[] = [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: {},
      },
    ];
    const { headers } = featuresToRows(bare);
    expect(headers).toEqual(['_geometry_type', '_longitude', '_latitude']);
  });

  it('returns empty rows for empty input', () => {
    const { rows, headers } = featuresToRows([]);
    expect(rows).toEqual([]);
    expect(headers).toEqual(['_geometry_type', '_longitude', '_latitude']);
  });
});
