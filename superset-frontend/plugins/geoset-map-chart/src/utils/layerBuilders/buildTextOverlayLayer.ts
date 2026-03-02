import { TextLayer } from '@deck.gl/layers';
import { QueryFormData } from '@superset-ui/core';
import { GeoJsonFeature } from '../../types';

export interface TextOverlayStyle {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
}

interface TextOverlayParams {
  fd: QueryFormData;
  sortedFeatures: GeoJsonFeature[];
  fillColorArray: [number, number, number, number];
  baseLayerProps: Record<string, any>;
  textOverlayStyle?: TextOverlayStyle;
}

export function buildTextOverlayLayer({
  fd,
  sortedFeatures,
  fillColorArray,
  baseLayerProps,
  textOverlayStyle,
}: TextOverlayParams) {
  const textColumn =
    fd.textLabelColumn?.column_name ??
    fd.textLabelColumn?.label ??
    fd.textLabelColumn;

  if (!textColumn) {
    return null;
  }

  const style = textOverlayStyle ?? {};
  const baseFontFamily = style.fontFamily || 'Arial, sans-serif';
  const fontSize = style.fontSize ?? 14;
  const fontWeight = style.bold ? 'bold' : 'normal';

  // deck.gl TextLayer builds the font atlas via Canvas ctx.font, which
  // accepts the CSS font shorthand.  Prepending "italic" to the fontFamily
  // string is the supported way to get italic rendering.
  const fontFamily = style.italic ? `italic ${baseFontFamily}` : baseFontFamily;

  return new TextLayer({
    id: `text-overlay-layer-${fd.slice_id}`,
    data: sortedFeatures,
    getPosition: (f: any) => f.geometry?.coordinates,
    getText: (f: any) => String(f.properties?.[textColumn] ?? ''),
    getColor: (f: any) => f.color || fillColorArray,
    getSize: fontSize,
    sizeUnits: 'pixels',
    sizeMinPixels: 8,
    sizeMaxPixels: 128,
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    billboard: true,
    fontFamily,
    fontWeight,
    updateTriggers: {
      getText: [textColumn],
      getColor: [fillColorArray, sortedFeatures.length],
      getSize: [fontSize],
    },
    ...baseLayerProps,
  });
}
