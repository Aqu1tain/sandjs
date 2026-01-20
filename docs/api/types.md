# Type Definitions

[← Back to Documentation](../README.md)

Complete TypeScript type definitions for Sand.js.

## Core Configuration Types

### SunburstConfig

```typescript
interface SunburstConfig {
  size: SunburstSize;
  layers: LayerConfig[];
}
```

[Full Documentation →](./sunburst-config.md)

### SunburstSize

```typescript
interface SunburstSize {
  radius: number;
  angle?: number;  // Default: 2π
}
```

### LayerConfig

```typescript
interface LayerConfig {
  id: string;
  radialUnits: [number, number];
  angleMode: 'free' | 'align';
  tree: TreeNodeInput | TreeNodeInput[];

  alignWith?: string;
  padAngle?: number;
  baseOffset?: number;
  arcOffsetMode?: 'relative' | 'absolute';
  defaultArcOffset?: number;
}
```

[Full Documentation →](./layer-config.md)

### TreeNodeInput

```typescript
interface TreeNodeInput {
  name: string;
  value?: number;
  key?: string;
  expandLevels?: number;
  offset?: number;
  color?: string;
  padAngle?: number;
  children?: TreeNodeInput[];
  tooltip?: string;
  collapsed?: boolean;
  hidden?: boolean;

  [key: string]: any;  // Allow custom properties
}
```

[Full Documentation →](./tree-node-input.md)

### AngleMode

```typescript
type AngleMode = 'free' | 'align';
```

## Layout Types

### LayoutArc

Computed arc with geometry:

```typescript
interface LayoutArc {
  layerId: string;
  data: TreeNodeInput;
  x0: number;             // Start angle (radians)
  x1: number;             // End angle (radians)
  y0: number;             // Inner radius (pixels)
  y1: number;             // Outer radius (pixels)
  depth: number;          // Hierarchical depth
  key?: string;           // Node key
  value: number;          // Computed or explicit value
  path: TreeNodeInput[];  // Path from root to this node
  pathIndices: number[];  // Index at each depth level
  percentage: number;     // Percentage of parent
}
```

## Render Types

### RenderSvgOptions

```typescript
interface RenderSvgOptions {
  el: SVGElement | string;

  // Configuration (choose one approach)
  config?: SunburstConfig;                    // Full configuration (advanced)
  data?: TreeNodeInput | TreeNodeInput[];     // Simple tree data (creates default layer)
  radius?: number;                            // Required when using `data`
  angle?: number;                             // Total angle in radians (default: 2π)

  document?: Document;
  colorTheme?: ColorThemeOptions;
  classForArc?: (arc: LayoutArc) => string | string[] | undefined;
  decoratePath?: (path: SVGPathElement, arc: LayoutArc) => void;
  tooltip?: boolean | TooltipOptions;
  highlightByKey?: boolean | HighlightByKeyOptions;
  breadcrumbs?: boolean | BreadcrumbOptions;
  transition?: boolean | TransitionOptions;
  navigation?: boolean | NavigationOptions;
  labels?: boolean | LabelOptions;
  debug?: boolean;

  onArcEnter?: (payload: ArcPointerEventPayload) => void;
  onArcMove?: (payload: ArcPointerEventPayload) => void;
  onArcLeave?: (payload: ArcPointerEventPayload) => void;
  onArcClick?: (payload: ArcClickEventPayload) => void;
}
```

### RenderHandle

```typescript
interface RenderHandle extends Array<LayoutArc> {
  update(input: RenderSvgUpdateInput): RenderHandle;
  destroy(): void;
  getOptions(): RenderSvgOptions;
  resetNavigation?: () => void;
}
```

### RenderSvgUpdateInput

```typescript
type RenderSvgUpdateInput = SunburstConfig | RenderSvgUpdateOptions;

interface RenderSvgUpdateOptions extends Partial<Omit<RenderSvgOptions, 'el'>> {
  config?: SunburstConfig;
}
```

## Feature Option Types

### TooltipOptions

