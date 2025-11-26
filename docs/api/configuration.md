# Configuration Reference

[← Back to Documentation](../README.md)

Complete reference for all configuration options in Sand.js.

## Table of Contents

- [SunburstConfig](#sunburstconfig)
- [SunburstSize](#sunburstsize)
- [LayerConfig](#layerconfig)
- [TreeNodeInput](#treenodeinput)
- [RenderSvgOptions](#rendersvgoptions)

---

## SunburstConfig

The root configuration object for your sunburst chart.

### Type Definition

```typescript
interface SunburstConfig {
  size: SunburstSize;
  layers: LayerConfig[];
}
```

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `size` | `SunburstSize` | Yes | Overall chart dimensions |
| `layers` | `LayerConfig[]` | Yes | Array of layer configurations |

### Example

```javascript
const config = {
  size: {
    radius: 300,
    angle: Math.PI * 2
  },
  layers: [
    {
      id: 'main',
      radialUnits: [0, 2],
      angleMode: 'free',
      tree: [...]
    }
  ]
};
```

### Related

- [SunburstSize](#sunburstsize) - Size configuration details
- [LayerConfig](#layerconfig) - Layer configuration details

---

## SunburstSize

Defines the overall dimensions of the sunburst chart.

### Type Definition

```typescript
interface SunburstSize {
  radius: number;
  angle?: number;
}
```

### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `radius` | `number` | Yes | - | Final radius in pixels |
| `angle` | `number` | No | `2π` | Total angle in radians |

### Radius

The `radius` property sets the maximum radius of the chart in pixels.

```javascript
size: {
  radius: 200  // Chart will be 400x400 pixels (diameter)
}
```

**Constraints:**
- Must be a positive number
- Determines the outer edge of the chart
- All radial calculations scale to this value

### Angle

The `angle` property allows partial sunbursts (e.g., semi-circles, quarter circles).

```javascript
// Full circle (default)
size: {
  radius: 200,
  angle: Math.PI * 2  // 360 degrees
}

// Semi-circle
size: {
  radius: 200,
  angle: Math.PI  // 180 degrees
}

// Quarter circle
size: {
  radius: 200,
  angle: Math.PI / 2  // 90 degrees
}

// Three-quarters
size: {
  radius: 200,
  angle: Math.PI * 1.5  // 270 degrees
}
```

**Constraints:**
- Must be positive
- Measured in radians (not degrees)
- Typically between `0` and `2π`
- Values > `2π` will overlap

**Use Cases:**
- Gauge charts (180° or 270°)
- Dashboard widgets (90° corners)
- Artistic layouts

---

## LayerConfig

Configuration for a single layer in the sunburst.

### Type Definition

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

### Required Properties

#### id

Unique identifier for the layer.

```javascript
{
  id: 'main-layer'
}
```

**Constraints:**
- Must be unique across all layers
- Used for alignment references
- String type

#### radialUnits

Defines the radial range as `[inner, outer]` in abstract units.

```javascript
{
  radialUnits: [0, 2]  // From center (0) to 2 units out
}
```

**How it works:**
```javascript
// The layout engine calculates actual pixels:
actualInnerRadius = (radialUnits[0] / maxUnit) * size.radius
actualOuterRadius = (radialUnits[1] / maxUnit) * size.radius

// Example with radius: 300, radialUnits: [0, 2], maxUnit: 3
innerRadius = (0 / 3) * 300 = 0    // Center
outerRadius = (2 / 3) * 300 = 200  // 2/3 of total radius
```

**Constraints:**
- Both values must be non-negative
- `radialUnits[1]` must be greater than `radialUnits[0]`
- Units are relative (not pixels)

**Common patterns:**
```javascript
// Single layer, full radius
radialUnits: [0, 1]

// Three equal layers
// Layer 1: [0, 1]
// Layer 2: [1, 2]
// Layer 3: [2, 3]

// Inner donut hole
radialUnits: [1, 3]  // Leaves center empty
```

#### angleMode

Determines how angular space is distributed.

```javascript
{
  angleMode: 'free'  // or 'align'
}
```

**Values:**

**'free'**: Arcs sized proportionally to their values
```javascript
{
  angleMode: 'free',
  tree: [
    { name: 'A', value: 25 },  // Gets 25% of available angle
    { name: 'B', value: 75 }   // Gets 75% of available angle
  ]
}
```

**'align'**: Arcs aligned to keys in another layer
```javascript
{
  angleMode: 'align',
  alignWith: 'base-layer',  // Required when mode is 'align'
  tree: [
    { name: 'Detail', key: 'cat-a', value: 30 }
    // Appears within the angular span of the arc with key 'cat-a' in 'base-layer'
  ]
}
```

See [Layout Modes Guide](../guides/layout-modes.md) for detailed explanation.

#### tree

The data nodes for this layer.

```javascript
// Single root node
{
  tree: {
    name: 'Root',
    children: [...]
  }
}

// Multiple root nodes
{
  tree: [
    { name: 'Node 1', value: 50 },
    { name: 'Node 2', value: 50 }
  ]
}
```

See [TreeNodeInput](#treenodeinput) for node structure.

### Optional Properties

#### alignWith

Reference layer ID when `angleMode` is `'align'`.

```javascript
{
  id: 'detail-layer',
  angleMode: 'align',
  alignWith: 'main-layer',  // Must match another layer's id
  tree: [...]
}
```

**Constraints:**
- Required when `angleMode` is `'align'`
- Must reference an existing layer ID
- Referenced layer must be processed first (appear earlier in array)

#### padAngle

Gap between sibling arcs in radians.

```javascript
{
  padAngle: 0.02  // Small gap between arcs
}
```

**Effect:**
```javascript
// Without padding
padAngle: 0
// Arcs are adjacent: |AAA||BBB||CCC|

// With padding
padAngle: 0.02
// Arcs have gaps: |AAA| |BBB| |CCC|
```

**Constraints:**
- Must be non-negative
- Too large values will cause arcs to shrink significantly
- Measured in radians

**Typical values:**
- `0.01` - Subtle separation
- `0.02` - Visible gaps
- `0.05` - Large gaps

#### baseOffset

Global rotation for the entire layer in radians.

```javascript
{
  baseOffset: Math.PI / 2  // Rotate layer 90 degrees
}
```

**Effect:**
- Rotates all arcs in the layer
- Applied before individual arc offsets
- Positive = counter-clockwise
- Negative = clockwise

**Common uses:**
```javascript
// Start at top instead of right
baseOffset: -Math.PI / 2

// Start at left
baseOffset: Math.PI

// Start at bottom
baseOffset: Math.PI / 2
```

#### arcOffsetMode

How arc offsets are calculated.

```javascript
{
  arcOffsetMode: 'relative'  // or 'absolute'
}
```

**Values:**

**'relative'** (default): Offset as fraction of arc's angular span
```javascript
{
  arcOffsetMode: 'relative',
  tree: [
    {
      name: 'Arc',
      value: 100,  // Spans 1.0 radians
      offset: 0.1  // Shift by 0.1 * 1.0 = 0.1 radians
    }
  ]
}
```

**'absolute'**: Offset in literal radians
```javascript
{
  arcOffsetMode: 'absolute',
  tree: [
    {
      name: 'Arc',
      value: 100,  // Spans 1.0 radians
      offset: 0.1  // Shift by exactly 0.1 radians
    }
  ]
}
```

#### defaultArcOffset

Default offset applied to all arcs in the layer.

```javascript
{
  defaultArcOffset: 0.05,  // All arcs shifted by default
  tree: [
    { name: 'A', value: 50 },  // Uses defaultArcOffset
    { name: 'B', value: 50, offset: 0.1 }  // Overrides with own offset
  ]
}
```

**Interaction with node offset:**
- If node has `offset`, it overrides `defaultArcOffset`
- If node has no `offset`, `defaultArcOffset` is used
- Affected by `arcOffsetMode`

---

## TreeNodeInput

Represents a single data node in your hierarchy.

### Type Definition

```typescript
interface TreeNodeInput {
  name: string;
  value: number;

  key?: string;
  expandLevels?: number;
  offset?: number;
  color?: string;
  children?: TreeNodeInput[];
  tooltip?: string;
  collapsed?: boolean;
  hidden?: boolean;
}
```

### Required Properties

#### name

Display label for the node.

```javascript
{
  name: 'Engineering Department'
}
```

**Used in:**
- Tooltips
- Labels
- Breadcrumbs
- Accessibility attributes

#### value

Numeric weight/size of the node.

```javascript
// Leaf node: explicit value
{
  name: 'Team A',
  value: 15
}

// Parent node: auto-calculated (don't set value)
{
  name: 'Department',
  children: [
    { name: 'Team A', value: 15 },
    { name: 'Team B', value: 10 }
  ]
  // Effective value: 25 (auto-summed)
}
```

**Constraints:**
- Must be positive number
- For leaf nodes: required and explicit
- For parent nodes: auto-calculated from children (don't set)

### Optional Properties

#### key

Stable identifier for alignment, coloring, and highlighting.

```javascript
{
  name: 'Engineering',
  key: 'dept-engineering',
  value: 100
}
```

**Used for:**
- Cross-layer alignment (align mode)
- Consistent coloring (when `assignBy: 'key'`)
- Highlighting related arcs
- Smooth transitions/animations

**Best practices:**
- Use stable, semantic strings
- Keep consistent across updates
- Don't use random or time-based values

```javascript
// Good
key: 'category-books'
key: 'user-12345'
key: 'q1-2024'

// Bad
key: Math.random().toString()
key: Date.now().toString()
key: '1'  // Too generic
```

#### expandLevels

Number of rings this node spans radially.

```javascript
{
  name: 'Wide Arc',
  expandLevels: 2,  // Spans 2 rings instead of 1
  value: 50
}
```

**Default:** `1`

**Effect:**
- `1` - Normal thickness (default)
- `2` - Spans two rings
- `3` - Spans three rings, etc.

**Constraints:**
- Must be positive integer
- Cannot exceed available radial space

**Use cases:**
- Emphasize important categories
- Create visual hierarchy
- Design aesthetic effects

#### offset

Individual angular offset for this arc.

```javascript
{
  name: 'Offset Arc',
  offset: 0.1,  // Interpretation depends on arcOffsetMode
  value: 50
}
```

**Interpretation:**
- If `arcOffsetMode: 'relative'`: fraction of arc's span
- If `arcOffsetMode: 'absolute'`: radians

**Examples:**
```javascript
// Relative mode (default)
{
  arcOffsetMode: 'relative',
  tree: [{
    name: 'Arc',
    value: 100,  // Spans 0.5 radians
    offset: 0.2  // Shift by 0.2 * 0.5 = 0.1 radians
  }]
}

// Absolute mode
{
  arcOffsetMode: 'absolute',
  tree: [{
    name: 'Arc',
    value: 100,
    offset: 0.1  // Shift by exactly 0.1 radians
  }]
}
```

#### color

Custom color override for this arc.

```javascript
{
  name: 'Special Arc',
  color: '#ff6b6b',
  value: 50
}
```

**Format:**
- Any valid CSS color string
- Examples: `'#ff6b6b'`, `'rgb(255, 107, 107)'`, `'red'`, `'hsl(0, 100%, 70%)'`

**Behavior:**
- Overrides theme color
- Applied to SVG fill attribute
- Also used for labels if applicable

#### children

Nested child nodes for hierarchical structure.

```javascript
{
  name: 'Parent',
  children: [
    {
      name: 'Child 1',
      value: 30
    },
    {
      name: 'Child 2',
      value: 20,
      children: [
        { name: 'Grandchild', value: 20 }
      ]
    }
  ]
}
```

**Behavior:**
- Children appear in deeper rings
- Parent value is auto-summed from children
- Depth increases by 1 for each level
- Can be nested arbitrarily deep

**Constraints:**
- Must be an array (even for single child)
- Each child must be valid TreeNodeInput

#### tooltip

Custom tooltip content for this node.

```javascript
{
  name: 'Engineering',
  value: 100,
  tooltip: 'Total headcount: 100 employees\nBudget: $5M'
}
```

**Behavior:**
- Overrides default tooltip formatter
- Shown on hover (if tooltips enabled)
- Can include HTML if formatter supports it

**Default behavior without custom tooltip:**
```
Name: Engineering
Value: 100
Percentage: 33.3%
```

#### collapsed

Hide children while preserving their contribution to parent value.

```javascript
{
  name: 'Department',
  collapsed: true,
  children: [
    { name: 'Team 1', value: 30 },
    { name: 'Team 2', value: 20 }
  ]
  // Parent shows value of 50, children are not rendered
}
```

**Effect:**
- Parent arc rendered with full value (50 in example)
- Children are not rendered as separate arcs
- Children's values still contribute to parent

**Use cases:**
- Simplify complex hierarchies
- Progressive disclosure
- Focus on high-level view

#### hidden

Completely hide this node from layout.

```javascript
{
  name: 'Hidden',
  hidden: true,
  value: 100
  // Not rendered, value doesn't contribute to anything
}
```

**Effect:**
- Node not rendered
- Value doesn't contribute to parent
- Siblings unaffected

**Difference from collapsed:**
- `collapsed`: Hides children, keeps value
- `hidden`: Removes node entirely

---

## RenderSvgOptions

Options passed to the `renderSVG()` function.

### Type Definition

```typescript
interface RenderSvgOptions {
  el: string | SVGElement;
  config: SunburstConfig;

  tooltip?: boolean | TooltipOptions;
  breadcrumbs?: boolean | BreadcrumbOptions;
  highlightByKey?: boolean | HighlightByKeyOptions;
  navigation?: boolean | NavigationOptions;
  transition?: boolean | TransitionOptions;
  labels?: boolean | LabelOptions;
  colorTheme?: ColorThemeOptions;

  borderColor?: string;
  borderWidth?: number;

  onArcEnter?: (payload: ArcPointerEventPayload) => void;
  onArcMove?: (payload: ArcPointerEventPayload) => void;
  onArcLeave?: (payload: ArcPointerEventPayload) => void;
  onArcClick?: (payload: ArcClickEventPayload) => void;

  debug?: boolean;
}
```

### Required Properties

#### el

Target SVG element or selector.

```javascript
// CSS selector
renderSVG({ el: '#my-chart', config });

// Direct element reference
const svg = document.querySelector('#my-chart');
renderSVG({ el: svg, config });
```

#### config

Sunburst configuration object.

```javascript
renderSVG({
  el: '#chart',
  config: {
    size: { radius: 200 },
    layers: [...]
  }
});
```

See [SunburstConfig](#sunburstconfig) for details.

### Feature Options

#### tooltip

Enable tooltips on hover.

```javascript
// Simple enable
tooltip: true

// Custom options
tooltip: {
  formatter: (arc) => `<b>${arc.data.name}</b><br>Value: ${arc.data.value}`,
  container: '#tooltip-container'
}
```

See [Tooltips Guide](../guides/tooltips.md) for details.

#### breadcrumbs

Enable navigation breadcrumbs.

```javascript
// Simple enable
breadcrumbs: true

// Custom options
breadcrumbs: {
  container: '#breadcrumb-trail',
  separator: ' › ',
  rootLabel: 'Home'
}
```

See [Breadcrumbs Guide](../guides/breadcrumbs.md) for details.

#### highlightByKey

Highlight arcs sharing the same key.

```javascript
// Simple enable
highlightByKey: true

// Custom options
highlightByKey: {
  className: 'highlighted',
  pinOnClick: true
}
```

See [Highlighting Guide](../guides/highlighting.md) for details.

#### navigation

Enable drill-down navigation.

```javascript
// Simple enable
navigation: true

// Custom options
navigation: {
  layers: ['main', 'detail'],
  rootLabel: 'Home',
  onFocusChange: (focus) => console.log(focus)
}
```

See [Navigation Guide](../guides/navigation.md) for details.

#### transition

Enable smooth animations.

```javascript
// Simple enable
transition: true

// Custom options
transition: {
  duration: 500,
  easing: (t) => t * t,
  delay: 0
}
```

See [Transitions Guide](../guides/transitions.md) for details.

#### labels

Enable text labels on arcs.

```javascript
// Simple enable
labels: true

// Custom options
```

See [Labels Guide](../guides/labels.md) for details.

#### colorTheme

Color theme configuration.

```javascript
colorTheme: {
  type: 'qualitative',
  palette: 'ocean',
  assignBy: 'key'
}
```

See [Color Themes Guide](../guides/color-themes.md) for details.

### Styling Options

#### borderColor

Global border color for all arcs.

```javascript
renderSVG({
  el: '#chart',
  config,
  borderColor: '#ffffff'  // White borders
});
```

**Type:** `string | undefined`

**Default:** `undefined` (no borders)

**Accepts:** Any valid CSS color string (hex, rgb, rgba, named colors)

**Notes:**
- Can be overridden per layer using `LayerConfig.borderColor`
- Use `rgba()` for semi-transparent borders
- Set to match background for seamless appearance

#### borderWidth

Global border width for all arcs in pixels.

```javascript
renderSVG({
  el: '#chart',
  config,
  borderWidth: 2  // 2px borders
});
```

**Type:** `number | undefined`

**Default:** `undefined` (no borders)

**Notes:**
- Can be overridden per layer using `LayerConfig.borderWidth`
- Set to `0` to explicitly disable borders
- Larger values create more visual separation

**Example with both:**
```javascript
renderSVG({
  el: '#chart',
  config: {
    size: { radius: 250 },
    layers: [
      {
        id: 'inner',
        radialUnits: [0, 1],
        angleMode: 'free',
        borderColor: '#000000',  // Override: black borders for inner
        borderWidth: 1,
        tree: [...]
      },
      {
        id: 'outer',
        radialUnits: [1, 2],
        angleMode: 'free',
        // Uses global border settings
        tree: [...]
      }
    ]
  },
  borderColor: '#ffffff',  // Global: white borders
  borderWidth: 2
});
```

### Event Callbacks

#### onArcEnter

Called when pointer enters an arc.

```javascript
onArcEnter: ({ arc, path, event }) => {
  console.log('Entered:', arc.data.name);
}
```

**Payload:**
- `arc`: LayoutArc - The arc data
- `path`: SVGPathElement - The SVG element
- `event`: PointerEvent - The browser event

#### onArcMove

Called when pointer moves over an arc.

```javascript
onArcMove: ({ arc, path, event }) => {
  // Update custom tooltip position
}
```

#### onArcLeave

Called when pointer leaves an arc.

```javascript
onArcLeave: ({ arc, path, event }) => {
  console.log('Left:', arc.data.name);
}
```

#### onArcClick

Called when arc is clicked.

```javascript
onArcClick: ({ arc, path, event }) => {
  console.log('Clicked:', arc.data.name);
  event.preventDefault(); // Prevent default if needed
}
```

### Other Options

#### debug

Enable diagnostic logging.

```javascript
renderSVG({
  el: '#chart',
  config,
  debug: true  // Logs layout calculations, warnings, etc.
});
```

**Output:**
- Label visibility warnings
- Layout calculations
- Update operations
- Performance metrics

---

## Related Documentation

- [Core Concepts](../guides/core-concepts.md)
- [Layout Modes Guide](../guides/layout-modes.md)
- [Color Themes](../guides/color-themes.md)
- [API Reference](./render-svg.md)

---

[← Back to Documentation](../README.md)
