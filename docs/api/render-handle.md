# RenderHandle

[← Back to Documentation](../README.md)

The object returned by `renderSVG()` for controlling the chart instance.

## Type Definition

```typescript
interface RenderHandle extends Array<LayoutArc> {
  update(input: RenderSvgUpdateInput): RenderHandle;
  destroy(): void;
  getOptions(): RenderSvgOptions;
  resetNavigation?: () => void;
}
```

## Methods

### update()

Updates the chart with new configuration or options and returns the handle.

**Signature:**
```typescript
update(input: RenderSvgUpdateInput): RenderHandle
```

**Parameters:**
```typescript
interface RenderSvgUpdateInput {
  config?: SunburstConfig;
  transition?: boolean | TransitionOptions;
}
```

**Example:**
```javascript
const chart = renderSVG({ el: '#chart', config: initialConfig });

// Update with new data
chart.update({
  config: newConfig,
  transition: { duration: 600 }
});

// Update without transition
chart.update({
  config: anotherConfig,
  transition: false
});
```

**Behavior:**
- Preserves existing event listeners
- Maintains feature state (navigation, highlighting, etc.)
- Animates changes if transition enabled
- Efficient: only updates changed elements

### destroy()

Cleans up the chart, removing all resources.

**Signature:**
```typescript
destroy(): void
```

**Example:**
```javascript
const chart = renderSVG({ el: '#chart', config });

// Later, clean up
chart.destroy();
```

**What gets cleaned up:**
- Event listeners removed
- DOM elements removed
- Animation frames canceled
- Internal state cleared
- Prevents memory leaks

**When to use:**
- Component unmounting (React, Vue, Svelte, etc.)
- Page navigation
- Dynamic chart replacement
- Before creating a new chart in same element

### getOptions()

Returns the current options used by the chart.

**Signature:**
```typescript
getOptions(): RenderSvgOptions
```

**Example:**
```javascript
const chart = renderSVG({ el: '#chart', config, tooltip: true });

const currentOptions = chart.getOptions();
console.log(currentOptions.tooltip); // true
```

### resetNavigation()

Resets navigation to root view.

**Signature:**
```typescript
resetNavigation?(): void
```

**Availability:** Only present when `navigation` is enabled

**Example:**
```javascript
const chart = renderSVG({
  el: '#chart',
  config,
  navigation: true
});

// Check if available
if (chart.resetNavigation) {
  chart.resetNavigation();
}
```

**Behavior:**
- Returns to root view
- Triggers transition if enabled
- Updates breadcrumbs if present
- Calls `onFocusChange` callback with `null`

## Usage Patterns

### React Component

```typescript
import { useEffect, useRef } from 'react';
import { renderSVG, RenderHandle } from '@akitain/sandjs';

function SunburstChart({ config }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const chartRef = useRef<RenderHandle | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    // Create chart
    chartRef.current = renderSVG({
      el: svgRef.current,
      config,
      tooltip: true,
      transition: true
    });

    // Cleanup on unmount
    return () => {
      chartRef.current?.destroy();
    };
  }, []);

  // Update on config change
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.update({
        config,
        transition: { duration: 500 }
      });
    }
  }, [config]);

  return <svg ref={svgRef} width="400" height="400" />;
}
```

### Vue Component

```vue
<template>
  <svg ref="chartEl" width="400" height="400"></svg>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { renderSVG } from '@akitain/sandjs';

const props = defineProps(['config']);
const chartEl = ref(null);
let chart = null;

onMounted(() => {
  chart = renderSVG({
    el: chartEl.value,
    config: props.config,
    tooltip: true,
    transition: true
  });
});

onUnmounted(() => {
  chart?.destroy();
});

watch(() => props.config, (newConfig) => {
  chart?.update({
    config: newConfig,
    transition: true
  });
});
</script>
```

### Vanilla JavaScript

```javascript
const chart = renderSVG({
  el: '#chart',
  config: initialConfig,
  navigation: true,
  transition: true
});

// Update button
document.getElementById('update-btn').addEventListener('click', () => {
  chart.update({
    config: generateNewConfig(),
    transition: { duration: 600 }
  });
});

// Reset button
document.getElementById('reset-btn').addEventListener('click', () => {
  if (chart.resetNavigation) {
    chart.resetNavigation();
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  chart.destroy();
});
```

### Dynamic Chart Replacement

```javascript
let currentChart = null;

function showChart(config) {
  // Clean up existing chart
  if (currentChart) {
    currentChart.destroy();
  }

  // Create new chart
  currentChart = renderSVG({
    el: '#chart',
    config,
    tooltip: true,
    transition: true
  });
}

// Switch between different charts
showChart(salesConfig);
setTimeout(() => showChart(expensesConfig), 5000);
setTimeout(() => showChart(revenueConfig), 10000);
```

## Best Practices

1. **Always dispose**: Call `dispose()` when chart is no longer needed
2. **Check optional methods**: Use optional chaining for `resetNavigation`
3. **Update, don't recreate**: Use `update()` instead of disposing and recreating
4. **Store the handle**: Keep reference to handle for later control
5. **Framework integration**: Use lifecycle hooks properly

---

[← Back to Documentation](../README.md)
