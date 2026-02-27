import { TextLayer } from '@deck.gl/layers';
import { QueryFormData } from '@superset-ui/core';
import { GeoJsonFeature } from '../../types';

interface TextOverlayParams {
  fd: QueryFormData;
  sortedFeatures: GeoJsonFeature[];
  fillColorArray: [number, number, number, number];
  baseLayerProps: Record<string, any>;
}

export function buildTextOverlayLayer({
  fd,
  sortedFeatures,
  fillColorArray,
  baseLayerProps,
}: TextOverlayParams) {
  const textColumn =
    fd.textLabelColumn?.column_name ??
    fd.textLabelColumn?.label ??
    fd.textLabelColumn;

  if (!textColumn) {
    return null;
  }

  return new TextLayer({
    id: `text-overlay-layer-${fd.slice_id}`,
    data: sortedFeatures,
    getPosition: (f: any) => f.geometry?.coordinates,
    getText: (f: any) => String(f.properties?.[textColumn] ?? ''),
    getColor: (f: any) => f.color || fillColorArray,
    getSize: 14,
    sizeUnits: 'pixels',
    sizeMinPixels: 8,
    sizeMaxPixels: 64,
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    billboard: true,
    fontFamily: 'Arial, sans-serif',
    updateTriggers: {
      getText: [textColumn],
      getColor: [fillColorArray, sortedFeatures.length],
    },
    ...baseLayerProps,
  });
}