```typescript
interface TooltipOptions {
  formatter?: (arc: LayoutArc) => string;
  container?: HTMLElement | string;
}
```

### BreadcrumbOptions

```typescript
interface BreadcrumbOptions {
  container?: HTMLElement | string;
  formatter?: (arc: LayoutArc) => string;
  separator?: string;
  emptyLabel?: string;
  interactive?: boolean;
}
```

### BreadcrumbTrailItem

```typescript
interface BreadcrumbTrailItem {
  id: string;
  label: string;
  active: boolean;
  arcIdentifier?: string;
  onSelect?: () => void;
}
```

### HighlightByKeyOptions

```typescript
interface HighlightByKeyOptions {
  className?: string;
  includeSource?: boolean;
  deriveKey?: (arc: LayoutArc) => string | null;
  pinOnClick?: boolean;
  pinClassName?: string;
  onPinChange?: (payload: {
    arc: LayoutArc;
    path: SVGPathElement;
    pinned: boolean;
    event: MouseEvent;
  }) => void;
}
```

### NavigationOptions

```typescript
interface NavigationOptions {
  layers?: string[];
  rootLabel?: string;
  onFocusChange?: (focus: NavigationFocusState | null) => void;
  focusTransition?: boolean | TransitionOptions;
}
```

### NavigationFocusState

```typescript
interface NavigationFocusState {
  layerId: string;
  path: LayoutArc['path'];
  pathIndices: number[];
  arc?: LayoutArc;
}
```

### TransitionOptions

```typescript
interface TransitionOptions {
  duration?: number;                        // Milliseconds
  easing?: (t: number) => number;          // Easing function
  delay?: number;                          // Milliseconds
}
```

## Color Theme Types

### ColorThemeOptions

```typescript
interface ColorThemeOptions {
  type: 'qualitative' | 'sequential' | 'diverging';
  palette: QualitativePaletteName | SequentialPaletteName | DivergingPaletteName | ColorPalette;
  assignBy?: 'key' | 'depth' | 'index' | 'value';
  deriveKey?: (arc: LayoutArc) => string | number;
}
```

### Palette Names

```typescript
type QualitativePaletteName =
  | 'default'
  | 'pastel'
  | 'vibrant'
  | 'earth'
  | 'ocean'
  | 'sunset';

type SequentialPaletteName =
  | 'blues'
  | 'greens'
  | 'purples'
  | 'oranges';

type DivergingPaletteName =
  | 'redBlue'
  | 'orangePurple'
  | 'greenRed';
```

### ColorPalette

```typescript
type ColorPalette = string[];  // Array of CSS color strings
```

## Event Payload Types

### ArcPointerEventPayload

```typescript
interface ArcPointerEventPayload {
  arc: LayoutArc;
  path: SVGPathElement;
  event: PointerEvent;
}
```

### ArcClickEventPayload

```typescript
interface ArcClickEventPayload {
  arc: LayoutArc;
  path: SVGPathElement;
  event: MouseEvent;
}
```

## Usage Example

```typescript
import {
  renderSVG,
  layout,
  SunburstConfig,
  LayerConfig,
  TreeNodeInput,
  LayoutArc,
  RenderHandle,
  RenderSvgOptions,
  ColorThemeOptions,
  NavigationOptions,
  TooltipOptions
} from '@akitain/sandjs';

const config: SunburstConfig = {
  size: {
    radius: 200,
    angle: Math.PI * 2
  },
  layers: [
    {
      id: 'main',
      radialUnits: [0, 2],
      angleMode: 'free',
      tree: [
        { name: 'A', value: 50, key: 'a' },
        { name: 'B', value: 50, key: 'b' }
      ]
    }
  ]
};

const options: RenderSvgOptions = {
  el: '#chart',
  config,
  tooltip: true,
  navigation: {
    rootLabel: 'Home'
  },
  colorTheme: {
    type: 'qualitative',
    palette: 'ocean',
    assignBy: 'key'
  }
};

const chart: RenderHandle = renderSVG(options);

// Layout only
const arcs: LayoutArc[] = layout(config);
```

---

[← Back to Documentation](../README.md)
