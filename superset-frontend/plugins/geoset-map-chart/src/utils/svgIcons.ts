/* eslint-disable no-console */
import { loadSvgTemplate } from './svgIcons/index';

export class CustomSvg {
  fillHexColor: string;

  svg: string;

  width: number;

  height: number;

  constructor(fillHexColor: string, width = -1, height = -1) {
    this.fillHexColor = fillHexColor;
    this.width = width;
    this.height = height;
  }
}

// Caches generated SVG URLs so we don't regenerate them per feature
const svgCache = new Map<string, string>();
export class CircleSvg extends CustomSvg {
  constructor(fillHexColor: string, width = -1, height = -1) {
    super(fillHexColor, width, height);
    if (width === -1) {
      this.width = 26;
    }
    if (height === -1) {
      this.height = 26;
    }

    this.svg = loadSvgTemplate('circle', fillHexColor, this.width, this.height);
  }
}
export class PointSvg extends CustomSvg {
  constructor(fillHexColor: string, width = -1, height = -1) {
    super(fillHexColor, width, height);
    if (width === -1) {
      this.width = 128;
    }
    if (height === -1) {
      this.height = 128;
    }

    this.svg = loadSvgTemplate('point', fillHexColor, this.width, this.height);
  }
}

export class LineSvg extends CustomSvg {
  constructor(fillHexColor: string, width = -1, height = -1) {
    super(fillHexColor, width, height);
    if (width === -1) {
      this.width = 26;
    }
    if (height === -1) {
      this.height = 26;
    }

    this.svg = loadSvgTemplate('line', fillHexColor, this.width, this.height);
  }
}

export class MarkerSvg extends CustomSvg {
  constructor(fillHexColor: string, width = -1, height = -1) {
    super(fillHexColor, width, height);
    if (width === -1) {
      this.width = 128;
    }
    if (height === -1) {
      this.height = 128;
    }

    this.svg = loadSvgTemplate('marker', fillHexColor, this.width, this.height);
  }
}

export function getSvg(
  name: string,
  fillHexColor: string,
  width = -1,
  height = -1,
): string {
  switch (name) {
    case 'point':
      return new PointSvg(fillHexColor, width, height).svg;
    case 'line':
      return new LineSvg(fillHexColor, width, height).svg;
    case 'marker':
      return new MarkerSvg(fillHexColor, width, height).svg;
    default:
      return new CircleSvg(fillHexColor, width, height).svg;
  }
}

export function getColoredSvgUrl(iconName: string, rgba: number[]) {
  const [r, g, b, a] = rgba;
  const cacheKey = `${iconName}-${r}-${g}-${b}-${a}`;

  if (svgCache.has(cacheKey)) {
    return svgCache.get(cacheKey)!;
  }

  let svg =
    getSvg(iconName, `rgb(${r},${g},${b})`) ||
    getSvg('circle', `rgb(${r},${g},${b})`);

  // Inject fill-opacity from alpha channel
  svg = svg.replace(/<svg /, `<svg fill-opacity="${a / 255}" `);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  svgCache.set(cacheKey, url);
  return url;
}
