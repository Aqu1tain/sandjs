# layout()

[← Back to Documentation](../README.md)

Compute arc geometries from configuration without rendering (layout-only mode).

## Signature

```typescript
function layout(config: SunburstConfig): LayoutArc[]
```

## Parameters

### config

A complete `SunburstConfig` object.

```typescript
interface SunburstConfig {
  size: SunburstSize;
  layers: LayerConfig[];
}
```

See [Configuration Reference](./configuration.md) for details.

## Return Value

Array of computed arcs with geometry and metadata.

```typescript
interface LayoutArc {
  layerId: string;
  data: TreeNodeInput;
  x0: number;          // Start angle (radians)
  x1: number;          // End angle (radians)
  y0: number;          // Inner radius (pixels)
  y1: number;          // Outer radius (pixels)
  depth: number;       // Hierarchical depth
  key?: string;        // Node key
  percentage: number;  // Percentage of parent
}
```

## Use Cases

### 1. Server-side Rendering

Compute layout on server, serialize arcs:

```javascript
import { layout } from '@akitain/sandjs';

// Server-side
const arcs = layout(config);
const serialized = JSON.stringify(arcs);
// Send to client
```

### 2. Custom Rendering

Use layout engine with custom renderer:

```javascript
import { layout } from '@akitain/sandjs';

const arcs = layout(config);

// Custom canvas renderer
const ctx = canvas.getContext('2d');
arcs.forEach(arc => {
  ctx.beginPath();
  // Draw arc using arc.x0, arc.x1, arc.y0, arc.y1
  ctx.arc(/* ... */);
  ctx.fill();
});
```

### 3. Data Analysis

Analyze chart structure without rendering:

```javascript
import { layout } from '@akitain/sandjs';

const arcs = layout(config);

// Find largest arc
const largest = arcs.reduce((max, arc) =>
  arc.data.value > max.data.value ? arc : max
);

// Calculate statistics
const totalValue = arcs.reduce((sum, arc) => sum + arc.data.value, 0);
const avgPercentage = arcs.reduce((sum, arc) => sum + arc.percentage, 0) / arcs.length;
```

### 4. Export Data

Export computed layout for external tools:

```javascript
import { layout } from '@akitain/sandjs';
import fs from 'fs';

const arcs = layout(config);

// Export to CSV
const csv = arcs.map(arc =>
  `${arc.data.name},${arc.x0},${arc.x1},${arc.y0},${arc.y1}`
).join('\n');

fs.writeFileSync('layout.csv', csv);
```

## Example

```javascript
import { layout } from '@akitain/sandjs';

const config = {
  size: { radius: 200 },
  layers: [{
    id: 'main',
    radialUnits: [0, 2],
    angleMode: 'free',
    tree: [
      { name: 'A', value: 25 },
      { name: 'B', value: 75 }
    ]
  }]
};

const arcs = layout(config);

console.log(arcs);
// [
//   {
//     layerId: 'main',
//     data: { name: 'A', value: 25 },
//     x0: 0,
//     x1: 1.5708,  // π/2 radians (90°)
//     y0: 0,
//     y1: 200,
//     depth: 0,
//     percentage: 25
//   },
//   {
//     layerId: 'main',
//     data: { name: 'B', value: 75 },
//     x0: 1.5708,
//     x1: 6.2832,  // 2π radians (360°)
//     y0: 0,
//     y1: 200,
//     depth: 0,
//     percentage: 75
//   }
// ]
```

## Performance

The `layout()` function is optimized for performance:

- Time complexity: O(n) where n is number of nodes
- Space complexity: O(n)
- No DOM operations
- Suitable for server-side use

## Related

- [renderSVG()](./render-svg.md)
- [Configuration Reference](./configuration.md)

---

[← Back to Documentation](../README.md)
