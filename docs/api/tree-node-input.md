# TreeNodeInput

[← Back to Documentation](../README.md)

Represents a single data node in your hierarchy.

## Type Definition

```typescript
interface TreeNodeInput {
  // Required
  name: string;

  // Optional
  value?: number;
  key?: string;
  expandLevels?: number;
  offset?: number;
  color?: string;
  labelColor?: string;
  padAngle?: number;
  children?: TreeNodeInput[];
  parents?: string[];
  tooltip?: string;
  collapsed?: boolean;
  hidden?: boolean;

  // Custom properties allowed
  [key: string]: any;
}
```

## Required Properties

### name

Display label for the node.

**Type:** `string`

**Example:**
```javascript
name: 'Engineering Department'
```

Used in:
- Tooltips
- Labels
- Breadcrumbs
- Accessibility

## Optional Properties (Core)

### value

Numeric weight or size of the node.

**Type:** `number | undefined`

**For leaf nodes:** Required (provide explicit value)
**For parent nodes:** Optional (auto-calculated from children if omitted)

**Example:**
```javascript
// Leaf node - value required
{ name: 'Team A', value: 15 }

// Parent node - value auto-summed from children
{
  name: 'Department',
  children: [
    { name: 'Team A', value: 15 },
    { name: 'Team B', value: 10 }
  ]
  // Effective value: 25 (auto-calculated)
}

// Parent node - can also provide explicit value
{
  name: 'Department',
  value: 25,  // Explicit value
  children: [...]
}
```

## Optional Properties

### key

Stable identifier for alignment, coloring, and highlighting.

**Type:** `string | undefined`

**Example:**
```javascript
key: 'dept-engineering'
```

**Use for:**
- Cross-layer alignment
- Consistent colors
- Highlighting
- Transitions

**Best practices:**
```javascript
// Good
key: 'category-electronics'
key: 'user-12345'
key: 'q1-2024'

// Bad
key: Math.random().toString()  // Unstable
key: Date.now().toString()      // Changes
```

### expandLevels

Number of rings this node spans radially.

**Type:** `number | undefined`

**Default:** `1`

**Example:**
```javascript
expandLevels: 2  // Spans 2 rings
```

### offset

Angular offset for this arc.

**Type:** `number | undefined`

**Default:** `0`

Interpretation depends on layer's `arcOffsetMode`:
- `'relative'`: Fraction of arc's span
- `'absolute'`: Radians

**Example:**
```javascript
offset: 0.1
```

### color

Custom color override (CSS color string).

**Type:** `string | undefined`

**Example:**
```javascript
color: '#ff6b6b'
color: 'rgb(255, 107, 107)'
color: 'hsl(0, 100%, 71%)'
```

Overrides theme color for this arc.

### labelColor

Custom label text color for this node.

**Type:** `string | undefined`

**Example:**
```javascript
labelColor: '#ffffff'  // White label
labelColor: 'rgb(255, 0, 0)'  // Red label
labelColor: 'rgba(0, 0, 0, 0.8)'  // Semi-transparent black
```

**Priority:** This has the highest priority and overrides:
- Global `labels.labelColor`
- Layer `labelColor`
- Auto-contrast color

**Use cases:**
- Highlight important nodes with distinct label colors
- Ensure readability on custom arc colors
- Create visual hierarchy

### children

Nested child nodes for hierarchical structure.

**Type:** `TreeNodeInput[] | undefined`

**Example:**
```javascript
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
```

### parents

Array of parent keys that creates a unified parent arc spanning multiple nodes.

**Type:** `string[] | undefined`

**Stable since:** 1.0

**Example:**
```javascript
{
  name: 'Frontend Team',
  value: 25,
  parents: ['dept-eng', 'dept-design']
  // This node becomes a child of the unified Engineering+Design parent
}
```

**How it works:**
- Parent nodes with matching keys are unified into ONE combined arc
- This node becomes a child of that unified parent
- Multiple nodes can share the same `parents` array

**Constraints:**
- Must be an array of at least 2 strings
- Each string must match a `key` property of a node anywhere in the same layer
- Parent nodes referenced should not have their own `children`
- Can be used at any depth (root level or nested)

**Known limitations:**
- Key-based highlighting does not automatically highlight multi-parent arcs when hovering parents
- Navigation/drill-down has path ambiguity with multi-parent nodes

**Use cases:**
- Shared resources across departments
- Matrix organizational structures
- Many-to-many relationships

See [Configuration Reference](./configuration.md#parents) for detailed documentation.

### tooltip

Custom tooltip content.

**Type:** `string | undefined`

**Example:**
```javascript
tooltip: 'Total: 100 employees\nBudget: $5M'
```

Overrides default tooltip formatter for this node.

### collapsed

Hide children while preserving their value contribution.

**Type:** `boolean | undefined`

**Default:** `false`

**Example:**
```javascript
{
  name: 'Department',
  collapsed: true,
  children: [
    { name: 'Team 1', value: 30 },
    { name: 'Team 2', value: 20 }
  ]
  // Shows value of 50, children not rendered
}
```

### hidden

Completely hide this node from layout.

**Type:** `boolean | undefined`

**Default:** `false`

**Example:**
```javascript
{
  name: 'Hidden',
  hidden: true,
  value: 100
  // Not rendered, value doesn't contribute
}
```

## Custom Properties

You can add any custom properties:

```javascript
{
  name: 'Project Alpha',
  value: 50,

  // Custom properties
  status: 'active',
  owner: 'Alice',
  deadline: '2024-12-31',
  priority: 'high',
  tags: ['important', 'customer-facing']
}
```

Access in event callbacks and formatters:

```javascript
tooltip: {
  formatter: (arc) => {
    const { status, owner, deadline } = arc.data;
    return `
      ${arc.data.name}
      Owner: ${owner}
      Status: ${status}
      Due: ${deadline}
    `;
  }
}
```

## Examples

### Simple Leaf Node

```javascript
{
  name: 'Frontend Team',
  value: 15,
  key: 'team-frontend'
}
```

### Node with Custom Styling

```javascript
{
  name: 'Critical Project',
  value: 50,
  key: 'proj-001',
  color: '#ff0000',
  labelColor: '#ffffff',  // White label on red arc
  expandLevels: 2,
  tooltip: 'High priority - needs attention'
}
```

### Node with Custom Label Only

```javascript
{
  name: 'Important',
  value: 75,
  labelColor: '#ffff00',  // Yellow label for visibility
  tooltip: 'Highlighted with custom label color'
}
```

### Hierarchical Structure

```javascript
{
  name: 'Engineering',
  key: 'dept-eng',
  children: [
    {
      name: 'Frontend',
      children: [
        { name: 'React Team', value: 10 },
        { name: 'Vue Team', value: 8 }
      ]
    },
    {
      name: 'Backend',
      children: [
        { name: 'API Team', value: 12 },
        { name: 'Database Team', value: 6 }
      ]
    }
  ]
}
```

### With Custom Data

```javascript
{
  name: 'Q4 Sales',
  value: 125000,
  key: '2024-q4',

  // Custom properties for business logic
  target: 150000,
  growth: 0.15,
  region: 'North America',
  manager: 'Bob Smith',

  // Visual customization
  color: '#4caf50',
  tooltip: 'Target: $150K | Actual: $125K | Growth: 15%'
}
```

## Related

- [LayerConfig](./layer-config.md)
- [SunburstConfig](./sunburst-config.md)
- [Configuration Reference](./configuration.md)
- [Core Concepts](../guides/core-concepts.md)

---

[← Back to Documentation](../README.md)
