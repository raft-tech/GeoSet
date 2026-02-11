# SVG Icons

This folder contains the SVG icon files used as map point markers in GeoSet layers.
Icons support dynamic color injection at runtime via placeholder replacement.

## Current Icons

| Icon Name | File       | Default Size | Description          |
|-----------|------------|--------------|----------------------|
| circle    | circle.svg | 26x26        | Default circular marker |
| point     | point.svg  | 128x128      | Point marker         |
| marker    | marker.svg | 128x128      | Placemarker/pin icon |

## Adding a New Icon

There are two ways to add a new icon: using the Claude command or manually.

### Option A: Using the Claude Command

1. Drop your `.svg` file into this folder (`svgIcons/`)
2. Run the `/add-svg-icon` Claude command
3. The command will automatically:
   - Add `{{fillColor}}` placeholders to the primary shape elements
   - Register the import and template mapping in `index.ts`
   - Add the icon class and switch case in `svgIcons.ts`
4. Review the changes and rebuild

### Option B: Manual Steps

#### 1. Create the SVG File

Add your SVG file to this folder (`svgIcons/`). Use `{{fillColor}}` as a placeholder
anywhere you want dynamic color injection:

```svg
<!-- example: star.svg -->
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <polygon points="64,10 78,50 120,50 86,74 98,114 64,90 30,114 42,74 8,50 50,50"
    fill="{{fillColor}}" stroke="white" stroke-width="2"/>
</svg>
```

**Rules for SVG files:**
- Use `{{fillColor}}` for any color that should change dynamically
- Do NOT replace `fill` on decorative/structural elements (e.g., `fill="white"` for inner cutouts, `fill="none"` on the root `<svg>`, `fill="black"` with low `fill-opacity` for shadows, or `fill` inside `<mask>`, `<defs>`, `<clipPath>`)
- Set a default `width` and `height` on the root `<svg>` element (these get replaced at runtime when custom dimensions are provided)
- Keep the SVG self-contained (no external references)

#### 2. Register the Import in `index.ts`

Add an import and register it in the `svgTemplates` map:

```typescript
// Add the import (at the top with the other imports)
import starTemplate from './star.svg';

// Add to the svgTemplates map
const svgTemplates: Record<string, string> = {
  circle: circleTemplate,
  point: pointTemplate,
  marker: markerTemplate,
  star: starTemplate, // <-- add here
};
```

#### 3. Add an Icon Class in `svgIcons.ts`

In the parent file (`../svgIcons.ts`), create a new class extending `CustomSvg`
and add a case to the `getSvg()` switch statement:

```typescript
// Add the class
export class StarSvg extends CustomSvg {
  constructor(fillHexColor: string, width = -1, height = -1) {
    super(fillHexColor, width, height);
    if (width === -1) {
      this.width = 128; // match your SVG's default width
    }
    if (height === -1) {
      this.height = 128; // match your SVG's default height
    }

    this.svg = loadSvgTemplate('star', fillHexColor, this.width, this.height);
  }
}

// Add a case in getSvg()
export function getSvg(name: string, fillHexColor: string, width = -1, height = -1): string {
  switch (name) {
    case 'point':
      return new PointSvg(fillHexColor, width, height).svg;
    case 'marker':
      return new MarkerSvg(fillHexColor, width, height).svg;
    case 'star': // <-- add case
      return new StarSvg(fillHexColor, width, height).svg;
    default:
      return new CircleSvg(fillHexColor, width, height).svg;
  }
}
```

### 4. Rebuild

```bash
cd superset-frontend
npm run dev   # development
npm run build # production
```

## How It Works

1. SVG files are imported as raw text strings at build time via webpack's `asset/source` rule
2. At runtime, `loadSvgTemplate()` replaces `{{fillColor}}` placeholders with the actual color value
3. If custom width/height are provided, the `width` and `height` attributes on the root `<svg>` element are also replaced
4. The `getColoredSvgUrl()` function converts the processed SVG into a data URI for use as map marker icons
5. A cache (`svgCache`) prevents regenerating the same icon+color combination
