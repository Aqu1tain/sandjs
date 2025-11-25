# Layout Modes: Free vs Align

[← Back to Documentation](../README.md)

Understanding layout modes is essential for creating complex multi-layer sunburst charts with Sand.js.

## Table of Contents

- [Overview](#overview)
- [Free Mode](#free-mode)
- [Align Mode](#align-mode)
- [Comparison](#comparison)
- [When to Use Each Mode](#when-to-use-each-mode)
- [Advanced Patterns](#advanced-patterns)
- [Common Pitfalls](#common-pitfalls)

---

## Overview

Sand.js supports two layout modes that determine how angular space is distributed within a layer:

1. **Free Mode** (`'free'`): Angular space distributed proportionally to values
2. **Align Mode** (`'align'`): Angular space copied from another layer by key matching

### Key Differences

| Aspect | Free Mode | Align Mode |
|--------|-----------|------------|
| **Distribution** | Based on values | Based on reference layer |
| **Independence** | Self-contained | Depends on another layer |
| **Key requirement** | Optional | Required on nodes |
| **Use case** | Initial/root layers | Detail/drill-down layers |

---

## Free Mode

Free mode distributes angular space proportionally based on node values.

### Basic Example

```javascript
{
  id: 'main',
  angleMode: 'free',
  radialUnits: [0, 2],
  tree: [
    { name: 'A', value: 25 },  // Gets 25% of circle
    { name: 'B', value: 50 },  // Gets 50% of circle
    { name: 'C', value: 25 }   // Gets 25% of circle
  ]
}
```

**Result:**
- Arc A: 0° to 90° (25% of 360°)
- Arc B: 90° to 270° (50% of 360°)
- Arc C: 270° to 360° (25% of 360°)

### How Values Are Converted to Angles

```javascript
// For each node:
totalValue = sum(all sibling values)
nodeAngle = (nodeValue / totalValue) * availableAngle

// Example with full circle (2π radians):
// Node A: value = 25, totalValue = 100
// Node A angle = (25 / 100) * 2π = 0.5π radians = 90°
```

### Hierarchical Free Mode

Children also use free mode within their parent's angular span:

```javascript
{
  angleMode: 'free',
  tree: [
    {
      name: 'Parent A',
      value: 50,  // Gets 50% of circle
      children: [
        { name: 'Child A1', value: 30 },  // Gets 60% of Parent A's span
        { name: 'Child A2', value: 20 }   // Gets 40% of Parent A's span
      ]
    },
    {
      name: 'Parent B',
      value: 50,  // Gets 50% of circle
      children: [
        { name: 'Child B1', value: 25 },  // Gets 50% of Parent B's span
        { name: 'Child B2', value: 25 }   // Gets 50% of Parent B's span
      ]
    }
  ]
}
```

**Calculation:**
```
Parent A: 0° to 180° (50%)
  └─ Child A1: 0° to 108° (60% of 180°)
  └─ Child A2: 108° to 180° (40% of 180°)

Parent B: 180° to 360° (50%)
  └─ Child B1: 180° to 270° (50% of 180°)
  └─ Child B2: 270° to 360° (50% of 180°)
```

### When Keys Don't Matter

In free mode, keys are optional and don't affect layout:

```javascript
{
  angleMode: 'free',
  tree: [
    { name: 'A', value: 50 },              // No key: OK
    { name: 'B', value: 30, key: 'b' },    // Has key: Also OK
    { name: 'C', value: 20 }               // No key: OK
  ]
}
```

Keys in free mode are still useful for:
- Color consistency
- Highlighting
- Animations
- Reference by align mode layers

---

## Align Mode

Align mode copies angular spans from a reference layer based on key matching.

### Basic Example

```javascript
layers: [
  // Reference layer (free mode)
  {
    id: 'categories',
    angleMode: 'free',
    radialUnits: [0, 1],
    tree: [
      { name: 'Engineering', value: 60, key: 'eng' },  // 0° to 216°
      { name: 'Design', value: 40, key: 'design' }     // 216° to 360°
    ]
  },
  // Aligned layer
  {
    id: 'teams',
    angleMode: 'align',
    alignWith: 'categories',  // Reference the layer above
    radialUnits: [1, 2],
    tree: [
      { name: 'Frontend', key: 'eng', value: 30 },   // Appears in Engineering's span
      { name: 'Backend', key: 'eng', value: 30 },    // Appears in Engineering's span
      { name: 'UI Team', key: 'design', value: 20 }, // Appears in Design's span
      { name: 'UX Team', key: 'design', value: 20 }  // Appears in Design's span
    ]
  }
]
```

**Result:**
```
Layer 1 (categories):
  Engineering (key: eng): 0° to 216°
  Design (key: design): 216° to 360°

Layer 2 (teams):
  Frontend (key: eng): 0° to 108° (within Engineering's span)
  Backend (key: eng): 108° to 216° (within Engineering's span)
  UI Team (key: design): 216° to 288° (within Design's span)
  UX Team (key: design): 288° to 360° (within Design's span)
```

### How Alignment Works

1. **Key Lookup**: For each node in align mode, find the arc in reference layer with matching key
2. **Span Extraction**: Get the angular span (x0, x1) of that arc
3. **Subdivision**: Distribute child nodes within that span using their values
4. **No Match**: If no matching key found, node is skipped

### Requirements for Align Mode

**Required properties:**
```javascript
{
  angleMode: 'align',
  alignWith: 'reference-layer-id',  // Must exist
  tree: [
    { name: 'Node', key: 'matching-key', value: 50 }  // Key is required
  ]
}
```

**The reference layer:**
- Must appear earlier in the `layers` array
- Must have a valid `id` property
- Should contain arcs with keys that match aligned layer nodes

### Multi-Level Alignment

You can chain alignments:

```javascript
layers: [
  // Level 1: Free (root)
  {
    id: 'departments',
    angleMode: 'free',
    radialUnits: [0, 1],
    tree: [
      { name: 'Engineering', key: 'eng', value: 100 }
    ]
  },
  // Level 2: Align to departments
  {
    id: 'teams',
    angleMode: 'align',
    alignWith: 'departments',
    radialUnits: [1, 2],
    tree: [
      { name: 'Frontend', key: 'eng', value: 50, subkey: 'frontend' },
      { name: 'Backend', key: 'eng', value: 50, subkey: 'backend' }
    ]
  },
  // Level 3: Align to teams (using custom key)
  {
    id: 'members',
    angleMode: 'align',
    alignWith: 'teams',
    radialUnits: [2, 3],
    tree: [
      { name: 'Alice', key: 'frontend', value: 1 },
      { name: 'Bob', key: 'frontend', value: 1 },
      { name: 'Charlie', key: 'backend', value: 1 }
    ]
  }
]
```

Note: In this example, the third layer aligns to the second layer using the `subkey` values from level 2 as the `key` values in level 3.

---

## Comparison

### Visual Comparison

**Free Mode:**
```
Layer 1 (free):
  ┌─────A (40%)─────┬───B (30%)───┬──C (30%)──┐
  │                 │             │           │
  └─────────────────┴─────────────┴───────────┘
      0°         144°        252°          360°

Each arc sized by its value.
```

**Align Mode:**
```
Layer 1 (free):
  ┌─────A (key:a)─────┬─────B (key:b)─────┐
  │                    │                   │
  └────────────────────┴───────────────────┘
      0°            180°                360°

Layer 2 (align to Layer 1):
  ┌─A1─┬─A2─┬─A3─┐    ┌────B1────┬──B2──┐
  │(a) │(a) │(a) │    │   (b)    │ (b)  │
  └────┴────┴────┘    └──────────┴──────┘
      0°       180°              360°

A1, A2, A3 fit within A's span.
B1, B2 fit within B's span.
```

### Code Comparison

**Scenario:** Show departments and their teams

**Approach 1: Single Free Layer**
```javascript
// Everything in one layer
{
  angleMode: 'free',
  tree: [
    {
      name: 'Engineering',
      children: [
        { name: 'Frontend', value: 30 },
        { name: 'Backend', value: 20 }
      ]
    },
    {
      name: 'Design',
      children: [
        { name: 'UI', value: 15 },
        { name: 'UX', value: 10 }
      ]
    }
  ]
}
```

**Approach 2: Two Layers with Alignment**
```javascript
// Departments in one layer, teams in another
layers: [
  {
    id: 'departments',
    angleMode: 'free',
    radialUnits: [0, 1],
    tree: [
      { name: 'Engineering', key: 'eng', value: 50 },
      { name: 'Design', key: 'design', value: 25 }
    ]
  },
  {
    id: 'teams',
    angleMode: 'align',
    alignWith: 'departments',
    radialUnits: [1, 2],
    tree: [
      { name: 'Frontend', key: 'eng', value: 30 },
      { name: 'Backend', key: 'eng', value: 20 },
      { name: 'UI', key: 'design', value: 15 },
      { name: 'UX', key: 'design', value: 10 }
    ]
  }
]
```

Both produce similar visual results but with different structures.

---

## When to Use Each Mode

### Use Free Mode When:

1. **Starting a chart**: First layer typically uses free mode
2. **Independent data**: Layers don't relate to each other
3. **Hierarchical data**: Using children already provides structure
4. **Simple visualizations**: Single-layer charts
5. **Keys unavailable**: Data doesn't have stable identifiers

**Example scenarios:**
- File system browser (hierarchy via children)
- Budget breakdown (proportional slices)
- Time periods (sequential values)

### Use Align Mode When:

1. **Related layers**: Different dimensions of same entities
2. **Consistent grouping**: Keep related items visually aligned
3. **Multiple perspectives**: Same data, different granularity
4. **Cross-layer comparison**: Comparing metrics across layers
5. **Complex dashboards**: Multiple interconnected views

**Example scenarios:**
- Department budgets (layer 1) and expenses (layer 2)
- Geographic regions (layer 1) and cities (layer 2)
- Product categories (layer 1) and individual products (layer 2)
- Time periods (layer 1) and events within periods (layer 2)

---

## Advanced Patterns

### Pattern 1: Hybrid Free-Align

Mix modes for complex visualizations:

```javascript
layers: [
  // Layer 1: Free (categories)
  {
    id: 'categories',
    angleMode: 'free',
    radialUnits: [0, 1],
    tree: [
      { name: 'Category A', key: 'cat-a', value: 60 },
      { name: 'Category B', key: 'cat-b', value: 40 }
    ]
  },
  // Layer 2: Align (subcategories)
  {
    id: 'subcategories',
    angleMode: 'align',
    alignWith: 'categories',
    radialUnits: [1, 2],
    tree: [
      { name: 'Sub A1', key: 'cat-a', value: 30, subkey: 'a1' },
      { name: 'Sub A2', key: 'cat-a', value: 30, subkey: 'a2' },
      { name: 'Sub B1', key: 'cat-b', value: 40, subkey: 'b1' }
    ]
  },
  // Layer 3: Free again (independent decoration)
  {
    id: 'decoration',
    angleMode: 'free',
    radialUnits: [2, 3],
    tree: [
      { name: 'Label 1', value: 33 },
      { name: 'Label 2', value: 33 },
      { name: 'Label 3', value: 34 }
    ]
  }
]
```

### Pattern 2: Multiple Aligned Layers

Multiple layers align to the same reference:

```javascript
layers: [
  // Base layer
  {
    id: 'base',
    angleMode: 'free',
    radialUnits: [0, 1],
    tree: [
      { name: 'Q1', key: 'q1', value: 25 },
      { name: 'Q2', key: 'q2', value: 25 },
      { name: 'Q3', key: 'q3', value: 25 },
      { name: 'Q4', key: 'q4', value: 25 }
    ]
  },
  // Revenue (aligned to quarters)
  {
    id: 'revenue',
    angleMode: 'align',
    alignWith: 'base',
    radialUnits: [1, 2],
    tree: [
      { name: 'Revenue Q1', key: 'q1', value: 100 },
      { name: 'Revenue Q2', key: 'q2', value: 120 },
      { name: 'Revenue Q3', key: 'q3', value: 110 },
      { name: 'Revenue Q4', key: 'q4', value: 130 }
    ]
  },
  // Expenses (also aligned to quarters)
  {
    id: 'expenses',
    angleMode: 'align',
    alignWith: 'base',
    radialUnits: [2, 3],
    tree: [
      { name: 'Expenses Q1', key: 'q1', value: 80 },
      { name: 'Expenses Q2', key: 'q2', value: 85 },
      { name: 'Expenses Q3', key: 'q3', value: 90 },
      { name: 'Expenses Q4', key: 'q4', value: 95 }
    ]
  }
]
```

### Pattern 3: Partial Alignment

Not all arcs need matching keys:

```javascript
layers: [
  {
    id: 'main',
    angleMode: 'free',
    radialUnits: [0, 1],
    tree: [
      { name: 'Active', key: 'active', value: 70 },
      { name: 'Inactive', key: 'inactive', value: 30 }
    ]
  },
  {
    id: 'details',
    angleMode: 'align',
    alignWith: 'main',
    radialUnits: [1, 2],
    tree: [
      // Only show details for "active"
      { name: 'Detail 1', key: 'active', value: 40 },
      { name: 'Detail 2', key: 'active', value: 30 }
      // No details for "inactive" - that space remains empty
    ]
  }
]
```

---

## Common Pitfalls

### Pitfall 1: Missing alignWith

```javascript
// ❌ Wrong: align mode without alignWith
{
  angleMode: 'align',  // Where to align?
  tree: [...]
}

// ✓ Correct
{
  angleMode: 'align',
  alignWith: 'reference-layer',
  tree: [...]
}
```

### Pitfall 2: Missing Keys in Align Mode

```javascript
// ❌ Wrong: align mode nodes without keys
{
  angleMode: 'align',
  alignWith: 'base',
  tree: [
    { name: 'Node', value: 50 }  // No key!
  ]
}

// ✓ Correct
{
  angleMode: 'align',
  alignWith: 'base',
  tree: [
    { name: 'Node', key: 'matching-key', value: 50 }
  ]
}
```

### Pitfall 3: Non-existent Reference Layer

```javascript
// ❌ Wrong: reference layer doesn't exist
layers: [
  {
    id: 'layer1',
    angleMode: 'align',
    alignWith: 'nonexistent',  // This layer doesn't exist!
    tree: [...]
  }
]

// ✓ Correct: reference layer exists and comes first
layers: [
  {
    id: 'base',
    angleMode: 'free',
    tree: [...]
  },
  {
    id: 'layer1',
    angleMode: 'align',
    alignWith: 'base',
    tree: [...]
  }
]
```

### Pitfall 4: Circular References

```javascript
// ❌ Wrong: circular dependency
layers: [
  {
    id: 'layer1',
    angleMode: 'align',
    alignWith: 'layer2',  // References layer2
    tree: [...]
  },
  {
    id: 'layer2',
    angleMode: 'align',
    alignWith: 'layer1',  // References layer1
    tree: [...]
  }
]

// ✓ Correct: linear dependency
layers: [
  {
    id: 'layer1',
    angleMode: 'free',
    tree: [...]
  },
  {
    id: 'layer2',
    angleMode: 'align',
    alignWith: 'layer1',
    tree: [...]
  }
]
```

### Pitfall 5: Forgetting Key Consistency

```javascript
// ❌ Wrong: keys don't match
layers: [
  {
    id: 'base',
    angleMode: 'free',
    tree: [
      { name: 'Category', key: 'cat-a', value: 50 }
    ]
  },
  {
    id: 'detail',
    angleMode: 'align',
    alignWith: 'base',
    tree: [
      { name: 'Detail', key: 'category-a', value: 25 }  // Different key!
    ]
  }
]

// ✓ Correct: consistent keys
layers: [
  {
    id: 'base',
    angleMode: 'free',
    tree: [
      { name: 'Category', key: 'cat-a', value: 50 }
    ]
  },
  {
    id: 'detail',
    angleMode: 'align',
    alignWith: 'base',
    tree: [
      { name: 'Detail', key: 'cat-a', value: 25 }  // Matching key
    ]
  }
]
```

---

## Related Documentation

- [Core Concepts](./core-concepts.md)
- [Configuration Reference](../api/configuration.md)
- [Examples](../examples/basic.md)

---

[← Back to Documentation](../README.md) | [Next: Color Themes →](./color-themes.md)
