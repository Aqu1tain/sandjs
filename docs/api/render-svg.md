# renderSVG()

[← Back to Documentation](../README.md)

The main function to create and render a sunburst chart.

## Signature

```typescript
function renderSVG(options: RenderSvgOptions): RenderHandle
```

## Parameters

### RenderSvgOptions

```typescript
interface RenderSvgOptions {
  // Required
  el: string | SVGElement;

  // Configuration (choose one approach)
  config?: SunburstConfig;          // Full configuration (advanced)
  data?: TreeNodeInput | TreeNodeInput[];  // Simple tree data (creates default layer)
  radius?: number;                  // Required when using `data`
  angle?: number;                   // Total angle in radians (default: 2π)

  // Features
  tooltip?: boolean | TooltipOptions;
  breadcrumbs?: boolean | BreadcrumbOptions;
  highlightByKey?: boolean | HighlightByKeyOptions;
  navigation?: boolean | NavigationOptions;
  transition?: boolean | TransitionOptions;
  labels?: boolean | LabelOptions;
  colorTheme?: ColorThemeOptions;

  // Styling
  borderColor?: string;
  borderWidth?: number;

  // Event callbacks
  onArcEnter?: (payload: ArcPointerEventPayload) => void;
  onArcMove?: (payload: ArcPointerEventPayload) => void;
  onArcLeave?: (payload: ArcPointerEventPayload) => void;
  onArcClick?: (payload: ArcClickEventPayload) => void;

  // Other
  debug?: boolean;
}
```

**Configuration Approaches:**

1. **Simple API** (`data` + `radius`): For basic single-layer sunbursts
2. **Full Config** (`config`): For multi-layer charts, alignment modes, and advanced layouts

These are mutually exclusive - use one or the other.

See [Configuration Reference](./configuration.md) for detailed option descriptions.

## Return Value

### RenderHandle

```typescript
interface RenderHandle {
  update: (updateInput: RenderSvgUpdateInput) => void;
  dispose: () => void;
  resetNavigation?: () => void;
}
```

#### update(updateInput)

Updates the chart with new configuration or options.

```typescript
interface RenderSvgUpdateInput {
  config?: SunburstConfig;
  transition?: boolean | TransitionOptions;
}
```

**Example:**
```javascript
const chart = renderSVG({ el: '#chart', config });

// Update configuration
chart.update({
  config: newConfig,
  transition: { duration: 600 }
});

// Update only certain options
chart.update({
  config: {
    ...chart.config,
    size: { radius: 300 }
  }
});
```

#### dispose()

Cleans up the chart, removing all event listeners and DOM elements.

```javascript
const chart = renderSVG({ el: '#chart', config });

// Later, clean up
chart.destroy();
```

**When to use:**
- Component unmounting (React, Vue, etc.)
- Page navigation
- Dynamic chart replacement
- Memory cleanup

#### resetNavigation()

Resets navigation to root view (only available when `navigation` is enabled).

```javascript
const chart = renderSVG({
  el: '#chart',
  config,
  navigation: true
});

// Reset to root
if (chart.resetNavigation) {
  chart.resetNavigation();
}
```

## Examples

### Simple API (Recommended for Basic Charts)

```javascript
import { renderSVG } from '@akitain/sandjs';

const chart = renderSVG({
  el: '#my-chart',
  radius: 200,
  data: [
    { name: 'A', value: 50 },
    { name: 'B', value: 50, children: [
      { name: 'B1', value: 25 },
      { name: 'B2', value: 25 }
    ]}
  ],
  tooltip: true
});
```

### Simple API with Partial Circle

```javascript
const chart = renderSVG({
  el: '#my-chart',
  radius: 200,
  angle: Math.PI,  // Half circle
  data: [
    { name: 'A', value: 50 },
    { name: 'B', value: 50 }
  ]
});
```

### Full Config (Advanced)

