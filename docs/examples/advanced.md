# Advanced Examples

[← Back to Documentation](../README.md)

Complex configurations and advanced use cases.

## Example 1: Three-Layer Sunburst with Alignment

```javascript
renderSVG({
  el: '#chart',
  config: {
    size: { radius: 300 },
    layers: [
      // Layer 1: Departments (free mode)
      {
        id: 'departments',
        radialUnits: [0, 1],
        angleMode: 'free',
        tree: [
          { name: 'Engineering', key: 'eng', value: 150 },
          { name: 'Product', key: 'product', value: 80 },
          { name: 'Design', key: 'design', value: 50 }
        ]
      },
      // Layer 2: Teams (aligned to departments)
      // Note: Each team aligns to one department using unique keys
      {
        id: 'teams',
        radialUnits: [1, 2],
        angleMode: 'align',
        alignWith: 'departments',
        tree: [
          { name: 'Engineering Teams', key: 'eng', value: 150 },
          { name: 'Product Teams', key: 'product', value: 80 },
          { name: 'Design Teams', key: 'design', value: 50 }
        ]
      },
      // Layer 3: Status indicators (free, independent)
      {
        id: 'status',
        radialUnits: [2, 3],
        angleMode: 'free',
        padAngle: 0.02,
        tree: [
          { name: 'On Track', value: 70, color: '#4caf50' },
          { name: 'At Risk', value: 20, color: '#ff9800' },
          { name: 'Delayed', value: 10, color: '#f44336' }
        ]
      }
    ]
  },
  navigation: {
    layers: ['departments', 'teams'],
    rootLabel: 'Company Overview'
  },
  breadcrumbs: {
    interactive: true,
    separator: ' → '
  },
  colorTheme: {
    type: 'qualitative',
    palette: 'vibrant',
    assignBy: 'key'
  },
  highlightByKey: {
    pinOnClick: true
  },
  transition: {
    duration: 600,
    easing: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  },
  tooltip: {
    formatter: (arc) => {
      const lines = [
        `<strong>${arc.data.name}</strong>`,
        `Value: ${arc.data.value}`,
        `Share: ${arc.percentage.toFixed(1)}%`,
        `Layer: ${arc.layerId}`,
        `Depth: ${arc.depth}`
      ];
      if (arc.key) lines.push(`Key: ${arc.key}`);
      return lines.join('<br>');
    }
  },
  onArcClick: ({ arc }) => {
    console.log('Clicked:', {
      name: arc.data.name,
      layer: arc.layerId,
      value: arc.data.value,
      key: arc.key
    });
  }
});
```

## Example 2: Time Series with Sequential Colors

```javascript
const generateTimeData = () => {
  const years = ['2021', '2022', '2023', '2024'];
  return years.map(year => ({
    name: year,
    key: year,
    children: ['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => ({
      name: `${year}-${q}`,
      children: [
        { name: 'Revenue', value: Math.random() * 100 + 50 },
        { name: 'Costs', value: Math.random() * 50 + 20 },
        { name: 'Profit', value: Math.random() * 50 + 10 }
      ]
    }))
  }));
};

renderSVG({
  el: '#chart',
  config: {
    size: { radius: 280 },
    layers: [{
      id: 'timeline',
      radialUnits: [0, 4],
      angleMode: 'free',
      tree: generateTimeData()
    }]
  },
  colorTheme: {
    type: 'sequential',
    palette: 'blues',
    assignBy: 'depth'
  },
  navigation: true,
  breadcrumbs: true,
  transition: true,
  tooltip: {
    formatter: (arc) => {
      return `
        <strong>${arc.data.name}</strong><br>
        Value: $${arc.data.value?.toFixed(2) || 'N/A'}<br>
        ${arc.percentage.toFixed(1)}% of parent<br>
        Depth Level: ${arc.depth}
      `;
    }
  }
});
```

## Example 3: Dynamic Data Updates

