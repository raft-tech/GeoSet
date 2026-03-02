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

// Unicode Mathematical Alphanumeric Symbols for italic text.
// deck.gl's TextLayer doesn't support fontStyle, so we convert characters
// to their Unicode italic equivalents instead.
const ITALIC_UPPER_START = 0x1d434; // 𝐴
const ITALIC_LOWER_START = 0x1d44e; // 𝑎
const BOLD_ITALIC_UPPER_START = 0x1d468; // 𝑨
const BOLD_ITALIC_LOWER_START = 0x1d482; // 𝒂

// U+1D455 is reserved in Unicode; the italic lowercase 'h' lives at U+210E instead.
const ITALIC_H = 0x210e; // ℎ (Planck constant)

function toUnicodeStyle(text: string, bold: boolean, italic: boolean): string {
  if (!italic) return text;

  const upperStart = bold ? BOLD_ITALIC_UPPER_START : ITALIC_UPPER_START;
  const lowerStart = bold ? BOLD_ITALIC_LOWER_START : ITALIC_LOWER_START;

  let result = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      // A-Z
      result += String.fromCodePoint(upperStart + (code - 65));
    } else if (code >= 97 && code <= 122) {
      // a-z — handle the 'h' gap in the italic (non-bold) block
      if (!bold && code === 104) {
        result += String.fromCodePoint(ITALIC_H);
      } else {
        result += String.fromCodePoint(lowerStart + (code - 97));
      }
    } else {
      result += ch;
    }
  }
  return result;
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
  const fontFamily = style.fontFamily || 'Arial, sans-serif';
  const fontSize = style.fontSize ?? 14;
  const fontWeight = style.bold ? 'bold' : 'normal';
  const useItalic = style.italic ?? false;
  const useBold = style.bold ?? false;

  return new TextLayer({
    id: `text-overlay-layer-${fd.slice_id}`,
    data: sortedFeatures,
    getPosition: (f: any) => f.geometry?.coordinates,
    getText: (f: any) => {
      const raw = String(f.properties?.[textColumn] ?? '');
      return useItalic ? toUnicodeStyle(raw, useBold, true) : raw;
    },
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
    characterSet: 'auto',
    updateTriggers: {
      getText: [textColumn, useItalic, useBold],
      getColor: [fillColorArray, sortedFeatures.length],
      getSize: [fontSize],
    },
    ...baseLayerProps,
  });
}
