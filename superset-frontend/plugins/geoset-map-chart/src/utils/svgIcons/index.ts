/* eslint-disable import/no-webpack-loader-syntax */
// Import SVG files as raw text strings using require for better compatibility
const circleTemplate: string =
  require('!!raw-loader!./circle.svg').default ||
  require('!!raw-loader!./circle.svg');
const pointTemplate: string =
  require('!!raw-loader!./point.svg').default ||
  require('!!raw-loader!./point.svg');
const lineTemplate: string =
  require('!!raw-loader!./line.svg').default ||
  require('!!raw-loader!./line.svg');
const markerTemplate: string =
  require('!!raw-loader!./marker.svg').default ||
  require('!!raw-loader!./marker.svg');

// Map icon names to templates
const svgTemplates: Record<string, string> = {
  circle: circleTemplate,
  point: pointTemplate,
  line: lineTemplate,
  marker: markerTemplate,
};

/**
 * Load and process SVG template with dynamic color and dimensions
 * @param iconName - Name of the icon (circle, fema, fire, point, line, marker)
 * @param fillColor - Color to inject into the SVG (e.g., "#ff0000" or "rgb(255,0,0)")
 * @param width - Optional width to replace in the SVG
 * @param height - Optional height to replace in the SVG
 * @returns Processed SVG string with color and dimensions injected
 */
export function loadSvgTemplate(
  iconName: string,
  fillColor: string,
  width?: number,
  height?: number,
): string {
  const template = svgTemplates[iconName];
  if (!template) {
    throw new Error(`SVG template not found: ${iconName}`);
  }

  let svg = template;

  // Replace color placeholder
  svg = svg.replace(/\{\{fillColor\}\}/g, fillColor);

  // Replace dimensions if provided
  if (width !== undefined && height !== undefined) {
    svg = svg.replace(/width="[^"]+"/g, `width="${width}"`);
    svg = svg.replace(/height="[^"]+"/g, `height="${height}"`);
  }

  return svg;
}

export { svgTemplates };
