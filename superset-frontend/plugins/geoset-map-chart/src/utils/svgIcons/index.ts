// SVGs in svgIcons/ are loaded as raw strings via webpack asset/source rule
import circleTemplate from './circle.svg';
import pointTemplate from './point.svg';
import markerTemplate from './marker.svg';
import squareTemplate from './square.svg';
import triangleTemplate from './triangle.svg';

// Map icon names to templates
const svgTemplates: Record<string, string> = {
  circle: circleTemplate,
  point: pointTemplate,
  marker: markerTemplate,
  square: squareTemplate,
  triangle: triangleTemplate,
};

/**
 * Load and process SVG template with dynamic color and dimensions
 * @param iconName - Name of the icon (circle, point, line, marker)
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

  // Replace dimensions on the root <svg> element only
  if (width !== undefined && height !== undefined) {
    svg = svg.replace(/^(<svg\s[^>]*?)width="[^"]+"/, `$1width="${width}"`);
    svg = svg.replace(/^(<svg\s[^>]*?)height="[^"]+"/, `$1height="${height}"`);
  }

  return svg;
}

export { svgTemplates };
