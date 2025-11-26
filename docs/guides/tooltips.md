# Tooltips

[← Back to Documentation](../README.md)

Display contextual information when users hover over arcs.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Configuration Options](#configuration-options)
- [Custom Formatting](#custom-formatting)
- [Per-Node Tooltips](#per-node-tooltips)
- [Styling](#styling)
- [Advanced Examples](#advanced-examples)

---

## Basic Usage

Enable tooltips with default settings:

```javascript
import { renderSVG } from '@akitain/sandjs';

renderSVG({
  el: '#chart',
  config,
  tooltip: true  // Enable with defaults
});
```

**Default tooltip shows:**
- Node name
- Node value
- Percentage of parent

**Example output:**
```
Engineering
Value: 100
32.5%
```

---

## Configuration Options

### TooltipOptions

```typescript
interface TooltipOptions {
  formatter?: (arc: LayoutArc) => string;
  container?: string | HTMLElement;
}
```

### Custom Container

Specify where tooltips are rendered:

```javascript
// HTML
<div id="tooltip-container"></div>
<svg id="chart"></svg>

// JavaScript
renderSVG({
  el: '#chart',
  config,
  tooltip: {
    container: '#tooltip-container'
  }
});
```

**Default:** Tooltip appended to `document.body`

---

## Custom Formatting

### formatter Function

Customize tooltip content:

```javascript
renderSVG({
  el: '#chart',
  config,
  tooltip: {
    formatter: (arc) => {
      return `
        <div class="custom-tooltip">
          <strong>${arc.data.name}</strong><br>
          Value: ${arc.data.value}<br>
          Percentage: ${arc.percentage.toFixed(1)}%<br>
          Depth: ${arc.depth}
        </div>
      `;
    }
  }
});
```

### Available Arc Properties

```typescript
arc.data.name        // Node name
arc.data.value       // Node value
arc.percentage       // Percentage of parent
arc.depth            // Hierarchical depth
arc.layerId          // Source layer ID
arc.key              // Node key (if set)
arc.x0, arc.x1       // Angular bounds (radians)
arc.y0, arc.y1       // Radial bounds (pixels)
```

### Conditional Content

Show different content based on arc properties:

```javascript
tooltip: {
  formatter: (arc) => {
    if (arc.depth === 0) {
      return `<strong>${arc.data.name}</strong><br>Root Level`;
    }

    if (arc.percentage < 5) {
      return `${arc.data.name} (${arc.percentage.toFixed(2)}%)`;
    }

    return `
      <strong>${arc.data.name}</strong><br>
      Value: ${arc.data.value}<br>
      ${arc.percentage.toFixed(1)}% of parent
    `;
  }
}
```

### HTML Formatting

Use HTML for rich tooltips:

```javascript
tooltip: {
  formatter: (arc) => {
    const data = arc.data;
    return `
      <div style="
        background: white;
        border: 2px solid #333;
        border-radius: 4px;
        padding: 12px;
        min-width: 150px;
      ">
        <h4 style="margin: 0 0 8px 0; color: #333;">
          ${data.name}
        </h4>
        <table style="width: 100%; font-size: 12px;">
          <tr>
            <td>Value:</td>
            <td style="text-align: right;"><strong>${data.value}</strong></td>
          </tr>
          <tr>
            <td>Share:</td>
            <td style="text-align: right;">${arc.percentage.toFixed(1)}%</td>
          </tr>
          <tr>
            <td>Layer:</td>
            <td style="text-align: right;">${arc.layerId}</td>
          </tr>
        </table>
      </div>
    `;
  }
}
```

---

## Per-Node Tooltips

Override tooltip content for specific nodes:

```javascript
config: {
  layers: [{
    tree: [
      {
        name: 'Engineering',
        value: 100,
        tooltip: 'Total headcount: 100 employees\nBudget: $5M\nGrowth: +15% YoY'
      },
      {
        name: 'Design',
        value: 30,
        tooltip: 'Design department includes UI, UX, and Brand teams'
      },
      {
        name: 'Marketing',
        value: 50
        // Uses default tooltip formatter
      }
    ]
  }]
}
```

**Behavior:**
- If `node.tooltip` is set, it's used as-is
- If not set, `formatter` function is called
- HTML is supported in `node.tooltip`

---

## Styling

### Default Tooltip Styles

Sand.js applies minimal default styles:

```css
.sand-tooltip {
  position: absolute;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
  z-index: 1000;
  white-space: pre-line;
}
```

### Custom Styles

Override with your own CSS:

```css
.sand-tooltip {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: 2px solid white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  font-family: 'Arial', sans-serif;
  font-size: 13px;
  padding: 10px 15px;
  border-radius: 8px;
  max-width: 200px;
}
```

### Tooltip Arrow

Add a CSS arrow:

```css
.sand-tooltip {
  position: relative;
}

.sand-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.8);
}
```

---

## Advanced Examples

### Example 1: Multi-line Formatted Tooltip

```javascript
tooltip: {
  formatter: (arc) => {
    const lines = [
      `Name: ${arc.data.name}`,
      `Value: ${arc.data.value.toLocaleString()}`,
      `Percentage: ${arc.percentage.toFixed(1)}%`,
      `Layer: ${arc.layerId}`,
      `Depth: ${arc.depth}`
    ];

    if (arc.key) {
      lines.push(`Key: ${arc.key}`);
    }

    return lines.join('\n');
  }
}
```

### Example 2: Data-Driven Tooltips

```javascript
// Node configuration with custom data
tree: [
  {
    name: 'Project A',
    value: 50,
    status: 'active',
    owner: 'Alice',
    deadline: '2024-12-31'
  },
  {
    name: 'Project B',
    value: 30,
    status: 'pending',
    owner: 'Bob',
    deadline: '2024-11-15'
  }
]

// Tooltip formatter
tooltip: {
  formatter: (arc) => {
    const { name, status, owner, deadline } = arc.data;
    const statusColor = status === 'active' ? '#4caf50' : '#ff9800';

    return `
      <div>
        <strong>${name}</strong><br>
        <span style="color: ${statusColor};">● ${status}</span><br>
        Owner: ${owner}<br>
        Deadline: ${deadline}
      </div>
    `;
  }
}
```

### Example 3: Conditional Tooltip Display

```javascript
tooltip: {
  formatter: (arc) => {
    // Don't show tooltip for small arcs
    if (arc.percentage < 2) {
      return '';  // Return empty string to hide tooltip
    }

    // Detailed tooltip for large arcs
    if (arc.percentage > 20) {
      return `
        <strong>${arc.data.name}</strong><br>
        Dominates with ${arc.percentage.toFixed(0)}% of total<br>
        Value: ${arc.data.value}
      `;
    }

    // Simple tooltip for normal arcs
    return `${arc.data.name}: ${arc.percentage.toFixed(1)}%`;
  }
}
```

### Example 4: External Data Lookup

```javascript
// External data source
const projectDetails = {
  'proj-001': { budget: '$500K', team: 'Alpha', priority: 'High' },
  'proj-002': { budget: '$300K', team: 'Beta', priority: 'Medium' }
};

// Tooltip with lookup
tooltip: {
  formatter: (arc) => {
    const details = projectDetails[arc.key];

    if (!details) {
      return `${arc.data.name}<br>No additional details`;
    }

    return `
      <strong>${arc.data.name}</strong><br>
      Budget: ${details.budget}<br>
      Team: ${details.team}<br>
      Priority: ${details.priority}
    `;
  }
}
```

### Example 5: Dynamic Positioning

For custom positioning beyond the default:

```javascript
const chart = renderSVG({
  el: '#chart',
  config,
  tooltip: {
    container: '#custom-tooltip',
    formatter: (arc) => `${arc.data.name}: ${arc.percentage.toFixed(1)}%`
  },
  onArcMove: ({ event }) => {
    const tooltip = document.getElementById('custom-tooltip');
    if (tooltip) {
      // Position tooltip near cursor
      tooltip.style.left = `${event.clientX + 15}px`;
      tooltip.style.top = `${event.clientY + 15}px`;
    }
  }
});
```

---

## Best Practices

1. **Keep It Concise**: Users read tooltips quickly
2. **Use Consistent Formatting**: Maintain the same structure across arcs
3. **Test Small Arcs**: Ensure tooltips work for tiny segments
4. **Consider Performance**: Complex HTML can slow rendering on hover
5. **Accessibility**: Tooltips should complement, not replace, visible labels

---

## Related Documentation

- [Event Callbacks](./events.md)
- [Labels](./labels.md)
- [Configuration Reference](../api/configuration.md)

---

[← Back to Documentation](../README.md) | [Next: Breadcrumbs →](./breadcrumbs.md)
