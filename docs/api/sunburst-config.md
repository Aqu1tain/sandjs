# SunburstConfig

[← Back to Documentation](../README.md)

The root configuration object for a Sand.js sunburst chart.

## Type Definition

```typescript
interface SunburstConfig {
  size: SunburstSize;
  layers: LayerConfig[];
}
```

## Properties

### size

**Type:** `SunburstSize`

**Required:** Yes

Defines the overall dimensions of the chart.

```typescript
interface SunburstSize {
  radius: number;
  angle?: number;
}
```

**Example:**
```javascript
size: {
  radius: 200,
  angle: Math.PI * 2  // Full circle (default)
}
```

See [SunburstSize](./sunburst-size.md) for details.

### layers

**Type:** `LayerConfig[]`

**Required:** Yes

Array of layer configurations, processed from first to last.

**Example:**
```javascript
layers: [
  {
    id: 'categories',
    radialUnits: [0, 1],
    angleMode: 'free',
    tree: [...]
  },
  {
    id: 'subcategories',
    radialUnits: [1, 2],
    angleMode: 'align',
    alignWith: 'categories',
    tree: [...]
  }
]
```

See [LayerConfig](./layer-config.md) for details.

## Complete Example

```javascript
const config = {
  size: {
    radius: 250,
    angle: Math.PI * 2
  },
  layers: [
    {
      id: 'departments',
      radialUnits: [0, 1],
      angleMode: 'free',
      padAngle: 0.01,
      tree: [
        { name: 'Engineering', value: 100, key: 'eng' },
        { name: 'Design', value: 50, key: 'design' }
      ]
    },
    {
      id: 'teams',
      radialUnits: [1, 2],
      angleMode: 'align',
      alignWith: 'departments',
      tree: [
        { name: 'Frontend', key: 'eng', value: 50 },
        { name: 'Backend', key: 'eng', value: 50 },
        { name: 'UI', key: 'design', value: 25 },
        { name: 'UX', key: 'design', value: 25 }
      ]
    }
  ]
};
```

## Validation

Sand.js validates the configuration at runtime:

- `size` must be provided
- `size.radius` must be a positive number
- `layers` must be a non-empty array
- Each layer must have required properties

Errors will be thrown if validation fails.

## Related

- [LayerConfig](./layer-config.md)
- [SunburstSize](./sunburst-size.md)
- [TreeNodeInput](./tree-node-input.md)
- [Configuration Guide](./configuration.md)

---

[← Back to Documentation](../README.md)
