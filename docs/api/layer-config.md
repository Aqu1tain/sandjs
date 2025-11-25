# LayerConfig

[← Back to Documentation](../README.md)

Configuration for a single layer in a sunburst chart.

## Type Definition

```typescript
interface LayerConfig {
  // Required
  id: string;
  radialUnits: [number, number];
  angleMode: 'free' | 'align';
  tree: TreeNodeInput | TreeNodeInput[];

  // Optional
  alignWith?: string;
  padAngle?: number;
  baseOffset?: number;
  arcOffsetMode?: 'relative' | 'absolute';
  defaultArcOffset?: number;
}
```

## Required Properties

### id

Unique identifier for the layer.

**Type:** `string`

**Example:**
```javascript
id: 'main-layer'
```

Used for:
- Alignment references (`alignWith`)
- Debugging
- Navigation layer filtering

### radialUnits

Radial range as `[inner, outer]` in abstract units.

**Type:** `[number, number]`

**Example:**
```javascript
radialUnits: [0, 2]  // From center (0) to 2 units out
```

The actual pixel values are calculated as:
```
actualRadius = (unitPosition / maxUnit) * totalRadius
```

### angleMode

How angular space is distributed.

**Type:** `'free' | 'align'`

**Values:**
- `'free'`: Proportional to node values
- `'align'`: Aligned to another layer by key

**Example:**
```javascript
angleMode: 'free'
```

See [Layout Modes Guide](../guides/layout-modes.md) for details.

### tree

The data nodes for this layer.

**Type:** `TreeNodeInput | TreeNodeInput[]`

**Example:**
```javascript
// Single root
tree: {
  name: 'Root',
  children: [...]
}

// Multiple roots
tree: [
  { name: 'Category 1', value: 50 },
  { name: 'Category 2', value: 50 }
]
```

See [TreeNodeInput](./tree-node-input.md) for details.

## Optional Properties

### alignWith

Reference layer ID when `angleMode` is `'align'`.

**Type:** `string | undefined`

**Required when:** `angleMode === 'align'`

**Example:**
```javascript
{
  id: 'detail',
  angleMode: 'align',
  alignWith: 'main',  // References layer with id='main'
  tree: [...]
}
```

### padAngle

Gap between sibling arcs in radians.

**Type:** `number | undefined`

**Default:** `0`

**Example:**
```javascript
padAngle: 0.02  // ~1.15 degrees
```

### baseOffset

Global rotation for entire layer in radians.

**Type:** `number | undefined`

**Default:** `0`

**Example:**
```javascript
baseOffset: Math.PI / 2  // Rotate 90 degrees
```

### arcOffsetMode

How individual arc offsets are interpreted.

**Type:** `'relative' | 'absolute' | undefined`

**Default:** `'relative'`

**Values:**
- `'relative'`: Offset as fraction of arc span
- `'absolute'`: Offset in radians

**Example:**
```javascript
arcOffsetMode: 'absolute'
```

### defaultArcOffset

Default offset applied to all arcs in layer.

**Type:** `number | undefined`

**Default:** `0`

**Example:**
```javascript
defaultArcOffset: 0.05
```

## Complete Examples

### Simple Free Layer

```javascript
{
  id: 'pie-chart',
  radialUnits: [0, 1],
  angleMode: 'free',
  tree: [
    { name: 'A', value: 30 },
    { name: 'B', value: 50 },
    { name: 'C', value: 20 }
  ]
}
```

### Aligned Layer with Padding

```javascript
{
  id: 'subcategories',
  radialUnits: [1, 2],
  angleMode: 'align',
  alignWith: 'categories',
  padAngle: 0.015,
  tree: [
    { name: 'Sub A', key: 'cat-a', value: 20 },
    { name: 'Sub B', key: 'cat-b', value: 30 }
  ]
}
```

### Layer with Rotation and Offsets

```javascript
{
  id: 'rotated',
  radialUnits: [0, 1],
  angleMode: 'free',
  baseOffset: -Math.PI / 2,  // Start at top
  arcOffsetMode: 'absolute',
  defaultArcOffset: 0.1,
  tree: [
    { name: 'Arc 1', value: 50 },
    { name: 'Arc 2', value: 50, offset: 0.2 }  // Override default
  ]
}
```

## Related

- [SunburstConfig](./sunburst-config.md)
- [TreeNodeInput](./tree-node-input.md)
- [Layout Modes Guide](../guides/layout-modes.md)
- [Configuration Reference](./configuration.md)

---

[← Back to Documentation](../README.md)
