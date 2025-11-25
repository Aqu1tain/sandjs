# Navigation & Drilldown

[← Back to Documentation](../README.md)

Enable interactive drill-down navigation with smooth transitions for exploring hierarchical data.

## Table of Contents

- [Overview](#overview)
- [Basic Usage](#basic-usage)
- [Configuration Options](#configuration-options)
- [Navigation Behavior](#navigation-behavior)
- [Programmatic Control](#programmatic-control)
- [Integration with Breadcrumbs](#integration-with-breadcrumbs)
- [Best Practices](#best-practices)
- [Examples](#examples)

---

## Overview

Navigation allows users to click on arcs to "zoom in" and focus on a specific subtree, hiding unrelated parts of the chart. This creates a drill-down experience ideal for exploring deep hierarchies.

### Features

- Click-to-zoom on any arc with children
- Smooth transitions between focus states
- Automatic chart re-layout to show focused subtree
- Breadcrumb integration for navigation history
- Programmatic reset to root view
- Customizable transitions and callbacks

### When to Use Navigation

- **Deep hierarchies**: File systems, org charts, category trees
- **Progressive disclosure**: Show overview first, details on demand
- **Large datasets**: Reduce visual complexity by focusing
- **Storytelling**: Guide users through data narratively

---

## Basic Usage

### Simple Enable

```javascript
import { renderSVG } from '@akitain/sandjs';

const chart = renderSVG({
  el: '#chart',
  config: {
    size: { radius: 200 },
    layers: [{
      id: 'main',
      radialUnits: [0, 3],
      angleMode: 'free',
      tree: {
        name: 'Root',
        children: [
          {
            name: 'Category A',
            children: [
              { name: 'Item A1', value: 20 },
              { name: 'Item A2', value: 30 }
            ]
          },
          {
            name: 'Category B',
            children: [
              { name: 'Item B1', value: 25 },
              { name: 'Item B2', value: 25 }
            ]
          }
        ]
      }
    }]
  },
  navigation: true,  // Enable with defaults
  transition: true   // Recommended for smooth animations
});
```

**Behavior:**
- Click "Category A" → chart zooms to show only Category A and its children
- Click background or use breadcrumbs to return to root

### With Breadcrumbs

Navigation works seamlessly with breadcrumbs:

```javascript
renderSVG({
  el: '#chart',
  config,
  navigation: true,
  breadcrumbs: true,  // Shows navigation path
  transition: true
});
```

---

## Configuration Options

### NavigationOptions

```typescript
interface NavigationOptions {
  layers?: string[];
  rootLabel?: string;
  focusTransition?: TransitionOptions;
  onFocusChange?: (focus: NavigationFocusState | null) => void;
}
```

### layers

Specify which layers support navigation.

```javascript
navigation: {
  layers: ['main', 'details']  // Only these layers are navigable
}
```

**Default:** All layers are navigable

**Use case:** Disable navigation on certain layers (e.g., decorative outer rings)

```javascript
// Example: Three layers, only first two navigable
layers: [
  { id: 'categories', ... },  // Navigable
  { id: 'subcategories', ... }, // Navigable
  { id: 'labels', ... }        // Not navigable (navigation.layers doesn't include it)
],
navigation: {
  layers: ['categories', 'subcategories']
}
```

### rootLabel

Label for the root level in breadcrumbs.

```javascript
navigation: {
  rootLabel: 'Home'  // Default: 'Root'
}
```

**Effect:** Shows in breadcrumb trail when at root level

```
Home > Engineering > Frontend
```

### focusTransition

Custom transition for zoom animations.

```javascript
navigation: {
  focusTransition: {
    duration: 800,           // Animation length in ms
    easing: (t) => t * t,   // Easing function
    delay: 0                // Delay before animation
  }
}
```

**Default:**
```javascript
{
  duration: 500,
  easing: (t) => {
    // Cubic ease-in-out
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  },
  delay: 0
}
```

**Easing functions:**
```javascript
// Linear
easing: (t) => t

// Ease-in (accelerate)
easing: (t) => t * t

// Ease-out (decelerate)
easing: (t) => 1 - Math.pow(1 - t, 2)

// Ease-in-out (smooth)
easing: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

// Elastic
easing: (t) => {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 || t === 1
    ? t
    : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
}
```

### onFocusChange

Callback when focus state changes.

```javascript
navigation: {
  onFocusChange: (focus) => {
    if (focus) {
      console.log('Focused on:', focus.arc.data.name);
      console.log('Layer:', focus.layerId);
      console.log('Depth:', focus.arc.depth);
    } else {
      console.log('Returned to root view');
    }
  }
}
```

**FocusState type:**
```typescript
interface NavigationFocusState {
  layerId: string;    // Layer containing focused arc
  arc: LayoutArc;     // The focused arc
}
```

**Use cases:**
- Update external UI elements
- Track analytics
- Synchronize with other visualizations
- Show contextual information

---

## Navigation Behavior

### What Gets Focused

Clicking an arc with children zooms to show:
- The clicked arc as the new "root"
- All descendants of the clicked arc
- Hidden: siblings and ancestors of the clicked arc

### Click Targets

Only arcs with descendants can be focused:

```javascript
{
  name: 'Parent',
  children: [...]  // ✓ Clickable for navigation
}

{
  name: 'Leaf',
  value: 50  // ✗ Not clickable (no children to show)
}
```

### Multi-Layer Navigation

When multiple layers exist, navigation affects all layers:

```javascript
layers: [
  {
    id: 'categories',
    tree: [
      { name: 'Engineering', key: 'eng', children: [...] }
    ]
  },
  {
    id: 'teams',
    angleMode: 'align',
    alignWith: 'categories',
    tree: [
      { name: 'Frontend', key: 'eng', value: 30 },
      { name: 'Backend', key: 'eng', value: 20 }
    ]
  }
]
```

**Clicking "Engineering":**
- Layer 1: Shows Engineering and its children
- Layer 2: Shows only teams with `key: 'eng'` (Frontend, Backend)
- Other teams hidden

### Return to Root

Several ways to return to root view:

1. **Click background** (non-arc area)
2. **Click breadcrumb root** (if breadcrumbs enabled and interactive)
3. **Programmatic reset** (`chart.resetNavigation()`)

---

## Programmatic Control

### Reset to Root

```javascript
const chart = renderSVG({
  el: '#chart',
  config,
  navigation: true
});

// Later, reset to root view
if (chart.resetNavigation) {
  chart.resetNavigation();
}
```

**Use cases:**
- Reset button in UI
- Timeout after inactivity
- Synchronized with other controls

### Check if Navigation is Enabled

```javascript
const chart = renderSVG({
  el: '#chart',
  config,
  navigation: true
});

if (chart.resetNavigation) {
  console.log('Navigation is enabled');
} else {
  console.log('Navigation is not enabled');
}
```

The `resetNavigation` method only exists when navigation is enabled.

---

## Integration with Breadcrumbs

Navigation and breadcrumbs work together seamlessly.

### Basic Integration

```javascript
renderSVG({
  el: '#chart',
  config,
  navigation: true,
  breadcrumbs: true
});
```

**Result:** Automatic breadcrumb trail showing current path

### Interactive Breadcrumbs

```javascript
renderSVG({
  el: '#chart',
  config,
  navigation: {
    rootLabel: 'Dashboard'
  },
  breadcrumbs: {
    interactive: true,  // Click breadcrumbs to navigate
    separator: ' / ',
    rootLabel: 'Dashboard'  // Match navigation.rootLabel
  }
});
```

**Behavior:**
- Click any breadcrumb item to navigate to that level
- Breadcrumb trail updates on navigation
- Root label shown when at top level

### Custom Breadcrumb Container

```javascript
// HTML
<div id="chart-container">
  <div id="breadcrumbs"></div>
  <svg id="chart"></svg>
</div>

// JavaScript
renderSVG({
  el: '#chart',
  config,
  navigation: true,
  breadcrumbs: {
    container: '#breadcrumbs',
    interactive: true,
    separator: ' › '
  }
});
```

### Styling Breadcrumbs

```css
/* Container */
.sand-breadcrumbs {
  padding: 10px;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 10px;
}

/* Individual items */
.sand-breadcrumb-item {
  display: inline-block;
  color: #666;
}

/* Interactive items */
.sand-breadcrumb-item.interactive {
  color: #1976d2;
  cursor: pointer;
  text-decoration: underline;
}

.sand-breadcrumb-item.interactive:hover {
  color: #0d47a1;
}

/* Current (last) item */
.sand-breadcrumb-item:last-child {
  color: #333;
  font-weight: bold;
  cursor: default;
}

/* Separator */
.sand-breadcrumb-separator {
  margin: 0 8px;
  color: #999;
}
```

---

## Best Practices

### 1. Always Enable Transitions

Navigation without transitions can be jarring:

```javascript
// Good
navigation: true,
transition: true

// Less ideal
navigation: true,
transition: false  // Abrupt, confusing
```

### 2. Provide Visual Feedback

Show that arcs are clickable:

```css
/* Indicate clickable arcs */
.sand-arc-path {
  cursor: pointer;
  transition: opacity 0.2s;
}

.sand-arc-path:hover {
  opacity: 0.8;
}
```

### 3. Use Breadcrumbs

Help users understand where they are:

```javascript
navigation: true,
breadcrumbs: {
  interactive: true,
  rootLabel: 'All Data'
}
```

### 4. Handle onFocusChange

Update external UI to reflect current state:

```javascript
navigation: {
  onFocusChange: (focus) => {
    const title = document.getElementById('chart-title');
    if (focus) {
      title.textContent = `Viewing: ${focus.arc.data.name}`;
    } else {
      title.textContent = 'All Data';
    }
  }
}
```

### 5. Limit Depth

Very deep hierarchies can be overwhelming:

```javascript
// Consider flattening or limiting displayed depth
tree: {
  name: 'Root',
  children: [
    // Max 3-4 levels recommended for navigation
  ]
}
```

### 6. Consistent Keys

Use stable keys for smooth transitions:

```javascript
// Good: stable keys
{ name: 'Engineering', key: 'dept-eng', children: [...] }

// Bad: changing keys
{ name: 'Engineering', key: Date.now(), children: [...] }
```

---

## Examples

### Example 1: File System Browser

```javascript
const fileSystem = {
  name: 'My Computer',
  children: [
    {
      name: 'Documents',
      children: [
        {
          name: 'Work',
          children: [
            { name: 'Report.pdf', value: 5 },
            { name: 'Presentation.pptx', value: 12 }
          ]
        },
        {
          name: 'Personal',
          children: [
            { name: 'Photos', value: 150 },
            { name: 'Videos', value: 300 }
          ]
        }
      ]
    },
    {
      name: 'Downloads',
      children: [
        { name: 'Software', value: 80 },
        { name: 'Media', value: 120 }
      ]
    }
  ]
};

renderSVG({
  el: '#chart',
  config: {
    size: { radius: 250 },
    layers: [{
      id: 'files',
      radialUnits: [0, 4],
      angleMode: 'free',
      tree: fileSystem
    }]
  },
  navigation: {
    rootLabel: 'My Computer',
    focusTransition: {
      duration: 600,
      easing: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    }
  },
  breadcrumbs: {
    interactive: true,
    separator: ' / '
  },
  transition: true,
  tooltip: true
});
```

### Example 2: Organization Chart

```javascript
renderSVG({
  el: '#org-chart',
  config: {
    size: { radius: 300 },
    layers: [{
      id: 'org',
      radialUnits: [0, 4],
      angleMode: 'free',
      tree: {
        name: 'CEO',
        children: [
          {
            name: 'Engineering',
            key: 'eng',
            children: [
              { name: 'Frontend Team', value: 15 },
              { name: 'Backend Team', value: 20 },
              { name: 'DevOps Team', value: 8 }
            ]
          },
          {
            name: 'Product',
            key: 'product',
            children: [
              { name: 'Product Managers', value: 5 },
              { name: 'Designers', value: 7 }
            ]
          }
        ]
      }
    }]
  },
  navigation: {
    rootLabel: 'Company Overview',
    onFocusChange: (focus) => {
      if (focus) {
        document.getElementById('detail-panel').innerHTML = `
          <h3>${focus.arc.data.name}</h3>
          <p>Team Size: ${focus.arc.data.value || 'N/A'}</p>
        `;
      } else {
        document.getElementById('detail-panel').innerHTML = '<h3>Select a department</h3>';
      }
    }
  },
  breadcrumbs: true,
  transition: true,
  colorTheme: {
    type: 'qualitative',
    palette: 'vibrant',
    assignBy: 'key'
  }
});
```

### Example 3: Product Catalog

```javascript
renderSVG({
  el: '#catalog',
  config: {
    size: { radius: 280 },
    layers: [{
      id: 'catalog',
      radialUnits: [0, 3],
      angleMode: 'free',
      tree: {
        name: 'All Products',
        children: [
          {
            name: 'Electronics',
            key: 'electronics',
            children: [
              {
                name: 'Computers',
                children: [
                  { name: 'Laptops', value: 45 },
                  { name: 'Desktops', value: 30 }
                ]
              },
              {
                name: 'Phones',
                children: [
                  { name: 'Smartphones', value: 60 },
                  { name: 'Feature Phones', value: 15 }
                ]
              }
            ]
          },
          {
            name: 'Clothing',
            key: 'clothing',
            children: [
              { name: 'Men', value: 40 },
              { name: 'Women', value: 50 },
              { name: 'Kids', value: 30 }
            ]
          }
        ]
      }
    }]
  },
  navigation: {
    rootLabel: 'All Categories',
    focusTransition: {
      duration: 500
    }
  },
  breadcrumbs: {
    interactive: true,
    container: '#breadcrumb-bar',
    separator: ' > ',
    formatter: (arc) => arc.data.name.toUpperCase()
  },
  transition: true
});
```

---

## Related Documentation

- [Breadcrumbs Guide](./breadcrumbs.md)
- [Transitions Guide](./transitions.md)
- [Configuration Reference](../api/configuration.md)
- [Event Callbacks](./events.md)

---

[← Back to Documentation](../README.md) | [Next: Tooltips →](./tooltips.md)
