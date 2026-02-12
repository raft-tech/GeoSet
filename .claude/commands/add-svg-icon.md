# Add SVG Icon

Process a newly added SVG file in `superset-frontend/plugins/geoset-map-chart/src/utils/svgIcons/` so it works with the dynamic icon system.

## What to do

1. **Find the new SVG file(s)** in the `svgIcons/` folder that are not yet registered in `index.ts`. Compare the `.svg` files on disk against the imports in `superset-frontend/plugins/geoset-map-chart/src/utils/svgIcons/index.ts`.

2. **Add `{{fillColor}}` placeholders** to the new SVG file(s):
   - Replace any hardcoded `fill="..."` color values on the **primary shape elements** (paths, circles, rects, polygons) with `fill="{{fillColor}}"`. These are the elements that should change color dynamically.
   - Do NOT replace `fill` on decorative/structural elements like: `fill="white"` for inner cutouts, `fill="none"` on the root `<svg>`, `fill="black"` with low `fill-opacity` for shadows, or `fill="white"` inside `<mask>`, `<defs>`, `<clipPath>`.
   - Look at the existing icons (circle.svg, point.svg, marker.svg) for examples of the pattern.

3. **Register the new icon** in `superset-frontend/plugins/geoset-map-chart/src/utils/svgIcons/index.ts`:
   - Add an import statement: `import <name>Template from './<name>.svg';`
   - Add an entry to the `svgTemplates` map: `<name>: <name>Template,`

4. **Register the icon class** in `superset-frontend/plugins/geoset-map-chart/src/utils/svgIcons.ts`:
   - Add a new class extending `CustomSvg` following the pattern of existing classes (CircleSvg, PointSvg, MarkerSvg).
   - Set appropriate default width/height based on the SVG's `width` and `height` attributes.
   - Add a case to the `getSvg()` switch statement.

5. **Show a summary** of all changes made.