```javascript
import { renderSVG } from '@akitain/sandjs';

const chart = renderSVG({
  el: '#my-chart',
  config: {
    size: { radius: 200 },
    layers: [{
      id: 'main',
      radialUnits: [0, 2],
      angleMode: 'free',
      tree: [
        { name: 'A', value: 50 },
        { name: 'B', value: 50 }
      ]
    }]
  }
});
```

### With All Features

```javascript
const chart = renderSVG({
  el: document.getElementById('chart'),
  config: myConfig,

  // Enable features
  tooltip: true,
  breadcrumbs: true,
  highlightByKey: true,
  navigation: true,
  transition: true,
  labels: true,

  // Color theme
  colorTheme: {
    type: 'qualitative',
    palette: 'ocean',
    assignBy: 'key'
  },

  // Event handlers
  onArcClick: ({ arc }) => {
    console.log('Clicked:', arc.data.name);
  },

  // Debug mode
  debug: true
});
```

### Custom Options

```javascript
const chart = renderSVG({
  el: '#chart',
  config,

  tooltip: {
    formatter: (arc) => `${arc.data.name}: ${arc.percentage.toFixed(1)}%`
  },

  breadcrumbs: {
    container: '#breadcrumbs',
    separator: ' / ',
    interactive: true
  },

  navigation: {
    rootLabel: 'Home',
    focusTransition: {
      duration: 700
    }
  },

  transition: {
    duration: 500,
    easing: (t) => t * t
  }
});
```

### With Custom Borders

```javascript
const chart = renderSVG({
  el: '#chart',
  config,

  // Global border styling for all arcs
  borderColor: '#ffffff',
  borderWidth: 2,

  colorTheme: {
    type: 'qualitative',
    palette: 'ocean'
  }
});

// Or use layer-specific borders in config
const configWithLayerBorders = {
  size: { radius: 200 },
  layers: [
    {
      id: 'inner',
      radialUnits: [0, 1],
      angleMode: 'free',
      borderColor: '#000000',  // Black borders for inner layer
      borderWidth: 1,
      tree: [...]
    },
    {
      id: 'outer',
      radialUnits: [1, 2],
      angleMode: 'free',
      borderColor: '#ff0000',  // Red borders for outer layer
      borderWidth: 3,
      tree: [...]
    }
  ]
};
```

### With Label Customization

```javascript
// Auto-contrast labels (black on light, white on dark)
const chart = renderSVG({
  el: '#chart',
  config,
  labels: {
    showLabels: true,
    autoLabelColor: true  // Automatically choose black or white for contrast
  },
  colorTheme: {
    type: 'qualitative',
    palette: 'vibrant'
  }
});

// Manual label color
const chart2 = renderSVG({
  el: '#chart',
  config,
  labels: {
    showLabels: true,
    labelColor: '#ffffff'  // White labels for all arcs
  }
});

// Hide labels
const chart3 = renderSVG({
  el: '#chart',
  config,
  labels: false  // or { showLabels: false }
});

// Layer-specific and node-specific labels
const configWithLabelOverrides = {
  size: { radius: 200 },
  layers: [
    {
      id: 'layer1',
      radialUnits: [0, 1],
      angleMode: 'free',
      labelColor: '#ff0000',  // Red labels for this layer
      showLabels: true,
      tree: [
        {
          name: 'Custom',
          value: 50,
          labelColor: '#00ff00'  // Override with green for this node
        },
        { name: 'Default', value: 50 }
      ]
    }
  ]
};
```

### Dynamic Updates

```javascript
const chart = renderSVG({ el: '#chart', config: initialConfig });

// Update on button click
document.getElementById('update-btn').addEventListener('click', () => {
  chart.update({
    config: generateNewConfig(),
    transition: true
  });
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  chart.destroy();
});
```

## Related

- [Configuration Reference](./configuration.md)
- [RenderHandle](./render-handle.md)
- [layout()](./layout.md)

---

[← Back to Documentation](../README.md)
