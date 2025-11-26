# Cookbook

[← Back to Documentation](../README.md)

Common patterns and solutions for Sand.js.

## Pattern: Responsive Chart

Make chart resize with container:

```javascript
function createResponsiveChart(containerId, config) {
  const container = document.getElementById(containerId);
  const svg = container.querySelector('svg');

  let chart = null;

  function resize() {
    const width = container.clientWidth;
    const radius = Math.min(width / 2, 300);

    if (chart) {
      chart.update({
        config: {
          ...config,
          size: { ...config.size, radius }
        },
        transition: false
      });
    } else {
      chart = renderSVG({
        el: svg,
        config: {
          ...config,
          size: { ...config.size, radius }
        },
        tooltip: true,
        transition: true
      });
    }
  }

  resize();
  window.addEventListener('resize', resize);

  return () => {
    chart?.destroy();
    window.removeEventListener('resize', resize);
  };
}
```

## Pattern: Loading State

Show loading indicator:

```javascript
async function loadAndRenderChart() {
  const loading = document.getElementById('loading');
  const chartContainer = document.getElementById('chart-container');

  loading.style.display = 'block';
  chartContainer.style.display = 'none';

  try {
    const data = await fetch('/api/chart-data').then(r => r.json());
    const config = transformDataToConfig(data);

    const chart = renderSVG({
      el: '#chart',
      config,
      tooltip: true,
      transition: true
    });

    loading.style.display = 'none';
    chartContainer.style.display = 'block';

    return chart;
  } catch (error) {
    loading.textContent = 'Error loading chart';
    console.error(error);
  }
}
```

## Pattern: Export to Image

Export chart as PNG:

```javascript
function exportChartToPNG(svgElement, filename = 'chart.png') {
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();

  canvas.width = svgElement.width.baseVal.value;
  canvas.height = svgElement.height.baseVal.value;

  img.onload = () => {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
}

// Usage
const svg = document.querySelector('#chart');
exportChartToPNG(svg, 'my-sunburst.png');
```

## Pattern: Dynamic Theme Switching

Switch themes dynamically:

```javascript
const themes = {
  light: {
    type: 'qualitative',
    palette: 'pastel',
    assignBy: 'key'
  },
  dark: {
    type: 'qualitative',
    palette: 'vibrant',
    assignBy: 'key'
  },
  ocean: {
    type: 'qualitative',
    palette: 'ocean',
    assignBy: 'key'
  }
};

function switchTheme(chart, config, themeName) {
  chart.update({
    config,
    transition: { duration: 600 }
  });

  // Re-render with new theme
  // Note: colorTheme can't be updated directly, need to recreate
}
```

## Pattern: Data Transformation

Transform API data to Sand.js format:

```javascript
function transformAPIData(apiData) {
  return {
    size: { radius: 250 },
    layers: [{
      id: 'main',
      radialUnits: [0, 2],
      angleMode: 'free',
      tree: apiData.categories.map(cat => ({
        name: cat.label,
        key: cat.id,
        value: cat.count,
        children: cat.subcategories?.map(sub => ({
          name: sub.label,
          value: sub.count
        }))
      }))
    }]
  };
}

// Usage
fetch('/api/data')
  .then(r => r.json())
  .then(data => {
    const config = transformAPIData(data);
    renderSVG({ el: '#chart', config, tooltip: true });
  });
```

## Pattern: Drill-Down with External Panel

Sync chart with detail panel:

```javascript
let currentFocus = null;

const chart = renderSVG({
  el: '#chart',
  config,
  navigation: {
    onFocusChange: (focus) => {
      currentFocus = focus;
      updateDetailPanel(focus);
    }
  },
  onArcClick: ({ arc }) => {
    updateDetailPanel({ arc });
  },
  breadcrumbs: {
    interactive: true
  },
  transition: true
});

function updateDetailPanel(focus) {
  const panel = document.getElementById('detail-panel');

  if (!focus) {
    panel.innerHTML = '<p>Click an arc to see details</p>';
    return;
  }

  const { arc } = focus;
  panel.innerHTML = `
    <h3>${arc.data.name}</h3>
    <p>Value: ${arc.data.value}</p>
    <p>Share: ${arc.percentage.toFixed(1)}%</p>
    <p>Depth: ${arc.depth}</p>
  `;
}
```

## Pattern: Multi-Chart Dashboard