```javascript
let currentConfig = generateConfig();

const chart = renderSVG({
  el: '#chart',
  config: currentConfig,
  transition: true,
  tooltip: true
});

// Update every 3 seconds
setInterval(() => {
  currentConfig = generateConfig();
  chart.update({
    config: currentConfig,
    transition: {
      duration: 800,
      easing: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    }
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

## Example 4: Custom Diverging Theme by Value

```javascript
renderSVG({
  el: '#chart',
  config: {
    size: { radius: 220 },
    layers: [{
      id: 'performance',
      radialUnits: [0, 2],
      angleMode: 'free',
      tree: [
        { name: 'High Performer A', value: 95 },
        { name: 'High Performer B', value: 88 },
        { name: 'Average C', value: 50 },
        { name: 'Average D', value: 48 },
        { name: 'Needs Improvement E', value: 30 },
        { name: 'Needs Improvement F', value: 25 }
      ]
    }]
  },
  colorTheme: {
    type: 'diverging',
    palette: 'greenRed',
    assignBy: 'value'
  },
  tooltip: {
    formatter: (arc) => {
      let rating;
      if (arc.data.value >= 80) rating = 'Excellent';
      else if (arc.data.value >= 60) rating = 'Good';
      else if (arc.data.value >= 40) rating = 'Average';
      else rating = 'Below Average';

      return `
        <strong>${arc.data.name}</strong><br>
        Score: ${arc.data.value}<br>
        Rating: ${rating}
      `;
    }
  }
});
```

## Example 5: Collapsed Nodes

```javascript
renderSVG({
  el: '#chart',
  config: {
    size: { radius: 240 },
    layers: [{
      id: 'org',
      radialUnits: [0, 3],
      angleMode: 'free',
      tree: [
        {
          name: 'Engineering (Detailed)',
          children: [
            { name: 'Team 1', value: 20 },
            { name: 'Team 2', value: 25 },
            { name: 'Team 3', value: 30 }
          ]
        },
        {
          name: 'Design (Collapsed)',
          collapsed: true,  // Children hidden but value preserved
          children: [
            { name: 'UI Team', value: 15 },
            { name: 'UX Team', value: 10 },
            { name: 'Brand Team', value: 10 }
          ]
        },
        {
          name: 'Marketing (Detailed)',
          children: [
            { name: 'Digital', value: 20 },
            { name: 'Content', value: 15 }
          ]
        }
      ]
    }]
  },
  tooltip: true,
  colorTheme: {
    type: 'qualitative',
    palette: 'earth',
    assignBy: 'depth'
  }
});
```

## Example 6: Custom Derived Color Keys

```javascript
renderSVG({
  el: '#chart',
  config: {
    size: { radius: 200 },
    layers: [{
      id: 'projects',
      radialUnits: [0, 2],
      angleMode: 'free',
      tree: [
        { name: 'Project Alpha', value: 50, priority: 'high', owner: 'Alice' },
        { name: 'Project Beta', value: 30, priority: 'medium', owner: 'Bob' },
        { name: 'Project Gamma', value: 40, priority: 'high', owner: 'Alice' },
        { name: 'Project Delta', value: 25, priority: 'low', owner: 'Charlie' },
        { name: 'Project Epsilon', value: 35, priority: 'medium', owner: 'Bob' }
      ]
    }]
  },
  colorTheme: {
    type: 'qualitative',
    palette: 'vibrant',
    deriveKey: (arc) => arc.data.owner  // Color by owner
  },
  tooltip: {
    formatter: (arc) => {
      return `
        <strong>${arc.data.name}</strong><br>
        Owner: ${arc.data.owner}<br>
        Priority: ${arc.data.priority}<br>
        Value: ${arc.data.value}
      `;
    }
  },
  highlightByKey: {
    pinOnClick: true
  }
});
```

---

[← Back to Documentation](../README.md) | [Previous: Basic Examples ←](./basic.md)
