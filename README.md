# Sand.js

**Sunburst Advanced Node Data**

A lightweight, framework-agnostic JavaScript library for building interactive sunburst charts using SVG. Sand.js is fully data-driven: describe your chart in JSON, and it handles both layout computation and rendering.

[![npm version](https://img.shields.io/npm/v/@akitain/sandjs.svg)](https://www.npmjs.com/package/@akitain/sandjs)
[![GitHub stars](https://img.shields.io/github/stars/aqu1tain/sandjs.svg?style=social&label=Star)](https://github.com/aQu1tain/sandjs)

## Documentation

**[View Complete Documentation →](./docs/README.md)**

For detailed guides, API reference, and examples, visit the [full documentation](./docs/README.md).

---

## Table of Contents

- [Introduction](#introduction)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Configuration Reference](#configuration-reference)
- [Features](#features)
  - [Color Themes](#color-themes)
  - [Navigation & Drilldown](#navigation--drilldown)
  - [Tooltips](#tooltips)
  - [Breadcrumbs](#breadcrumbs)
  - [Highlighting](#highlighting)
  - [Transitions](#transitions)
  - [Labels](#labels)
- [API Reference](#api-reference)
- [Build & Development](#build--development)
- [CDN Usage](#cdn-usage)
- [Browser Support](#browser-support)
- [License](#license)

---

## Introduction

Sand.js is designed for developers who need to visualize hierarchical data as sunburst charts with minimal setup. Built with modern web standards, it offers:

- **Zero dependencies**: Lightweight and fast
- **Framework agnostic**: Works with vanilla JavaScript or any framework
- **JSON-driven**: Declarative configuration
- **Interactive**: Built-in tooltips, navigation, and event callbacks
- **Customizable**: Extensive theming and styling options
- **TypeScript ready**: Full type definitions included

---

## Installation

```bash
npm install @akitain/sandjs
```

For Yarn users:

```bash
yarn add @akitain/sandjs
```

---

## Quick Start

Create a basic sunburst chart in three steps:

1. **Add an SVG element to your HTML:**

```html
<svg id="chart"></svg>
```

2. **Define your data configuration:**

```javascript
import { renderSVG } from '@akitain/sandjs';

const config = {
  size: { radius: 200 },
  layers: [
    {
      id: 'main',
      radialUnits: [0, 2],
      angleMode: 'free',
      tree: [
        { name: 'Engineering', value: 45, key: 'eng' },
        {
          name: 'Design',
          value: 30,
          key: 'design',
          children: [
            { name: 'UI', value: 15 },
            { name: 'UX', value: 15 }
          ]
        },
        { name: 'Marketing', value: 25, key: 'marketing' }
      ]
    }
  ]
};
```

3. **Render the chart:**

```javascript
const chart = renderSVG({
  el: '#chart',
  config,
  tooltip: true
});
```

That's it! You now have a fully interactive sunburst chart.

### Simple API (Recommended for Basic Charts)

For simple sunbursts, skip the full configuration and use the `data` + `radius` shorthand:

```javascript
import { renderSVG } from '@akitain/sandjs';

const chart = renderSVG({
  el: '#chart',
  radius: 200,
  data: [
    { name: 'Engineering', value: 45 },
    {
      name: 'Design',
      value: 30,
      children: [
        { name: 'UI', value: 15 },
        { name: 'UX', value: 15 }
      ]
    },
    { name: 'Marketing', value: 25 }
  ],
  tooltip: true
});
```

The Simple API automatically:
- Creates a single layer with `angleMode: 'free'`
- Computes `radialUnits` from your tree depth
- Sets the chart radius

For partial sunbursts (less than a full circle), add the `angle` option:

```javascript
renderSVG({
  el: '#chart',
  radius: 200,
  angle: Math.PI,  // Half circle
  data: [...]
});
```

Use the full `config` object when you need multiple layers, alignment modes, or advanced layout options.

---

## Core Concepts

Understanding these fundamental concepts will help you build complex charts:

### Sunburst

The complete chart containing one or more layers. Defined by overall size (radius and optional angle).

### Layer

A logical grouping of rings with a shared dataset. Layers can operate independently (`free` mode) or align with other layers (`align` mode).

**Properties:**
- `id` (string): Unique identifier
- `radialUnits` ([number, number]): Inner and outer radial positions
- `angleMode` ('free' | 'align'): How angular space is distributed
- `tree` (Node | Node[]): Data structure for the layer

### Node

A unit of data representing a segment in your chart. Nodes can have children for hierarchical data.

**Key properties:**
- `name` (string): Display label
- `value` (number): Size of the segment
- `key` (string, optional): Stable identifier for animations and alignment
- `children` (Node[], optional): Child nodes for hierarchical structure

### Arc

A computed geometric entity created by the layout engine, ready for rendering with coordinates and metadata.

### Ring

A radial band in the chart, automatically calculated based on nodes and their `expandLevels` property.

### Key-group

Nodes sharing the same `key` value, used for alignment across layers and coordinated interactions.

---

## Configuration Reference

### SunburstConfig

The root configuration object for your chart.

```typescript
{
  size: {
    radius: number;      // Final radius in pixels
    angle?: number;      // Total angle in radians (default: 2π)
  },
  layers: LayerConfig[]  // Array of layer definitions
}
```

### LayerConfig

```typescript
{
  id: string;                          // Unique layer identifier
  radialUnits: [number, number];       // [inner, outer] radial positions
  angleMode: 'free' | 'align';         // Angular distribution mode
  alignWith?: string;                  // Reference layer ID (for 'align' mode)
  padAngle?: number;                   // Gap between arcs (radians)
  baseOffset?: number;                 // Global rotation offset (radians)
  arcOffsetMode?: 'relative' | 'absolute'; // Offset calculation mode
  defaultArcOffset?: number;           // Default offset for all arcs
  borderColor?: string;                // Border color for arcs in this layer
  borderWidth?: number;                // Border width in pixels
  labelColor?: string;                 // Label text color for this layer
  showLabels?: boolean;                // Show/hide labels for this layer
  tree: TreeNodeInput | TreeNodeInput[]; // Data structure
}
```

### TreeNodeInput

```typescript
{
  name: string;              // Display name
  value: number;             // Arc size (auto-summed if children exist)
  key?: string;              // Stable identifier
  expandLevels?: number;     // Radial thickness in rings (default: 1)
  offset?: number;           // Local angular offset
  color?: string;            // Custom color (CSS format)
  labelColor?: string;       // Custom label text color
  children?: TreeNodeInput[]; // Child nodes
  tooltip?: string;          // Custom tooltip content
  collapsed?: boolean;       // Hide children while preserving value
  hidden?: boolean;          // Hide node completely
}
```

---

## Features

### Color Themes

Sand.js includes 14 built-in color palettes across three theme types.

#### Qualitative Themes

Best for categorical data with no inherent order:

```javascript
import { renderSVG, QUALITATIVE_PALETTES } from '@akitain/sandjs';

renderSVG({
  el: '#chart',
  config,
  colorTheme: {
    type: 'qualitative',
    palette: 'ocean',  // 'default' | 'pastel' | 'vibrant' | 'earth' | 'ocean' | 'sunset'
    assignBy: 'key'    // Color assignment strategy
  }
});
```

#### Sequential Themes

Best for ordered data with progression from low to high:

```javascript
colorTheme: {
  type: 'sequential',
  palette: 'blues',  // 'blues' | 'greens' | 'purples' | 'oranges'
  assignBy: 'depth'
}
```

#### Diverging Themes

Best for data with a meaningful midpoint (e.g., positive/negative values):

```javascript
colorTheme: {
  type: 'diverging',
  palette: 'redBlue',  // 'redBlue' | 'orangePurple' | 'greenRed'
  assignBy: 'value'
}
```

#### Color Assignment Strategies

- **key**: Consistent colors based on arc keys (default for qualitative)
- **depth**: Colors vary by hierarchical depth (default for sequential/diverging)
- **index**: Sequential assignment by arc position
- **value**: Colors mapped to normalized values

#### Custom Palettes

```javascript
colorTheme: {
  type: 'qualitative',
  palette: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7dc6f'],
  assignBy: 'key'
}
```

#### Custom Color Keys

```javascript
colorTheme: {
  type: 'qualitative',
  palette: 'default',
  deriveKey: (arc) => arc.data.category  // Use any arc property
}
```

Note: Individual `node.color` values always override theme colors.

---

### Navigation & Drilldown

Enable interactive drill-down navigation with smooth transitions:

#### Basic Usage

```javascript
const chart = renderSVG({
  el: '#chart',
  config,
  navigation: true,  // Enable with defaults
  transition: true   // Enable smooth animations
});
```

#### Advanced Options

```javascript
navigation: {
  layers: ['main', 'details'],  // Specify navigable layers
  rootLabel: 'Home',            // Breadcrumb root text
  focusTransition: {
    duration: 600,               // Animation duration (ms)
    easing: (t) => t * t        // Custom easing function
  },
  onFocusChange: (focus) => {
    if (focus) {
      console.log('Focused:', focus.arc.data.name);
    } else {
      console.log('Reset to root');
    }
  }
}
```

#### Programmatic Control

```javascript
// Reset to root view
chart.resetNavigation?.();
```

---

### Tooltips

Display contextual information on hover.

#### Basic Tooltips

```javascript
renderSVG({
  el: '#chart',
  config,
  tooltip: true  // Enable default tooltips
});
```

#### Custom Tooltips

```javascript
tooltip: {
  formatter: (arc) => {
    return `
      <strong>${arc.data.name}</strong><br>
      Value: ${arc.data.value}<br>
      Percentage: ${arc.percentage.toFixed(1)}%
    `;
  },
  container: '#tooltip-container'  // Custom container selector
}
```

#### Per-Node Tooltips

```javascript
tree: [
  {
    name: 'Engineering',
    value: 45,
    tooltip: 'Custom tooltip for Engineering department'
  }
]
```

---

### Breadcrumbs

Visualize the current navigation path.

#### Basic Breadcrumbs

```javascript
renderSVG({
  el: '#chart',
  config,
  breadcrumbs: true  // Enable with defaults
});
```

#### Advanced Configuration

```javascript
breadcrumbs: {
  container: '#breadcrumb-trail',  // Custom container
  interactive: true,               // Enable click navigation
  separator: ' › ',                // Custom separator
  rootLabel: 'Overview',           // Root element label
  formatter: (arc) => arc.data.name.toUpperCase()  // Custom formatting
}
```

---

### Highlighting

Highlight related arcs by key.

#### Basic Highlighting

```javascript
renderSVG({
  el: '#chart',
  config,
  highlightByKey: true  // Enable with defaults
});
```

#### Advanced Options

```javascript
highlightByKey: {
  className: 'highlighted',  // Custom CSS class
  pinOnClick: true,          // Keep highlight on click
  onPinChange: (key, pinned) => {
    console.log(`${key} is ${pinned ? 'pinned' : 'unpinned'}`);
  }
}
```

---

### Transitions

Smooth animations when updating your chart.

#### Enable Transitions

```javascript
renderSVG({
  el: '#chart',
  config,
  transition: true  // Enable with defaults
});
```

#### Custom Transition Settings

```javascript
transition: {
  duration: 800,           // Animation duration (ms)
  easing: (t) => t * t,   // Easing function
  delay: 100              // Delay before animation starts (ms)
}
```

#### Updating with Transitions

```javascript
const chart = renderSVG({ el: '#chart', config, transition: true });

// Later, update with smooth transition
chart.update({
  config: newConfig,
  transition: {
    duration: 500
  }
});
```

---

### Labels

Render text labels on arcs.

#### Enable Labels

```javascript
renderSVG({
  el: '#chart',
  config,
  labels: true  // Enable default labels
});
```

#### Custom Label Formatting

```javascript
labels: {
  formatter: (arc) => {
    if (arc.percentage > 10) {
      return `${arc.data.name} (${arc.percentage.toFixed(0)}%)`;
    }
    return '';  // Hide labels for small arcs
  }
}
```

Note: Labels automatically hide on arcs that are too narrow to display text legibly.

---

## API Reference

### renderSVG(options)

Main function to create a sunburst chart.

**Parameters:**

```typescript
{
  el: string | SVGElement;           // Target SVG element or selector
  config: SunburstConfig;            // Chart configuration
  tooltip?: boolean | TooltipOptions; // Tooltip settings
  breadcrumbs?: boolean | BreadcrumbOptions; // Breadcrumb settings
  highlightByKey?: boolean | HighlightByKeyOptions; // Highlight settings
  navigation?: boolean | NavigationOptions; // Navigation settings
  transition?: boolean | TransitionOptions; // Transition settings
  labels?: boolean | LabelOptions;   // Label settings
  colorTheme?: ColorThemeOptions;    // Color theme
  onArcEnter?: (payload) => void;    // Hover enter callback
  onArcMove?: (payload) => void;     // Hover move callback
  onArcLeave?: (payload) => void;    // Hover leave callback
  onArcClick?: (payload) => void;    // Click callback
  debug?: boolean;                   // Enable diagnostic logging
}
```

**Returns:**

```typescript
{
  update: (updateInput) => void;     // Update the chart
  dispose: () => void;               // Clean up resources
  resetNavigation?: () => void;      // Reset to root (if navigation enabled)
}
```

### layout(config)

Compute arc geometries from configuration (layout-only mode).

**Parameters:**
- `config` (SunburstConfig): Chart configuration

**Returns:**
- `LayoutArc[]`: Array of computed arcs with geometry and metadata

### formatArcBreadcrumb(arc)

Generate a breadcrumb trail for an arc.

**Parameters:**
- `arc` (LayoutArc): The arc to generate breadcrumbs for

**Returns:**
- `BreadcrumbTrailItem[]`: Array of breadcrumb items

---

## Build & Development

### Development Setup

```bash
# Clone the repository
git clone https://github.com/aqu1tain/sandjs.git
cd sandjs

# Install dependencies
npm install

# Run tests
npm test

# Build the library
npm run build

# Run tests and build
npm run verify
```

### Development Server

```bash
npm run dev
```

Opens a development server at `http://localhost:4173` with live examples.

### Project Structure

```
sandjs/
├── src/
│   ├── index.ts           # Public API exports
│   ├── layout/            # Layout computation
│   ├── render/            # SVG rendering
│   └── types/             # TypeScript definitions
├── demo/                  # Interactive examples
├── dist/                  # Build output (generated)
└── tests/                 # Test suite
```

### Build Output

- `dist/sandjs.mjs`: ES Module (default)
- `dist/sandjs.iife.min.js`: Minified IIFE for CDN usage
- `dist/index.d.ts`: TypeScript type definitions

---

## CDN Usage

For quick prototyping or non-bundled environments:

```html
<svg id="chart"></svg>

<script src="https://unpkg.com/@akitain/sandjs@0.4.0/dist/sandjs.iife.min.js"></script>
<script>
  const { renderSVG } = window.SandJS;

  renderSVG({
    el: '#chart',
    config: {
      size: { radius: 200 },
      layers: [
        {
          id: 'main',
          radialUnits: [0, 2],
          angleMode: 'free',
          tree: [
            { name: 'Category A', value: 40 },
            { name: 'Category B', value: 60 }
          ]
        }
      ]
    },
    tooltip: true
  });
</script>
```

---

## Browser Support

Sand.js targets ESNext and supports modern browsers:

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 80+ |
| Firefox | 74+ |
| Safari | 13.1+ |
| Edge | 80+ |
| iOS Safari | 13.4+ |
| Chrome Android | 80+ |

**Not supported:** Internet Explorer

> For older browsers, transpile the bundle with Babel. See the [Browser Support Guide](./docs/guides/browser-support.md) for details.

---

## License

MIT © Aqu1tain