Coordinate multiple charts:

```javascript
const charts = {};

function createDashboard(configs) {
  Object.keys(configs).forEach(id => {
    charts[id] = renderSVG({
      el: `#${id}`,
      config: configs[id],
      tooltip: true,
      transition: true,
      onArcClick: ({ arc }) => {
        // Sync other charts
        Object.keys(charts).forEach(chartId => {
          if (chartId !== id) {
            highlightRelatedData(charts[chartId], arc.key);
          }
        });
      }
    });
  });
}

function updateAllCharts(newConfigs) {
  Object.keys(newConfigs).forEach(id => {
    charts[id]?.update({
      config: newConfigs[id],
      transition: { duration: 500 }
    });
  });
}

// Cleanup
function destroyDashboard() {
  Object.values(charts).forEach(chart => chart.destroy());
}
```

## Pattern: Progressive Data Loading

Load and display data progressively:

```javascript
async function loadChartProgressively() {
  // Start with summary
  const summary = await fetch('/api/summary').then(r => r.json());

  const chart = renderSVG({
    el: '#chart',
    config: transformToConfig(summary),
    tooltip: true,
    transition: true
  });

  // Load details
  const details = await fetch('/api/details').then(r => r.json());

  chart.update({
    config: mergeConfigs(summary, details),
    transition: { duration: 800 }
  });

  return chart;
}
```

## Pattern: Keyboard Navigation

Add keyboard controls:

```javascript
const chart = renderSVG({
  el: '#chart',
  config,
  navigation: true,
  transition: true
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && chart.resetNavigation) {
    chart.resetNavigation();
  }

  if (e.key === 'r' || e.key === 'R') {
    chart.update({
      config: generateRandomData(),
      transition: true
    });
  }
});
```

## Pattern: Animated Data Updates

Smoothly update data at intervals:

```javascript
let chart = renderSVG({
  el: '#chart',
  config: generateConfig(),
  tooltip: true,
  transition: {
    duration: 1000,
    easing: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  }
});

setInterval(() => {
  chart.update({
    config: generateConfig(),
    transition: true
  });
}, 3000);

function generateConfig() {
  return {
    size: { radius: 200 },
    layers: [{
      id: 'data',
      radialUnits: [0, 2],
      angleMode: 'free',
      tree: [
        { name: 'A', value: Math.random() * 100, key: 'a' },
        { name: 'B', value: Math.random() * 100, key: 'b' },
        { name: 'C', value: Math.random() * 100, key: 'c' }
      ]
    }]
  };
}
```

## Pattern: Custom Border Styling

Add visual separation between arcs with borders:

```javascript
// Global borders for all arcs
const chart = renderSVG({
  el: '#chart',
  config,
  borderColor: '#ffffff',
  borderWidth: 2,
  tooltip: true
});

// Layer-specific borders with different colors
const configWithLayerBorders = {
  size: { radius: 250 },
  layers: [
    {
      id: 'categories',
      radialUnits: [0, 1],
      angleMode: 'free',
      borderColor: '#000000',  // Black borders
      borderWidth: 2,
      tree: [
        { name: 'Category A', value: 40 },
        { name: 'Category B', value: 60 }
      ]
    },
    {
      id: 'details',
      radialUnits: [1, 2],
      angleMode: 'free',
      borderColor: 'rgba(255, 255, 255, 0.3)',  // Semi-transparent
      borderWidth: 1,
      tree: [
        { name: 'Detail 1', value: 25 },
        { name: 'Detail 2', value: 35 },
        { name: 'Detail 3', value: 40 }
      ]
    }
  ]
};

// Use CSS variables for dynamic theming
const styles = document.createElement('style');
styles.textContent = `
  :root {
    --chart-border-color: #333;
    --chart-border-width: 2px;
  }

  .sand-arc {
    stroke: var(--chart-border-color);
    stroke-width: var(--chart-border-width);
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --chart-border-color: #eee;
    }
  }
`;
document.head.appendChild(styles);

// Match borders to background for seamless look
const seamlessChart = renderSVG({
  el: '#seamless-chart',
  config,
  borderColor: '#1a1f2e',  // Same as dark background
  borderWidth: 2,
  colorTheme: {
    type: 'qualitative',
    palette: 'vibrant'
  }
});
```

---

[← Back to Documentation](../README.md)
