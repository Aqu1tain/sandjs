# Framework Integration

[← Back to Documentation](../README.md)

Examples of integrating Sand.js with popular frameworks.

## React

### Basic Component

```typescript
import { useEffect, useRef } from 'react';
import { renderSVG, RenderHandle, SunburstConfig } from '@akitain/sandjs';

interface SunburstChartProps {
  config: SunburstConfig;
  width?: number;
  height?: number;
}

export function SunburstChart({ config, width = 400, height = 400 }: SunburstChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const chartRef = useRef<RenderHandle | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    chartRef.current = renderSVG({
      el: svgRef.current,
      config,
      tooltip: true,
      navigation: true,
      breadcrumbs: true,
      transition: true,
      labels: true
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    chartRef.current?.update({
      config,
      transition: { duration: 500 }
    });
  }, [config]);

  return <svg ref={svgRef} width={width} height={height} />;
}
```

### With Event Callbacks

```typescript
import { useState } from 'react';
import { renderSVG, LayoutArc } from '@akitain/sandjs';

export function InteractiveSunburst({ config }) {
  const [selectedArc, setSelectedArc] = useState<LayoutArc | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const chartRef = useRef<RenderHandle | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    chartRef.current = renderSVG({
      el: svgRef.current,
      config,
      tooltip: true,
      transition: true,
      onArcClick: ({ arc }) => {
        setSelectedArc(arc);
      }
    });

    return () => chartRef.current?.destroy();
  }, [config]);

  return (
    <div>
      <svg ref={svgRef} width="400" height="400" />
      {selectedArc && (
        <div className="arc-details">
          <h3>{selectedArc.data.name}</h3>
          <p>Value: {selectedArc.data.value}</p>
          <p>Percentage: {selectedArc.percentage.toFixed(1)}%</p>
        </div>
      )}
    </div>
  );
}
```

## Vue 3

### Composition API

```vue
<template>
  <svg ref="chartEl" :width="width" :height="height"></svg>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { renderSVG, RenderHandle, SunburstConfig } from '@akitain/sandjs';

interface Props {
  config: SunburstConfig;
  width?: number;
  height?: number;
}

const props = withDefaults(defineProps<Props>(), {
  width: 400,
  height: 400
});

const chartEl = ref<SVGSVGElement | null>(null);
let chart: RenderHandle | null = null;

onMounted(() => {
  if (!chartEl.value) return;

  chart = renderSVG({
    el: chartEl.value,
    config: props.config,
    tooltip: true,
    navigation: true,
    transition: true,
    labels: true
  });
});

onUnmounted(() => {
  chart?.destroy();
});

watch(() => props.config, (newConfig) => {
  chart?.update({
    config: newConfig,
    transition: { duration: 500 }
  });
}, { deep: true });
</script>
```

### Options API

```vue
<template>
  <svg ref="chart" :width="width" :height="height"></svg>
</template>

<script>
import { renderSVG } from '@akitain/sandjs';

export default {
  props: {
    config: {
      type: Object,
      required: true
    },
    width: {
      type: Number,
      default: 400
    },
    height: {
      type: Number,
      default: 400
    }
  },
  data() {
    return {
      chart: null
    };
  },
  mounted() {
    this.chart = renderSVG({
      el: this.$refs.chart,
      config: this.config,
      tooltip: true,
      navigation: true,
      transition: true
    });
  },
  beforeUnmount() {
    this.chart?.destroy();
  },
  watch: {
    config: {
      handler(newConfig) {
        this.chart?.update({
          config: newConfig,
          transition: true
        });
      },
      deep: true
    }
  }
};
</script>
```

## Svelte

### Basic Component

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { renderSVG, type RenderHandle, type SunburstConfig } from '@akitain/sandjs';

  export let config: SunburstConfig;
  export let width = 400;
  export let height = 400;

  let svgElement: SVGSVGElement;
  let chart: RenderHandle | null = null;

  onMount(() => {
    chart = renderSVG({
      el: svgElement,
      config,
      tooltip: true,
      navigation: true,
      breadcrumbs: true,
      transition: true,
      labels: true
    });
  });

  onDestroy(() => {
    chart?.destroy();
  });

  $: if (chart && config) {
    chart.update({
      config,
      transition: { duration: 500 }
    });
  }
</script>

<svg bind:this={svgElement} {width} {height}></svg>
```

### With Events

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { renderSVG, type LayoutArc } from '@akitain/sandjs';

  export let config;

  let svgElement: SVGSVGElement;
  let chart;
  let selectedArc: LayoutArc | null = null;

  onMount(() => {
    chart = renderSVG({
      el: svgElement,
      config,
      tooltip: true,
      transition: true,
      onArcClick: ({ arc }) => {
        selectedArc = arc;
      }
    });
  });

  onDestroy(() => {
    chart?.destroy();
  });
</script>

<div>
  <svg bind:this={svgElement} width="400" height="400"></svg>

  {#if selectedArc}
    <div class="details">
      <h3>{selectedArc.data.name}</h3>
      <p>Value: {selectedArc.data.value}</p>
      <p>Percentage: {selectedArc.percentage.toFixed(1)}%</p>
    </div>
  {/if}
</div>
```

## Angular

### Component

```typescript
import { Component, Input, ElementRef, ViewChild, OnInit, OnDestroy, OnChanges } from '@angular/core';
import { renderSVG, RenderHandle, SunburstConfig } from '@akitain/sandjs';

@Component({
  selector: 'app-sunburst-chart',
  template: `
    <svg #chartSvg [attr.width]="width" [attr.height]="height"></svg>
  `
})
export class SunburstChartComponent implements OnInit, OnDestroy, OnChanges {
  @Input() config!: SunburstConfig;
  @Input() width = 400;
  @Input() height = 400;

  @ViewChild('chartSvg', { static: true }) svgElement!: ElementRef<SVGSVGElement>;

  private chart: RenderHandle | null = null;

  ngOnInit() {
    this.chart = renderSVG({
      el: this.svgElement.nativeElement,
      config: this.config,
      tooltip: true,
      navigation: true,
      transition: true,
      labels: true
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['config'] && !changes['config'].firstChange) {
      this.chart?.update({
        config: this.config,
        transition: { duration: 500 }
      });
    }
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }
}
```

## Solid.js

```typescript
import { onMount, onCleanup, createEffect } from 'solid-js';
import { renderSVG, type RenderHandle, type SunburstConfig } from '@akitain/sandjs';

interface SunburstChartProps {
  config: SunburstConfig;
  width?: number;
  height?: number;
}

export function SunburstChart(props: SunburstChartProps) {
  let svgRef: SVGSVGElement | undefined;
  let chart: RenderHandle | null = null;

  onMount(() => {
    if (!svgRef) return;

    chart = renderSVG({
      el: svgRef,
      config: props.config,
      tooltip: true,
      navigation: true,
      transition: true
    });
  });

  createEffect(() => {
    chart?.update({
      config: props.config,
      transition: { duration: 500 }
    });
  });

  onCleanup(() => {
    chart?.destroy();
  });

  return (
    <svg
      ref={svgRef}
      width={props.width || 400}
      height={props.height || 400}
    />
  );
}
```

## Best Practices

1. **Always dispose**: Clean up charts in component unmount lifecycle
2. **Update, don't recreate**: Use `update()` method for data changes
3. **Store handle**: Keep reference to RenderHandle for control
4. **TypeScript**: Use provided types for type safety
5. **Transitions**: Enable for smooth updates
6. **Event handling**: Use callbacks for interactivity

---

[← Back to Documentation](../README.md) | [Previous: Advanced Examples ←](./advanced.md)
