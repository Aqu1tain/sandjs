# Getting Started with Sand.js

[← Back to Documentation](../README.md)

This guide will help you install Sand.js and create your first sunburst chart.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Basic Setup](#basic-setup)
- [Your First Chart](#your-first-chart)
- [Next Steps](#next-steps)

---

## Prerequisites

Sand.js is designed to work in modern browsers and Node.js environments. You'll need:

- **Node.js**: Version 14 or higher (for npm-based projects)
- **Modern Browser**: Chrome, Firefox, Safari, or Edge (latest versions)
- **SVG Support**: Sand.js renders to SVG elements

No framework is required - Sand.js works with vanilla JavaScript or any framework of your choice.

---

## Installation

### Using npm

```bash
npm install @akitain/sandjs
```

### Using Yarn

```bash
yarn add @akitain/sandjs
```

### Using pnpm

```bash
pnpm add @akitain/sandjs
```

### Using CDN

For quick prototyping or non-bundled projects:

```html
<script src="https://unpkg.com/@akitain/sandjs@0.4.0/dist/sandjs.iife.min.js"></script>
```

The library will be available as `window.SandJS`.

---

## Basic Setup

### ES Modules (Recommended)

```javascript
import { renderSVG } from '@akitain/sandjs';
```

### CommonJS

```javascript
const { renderSVG } = require('@akitain/sandjs');
```

### CDN / IIFE

```html
<script src="https://unpkg.com/@akitain/sandjs@0.4.0/dist/sandjs.iife.min.js"></script>
<script>
  const { renderSVG } = window.SandJS;
</script>
```

### TypeScript

Sand.js includes complete TypeScript definitions out of the box:

```typescript
import { renderSVG, SunburstConfig, RenderHandle } from '@akitain/sandjs';

const config: SunburstConfig = {
  // Your configuration with full type checking
};
```

---

## Your First Chart

Let's create a simple sunburst chart step by step.

### Step 1: Create an SVG Container

Add an SVG element to your HTML:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My First Sunburst</title>
</head>
<body>
  <svg id="my-chart" width="400" height="400"></svg>
</body>
</html>
```

### Step 2: Define Your Data

Create a configuration object describing your chart:

```javascript
const config = {
  size: {
    radius: 200  // Chart radius in pixels
  },
  layers: [
    {
      id: 'main',
      radialUnits: [0, 2],  // Start at center, extend 2 units out
      angleMode: 'free',     // Distribute arcs by value
      tree: [
        {
          name: 'Category A',
          value: 40,
          key: 'cat-a'
        },
        {
          name: 'Category B',
          value: 60,
          key: 'cat-b',
          children: [
            { name: 'Subcategory B1', value: 30 },
            { name: 'Subcategory B2', value: 30 }
          ]
        }
      ]
    }
  ]
};
```

### Step 3: Render the Chart

```javascript
const chart = renderSVG({
  el: '#my-chart',  // CSS selector or SVG element
  config: config,
  tooltip: true     // Enable tooltips
});
```

### Complete Example

Here's the full working example:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My First Sunburst</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    svg {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <svg id="my-chart" width="400" height="400"></svg>

  <script type="module">
    import { renderSVG } from 'https://unpkg.com/@akitain/sandjs@0.4.0/dist/sandjs.mjs';

    const config = {
      size: { radius: 180 },
      layers: [
        {
          id: 'main',
          radialUnits: [0, 2],
          angleMode: 'free',
          tree: [
            { name: 'Category A', value: 40, key: 'cat-a' },
            {
              name: 'Category B',
              value: 60,
              key: 'cat-b',
              children: [
                { name: 'Subcategory B1', value: 30 },
                { name: 'Subcategory B2', value: 30 }
              ]
            }
          ]
        }
      ]
    };

    renderSVG({
      el: '#my-chart',
      config: config,
      tooltip: true
    });
  </script>
</body>
</html>
```

---

## Understanding the Configuration

Let's break down what each part does:

### Size Configuration

```javascript
size: {
  radius: 200  // Total radius of the chart in pixels
}
```

The `radius` determines how large your chart will be. You can also set `angle` (in radians) for partial circles.

### Layer Configuration

```javascript
{
  id: 'main',           // Unique identifier for this layer
  radialUnits: [0, 2],  // [innerRadius, outerRadius] in abstract units
  angleMode: 'free',    // How to distribute arcs ('free' or 'align')
  tree: [...]           // Your data nodes
}
```

- **id**: Used to reference this layer (required for alignment)
- **radialUnits**: Defines the radial position. `[0, 2]` means from center to radius
- **angleMode**:
  - `'free'`: Arcs sized proportionally to their values
  - `'align'`: Arcs aligned to another layer by key

### Node Structure

```javascript
{
  name: 'Display Name',   // Label shown in tooltips and labels
  value: 50,              // Size of the arc
  key: 'unique-key',      // Optional: stable identifier
  children: [...]         // Optional: nested nodes
}
```

- **name**: Human-readable label
- **value**: Numeric size (if children exist, auto-calculated as sum)
- **key**: Used for alignment, highlighting, and animations
- **children**: Array of child nodes for hierarchy

---

## Next Steps

Now that you have a basic chart running, explore these topics:

1. **[Core Concepts](./core-concepts.md)** - Understand the architecture
2. **[Color Themes](./color-themes.md)** - Customize your chart colors
3. **[Navigation](./navigation.md)** - Add drill-down functionality
4. **[Configuration Reference](../api/configuration.md)** - See all available options
5. **[Examples](../examples/basic.md)** - More chart examples

---

## Troubleshooting

### Chart doesn't appear

- Verify the SVG element exists in the DOM before calling `renderSVG()`
- Check browser console for errors
- Ensure the SVG has width and height (or use CSS sizing)

### Values not displaying correctly

- Verify `value` properties are positive numbers
- If using children, values are auto-summed (don't set parent value)
- Check for `hidden: true` or `collapsed: true` on nodes

### Import errors

- For ES modules, ensure your build tool supports them
- For CDN usage, use the IIFE bundle and access via `window.SandJS`
- Check that the package is properly installed in `node_modules`

---

[← Back to Documentation](../README.md) | [Next: Core Concepts →](./core-concepts.md)
