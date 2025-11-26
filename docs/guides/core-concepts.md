# Core Concepts

[← Back to Documentation](../README.md)

Understanding these core concepts will help you build powerful sunburst charts with Sand.js.

## Table of Contents

- [Sunburst Architecture](#sunburst-architecture)
- [Layers](#layers)
- [Nodes and Arcs](#nodes-and-arcs)
- [Rings](#rings)
- [Keys and Alignment](#keys-and-alignment)
- [Layout Process](#layout-process)
- [Rendering Pipeline](#rendering-pipeline)

---

## Sunburst Architecture

A Sand.js sunburst chart is composed of several conceptual layers that work together:

```
Sunburst
  ├── Size (radius, angle)
  └── Layers[]
        ├── Layer 1 (id: 'main')
        │     ├── Radial Units [0, 2]
        │     ├── Angle Mode: 'free'
        │     └── Tree (Nodes)
        │           ├── Node A
        │           └── Node B
        │                 ├── Child B1
        │                 └── Child B2
        └── Layer 2 (id: 'detail')
              └── ...
```

### Key Principles

1. **Declarative Configuration**: You describe what you want, not how to build it
2. **Layer Independence**: Each layer can have its own data and layout rules
3. **Hierarchical Data**: Nodes can contain children for nested structures
4. **Computed Geometry**: The layout engine calculates all positions automatically

---

## Layers

Layers are the fundamental building blocks of a sunburst chart. Each layer:

- Occupies a specific radial range
- Has its own dataset
- Can operate independently or align with other layers
- Produces one or more rings of arcs

### Layer Properties

```javascript
{
  id: 'unique-layer-id',    // Required: unique identifier
  radialUnits: [0, 2],      // Required: [inner, outer] radial positions
  angleMode: 'free',        // Required: 'free' or 'align'
  tree: [...],              // Required: data nodes

  // Optional properties
  alignWith: 'other-layer', // For 'align' mode: reference layer
  padAngle: 0.01,           // Gap between arcs (radians)
  baseOffset: 0,            // Global rotation (radians)
  arcOffsetMode: 'relative',// 'relative' or 'absolute'
  defaultArcOffset: 0       // Default offset for all arcs
}
```

### Radial Units

The `radialUnits` property defines where a layer appears radially:

```javascript
// Example: Three layers from center outward
layers: [
  { id: 'inner',  radialUnits: [0, 1], ... },  // Center to middle
  { id: 'middle', radialUnits: [1, 2], ... },  // Middle to outer
  { id: 'outer',  radialUnits: [2, 3], ... }   // Outer ring
]
```

The actual pixel radius is calculated as:
```
pixelRadius = (unitPosition / maxUnit) * totalRadius
```

### Angle Modes

#### Free Mode

Arcs are distributed based on their values:

```javascript
{
  angleMode: 'free',
  tree: [
    { name: 'A', value: 25 },  // Gets 25% of the circle
    { name: 'B', value: 75 }   // Gets 75% of the circle
  ]
}
```

#### Align Mode

Arcs align to matching keys in another layer:

```javascript
layers: [
  {
    id: 'base',
    angleMode: 'free',
    tree: [
      { name: 'Category A', value: 50, key: 'cat-a' },
      { name: 'Category B', value: 50, key: 'cat-b' }
    ]
  },
  {
    id: 'detail',
    angleMode: 'align',
    alignWith: 'base',  // Align to the 'base' layer
    tree: [
      { name: 'Detail A1', key: 'cat-a', value: 30 },
      { name: 'Detail A2', key: 'cat-a', value: 20 },
      { name: 'Detail B1', key: 'cat-b', value: 50 }
    ]
  }
]
```

In this example:
- Detail A1 and A2 appear within Category A's angular span
- Detail B1 appears within Category B's angular span

---

## Nodes and Arcs

### Nodes (Input Data)

Nodes are your input data - what you provide in the configuration:

```javascript
{
  name: 'Engineering',       // Display label
  value: 100,                // Size/weight
  key: 'eng',                // Stable identifier

  // Optional properties
  children: [...],           // Nested nodes
  expandLevels: 1,           // Radial thickness (default: 1)
  offset: 0,                 // Angular offset
  color: '#ff6b6b',          // Custom color
  tooltip: 'Custom tip',     // Custom tooltip text
  collapsed: false,          // Hide children but keep their value
  hidden: false              // Hide completely from layout
}
```

### Arcs (Computed Output)

Arcs are the computed geometric shapes created by the layout engine:

```javascript
{
  layerId: 'main',           // Source layer
  data: { /* original node */ },

  // Geometry (computed)
  x0: 0,                     // Start angle (radians)
  x1: 1.57,                  // End angle (radians)
  y0: 0,                     // Inner radius (pixels)
  y1: 100,                   // Outer radius (pixels)

  // Metadata
  depth: 0,                  // Hierarchical depth
  key: 'eng',                // Copied from node.key
  percentage: 25.5           // Percentage of parent
}
```

### Node Properties in Detail

#### Value

The `value` property determines arc size:

```javascript
// Leaf node: value is explicit
{ name: 'Leaf', value: 50 }

// Parent node: value is sum of children
{
  name: 'Parent',
  // Don't set value here - it's auto-calculated
  children: [
    { name: 'Child 1', value: 30 },
    { name: 'Child 2', value: 20 }
  ]
  // Effective value: 50
}
```

#### Key

Keys are crucial for:
- Alignment across layers
- Consistent coloring
- Highlighting related arcs
- Smooth transitions

```javascript
// Good: stable, semantic keys
{ name: 'Engineering', key: 'dept-eng', value: 100 }

// Bad: unstable keys
{ name: 'Engineering', key: Math.random().toString(), value: 100 }
```

#### ExpandLevels

Controls radial thickness in rings:

```javascript
{
  name: 'Wide Arc',
  expandLevels: 2,  // Spans 2 rings instead of 1
  value: 50
}
```

#### Children

Creates hierarchical structure:

```javascript
{
  name: 'Parent',
  children: [
    {
      name: 'Child',
      children: [
        { name: 'Grandchild', value: 10 }
      ]
    }
  ]
}
```

Children appear in deeper rings radiating outward.

#### Collapsed

Hides descendants while preserving their contribution to the parent's value:

```javascript
{
  name: 'Department',
  collapsed: true,  // Children hidden but their values count
  children: [
    { name: 'Team 1', value: 30 },
    { name: 'Team 2', value: 20 }
  ]
  // This arc shows value of 50, but children aren't rendered
}
```

#### Hidden

Completely removes a node from layout:

```javascript
{
  name: 'Hidden Node',
  hidden: true,      // Not rendered, value doesn't contribute
  value: 100
}
```

---

## Rings

Rings are radial bands in your chart. They are automatically calculated based on:

1. Layer `radialUnits`
2. Node hierarchy (children create new rings)
3. Node `expandLevels`

### Ring Calculation Example

```javascript
// Configuration
{
  layers: [{
    radialUnits: [0, 3],  // 3 units of radial space
    tree: [
      { name: 'A', value: 50, expandLevels: 1 },
      {
        name: 'B',
        value: 50,
        expandLevels: 1,
        children: [
          { name: 'B1', value: 25, expandLevels: 1 },
          { name: 'B2', value: 25, expandLevels: 2 }  // Spans 2 rings
        ]
      }
    ]
  }]
}

// Results in:
// Ring 0 (innermost): A, B
// Ring 1: B1, B2 (starts)
// Ring 2: B2 (continues)
```

---

## Keys and Alignment

### Key-based Alignment

Keys enable powerful cross-layer alignment:

```javascript
layers: [
  {
    id: 'categories',
    angleMode: 'free',
    radialUnits: [0, 1],
    tree: [
      { name: 'Engineering', value: 60, key: 'eng' },
      { name: 'Design', value: 40, key: 'design' }
    ]
  },
  {
    id: 'teams',
    angleMode: 'align',
    alignWith: 'categories',
    radialUnits: [1, 2],
    tree: [
      { name: 'Frontend', key: 'eng', value: 30 },
      { name: 'Backend', key: 'eng', value: 30 },
      { name: 'UI Team', key: 'design', value: 40 }
    ]
  }
]
```

Result:
- Frontend and Backend appear within Engineering's angular span
- UI Team appears within Design's angular span

### Key-based Coloring

Keys ensure consistent colors:

```javascript
renderSVG({
  el: '#chart',
  config,
  colorTheme: {
    type: 'qualitative',
    palette: 'ocean',
    assignBy: 'key'  // Same key = same color
  }
});
```

All arcs with `key: 'eng'` get the same color across all layers.

### Key-based Highlighting

```javascript
renderSVG({
  el: '#chart',
  config,
  highlightByKey: true  // Hovering one arc highlights all with same key
});
```

---

## Layout Process

Understanding the layout process helps debug issues:

### 1. Normalization

Input nodes are normalized:
- Trees are flattened and structured
- Values are validated
- Children values are summed to parents
- Hidden nodes are filtered out

### 2. Layer Processing

Each layer is processed:
- **Free mode**: Values converted to angles proportionally
- **Align mode**: Angular spans copied from reference layer by key

### 3. Radial Assignment

Radial positions calculated:
- Layer `radialUnits` determine base positions
- Node `expandLevels` determine thickness
- Children occupy deeper rings

### 4. Arc Generation

Final arcs computed with:
- Start angle (`x0`) and end angle (`x1`)
- Inner radius (`y0`) and outer radius (`y1`)
- Metadata (depth, percentage, key)

### 5. Offset Application

Offsets are applied:
- Layer `baseOffset` rotates entire layer
- Node `offset` shifts individual arcs
- Mode (`relative` vs `absolute`) determines calculation

---

## Rendering Pipeline

Once layout is complete, rendering occurs:

### 1. Color Assignment

Colors are assigned based on `colorTheme`:
- Palette selection (qualitative, sequential, diverging)
- Assignment strategy (key, depth, index, value)
- Node color overrides applied

### 2. SVG Path Generation

Each arc becomes an SVG path:
- Polar coordinates converted to Cartesian
- SVG arc path commands generated
- Paths added to DOM

### 3. Interactivity Setup

Event listeners attached:
- Hover (enter, move, leave)
- Click
- Touch events

### 4. Feature Activation

Optional features initialized:
- Tooltips
- Breadcrumbs
- Highlighting
- Navigation
- Labels
- Transitions

### 5. Runtime Management

Ongoing management:
- Event handling
- State tracking
- Update handling
- Cleanup on dispose

---

## Best Practices

### Use Stable Keys

```javascript
// Good: stable, semantic
{ name: 'Q1 2024', key: '2024-q1', value: 100 }

// Bad: random or unstable
{ name: 'Q1 2024', key: Date.now().toString(), value: 100 }
```

### Structure Data Logically

```javascript
// Good: clear hierarchy
{
  name: 'Company',
  children: [
    {
      name: 'Engineering',
      children: [
        { name: 'Frontend', value: 30 },
        { name: 'Backend', value: 40 }
      ]
    }
  ]
}

// Bad: flat when hierarchical makes sense
tree: [
  { name: 'Frontend', value: 30 },
  { name: 'Backend', value: 40 }
]
```

### Use Meaningful Values

```javascript
// Good: values represent real quantities
{ name: 'Team A', value: 15 }  // 15 people

// Bad: values are arbitrary
{ name: 'Team A', value: 1 }  // Meaningless
```

### Plan Radial Units

```javascript
// Good: planned allocation
layers: [
  { radialUnits: [0, 2] },    // 2 units for main layer
  { radialUnits: [2, 4] },    // 2 units for detail layer
  { radialUnits: [4, 5] }     // 1 unit for outer layer
]

// Bad: overlapping ranges
layers: [
  { radialUnits: [0, 3] },
  { radialUnits: [2, 4] }  // Overlaps with first layer
]
```

---

## Next Steps

- [Configuration Reference](../api/configuration.md) - Complete configuration options
- [Layout Modes Guide](./layout-modes.md) - Deep dive into free vs align
- [Color Themes](./color-themes.md) - Customizing colors
- [Examples](../examples/basic.md) - See concepts in action

---

[← Back to Documentation](../README.md) | [Next: Layout Modes →](./layout-modes.md)
