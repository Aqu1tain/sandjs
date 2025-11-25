# Basic Examples

[← Back to Documentation](../README.md)

Simple, common use cases to get started quickly.

## Example 1: Simple Pie Chart

```javascript
import { renderSVG } from '@akitain/sandjs';

renderSVG({
  el: '#chart',
  config: {
    size: { radius: 150 },
    layers: [{
      id: 'pie',
      radialUnits: [0, 1],
      angleMode: 'free',
      tree: [
        { name: 'Category A', value: 30 },
        { name: 'Category B', value: 50 },
        { name: 'Category C', value: 20 }
      ]
    }]
  },
  tooltip: true
});
```

## Example 2: Donut Chart

```javascript
renderSVG({
  el: '#chart',
  config: {
    size: { radius: 150 },
    layers: [{
      id: 'donut',
      radialUnits: [0.5, 1],  // Inner hole at 50%
      angleMode: 'free',
      tree: [
        { name: 'Product A', value: 40 },
        { name: 'Product B', value: 35 },
        { name: 'Product C', value: 25 }
      ]
    }]
  },
  tooltip: true,
  colorTheme: {
    type: 'qualitative',
    palette: 'pastel',
    assignBy: 'index'
  }
});
```

## Example 3: Two-Level Hierarchy

```javascript
renderSVG({
  el: '#chart',
  config: {
    size: { radius: 200 },
    layers: [{
      id: 'hierarchy',
      radialUnits: [0, 2],
      angleMode: 'free',
      tree: [
        {
          name: 'Engineering',
          children: [
            { name: 'Frontend', value: 30 },
            { name: 'Backend', value: 40 },
            { name: 'DevOps', value: 15 }
          ]
        },
        {
          name: 'Design',
          children: [
            { name: 'UI', value: 20 },
            { name: 'UX', value: 15 }
          ]
        }
      ]
    }]
  },
  tooltip: true,
  labels: true
});
```

## Example 4: Multi-Layer with Alignment

```javascript
renderSVG({
  el: '#chart',
  config: {
    size: { radius: 250 },
    layers: [
      {
        id: 'categories',
        radialUnits: [0, 1],
        angleMode: 'free',
        tree: [
          { name: 'Q1', key: 'q1', value: 100 },
          { name: 'Q2', key: 'q2', value: 120 },
          { name: 'Q3', key: 'q3', value: 110 },
          { name: 'Q4', key: 'q4', value: 130 }
        ]
      },
      {
        id: 'months',
        radialUnits: [1, 2],
        angleMode: 'align',
        alignWith: 'categories',
        tree: [
          { name: 'Jan', key: 'q1', value: 30 },
          { name: 'Feb', key: 'q1', value: 35 },
          { name: 'Mar', key: 'q1', value: 35 },
          { name: 'Apr', key: 'q2', value: 40 },
          { name: 'May', key: 'q2', value: 40 },
          { name: 'Jun', key: 'q2', value: 40 },
          // ... more months
        ]
      }
    ]
  },
  tooltip: true,
  colorTheme: {
    type: 'qualitative',
    palette: 'vibrant',
    assignBy: 'key'
  }
});
```

## Example 5: Interactive with Navigation

```javascript
renderSVG({
  el: '#chart',
  config: {
    size: { radius: 220 },
    layers: [{
      id: 'files',
      radialUnits: [0, 3],
      angleMode: 'free',
      tree: {
        name: 'Root',
        children: [
          {
            name: 'Documents',
            children: [
              { name: 'Work', value: 50 },
              { name: 'Personal', value: 30 }
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
      }
    }]
  },
  navigation: true,
  breadcrumbs: {
    interactive: true,
    rootLabel: 'Home'
  },
  transition: true,
  tooltip: true,
  labels: true
});
```

## Example 6: Custom Colors

```javascript
renderSVG({
  el: '#chart',
  config: {
    size: { radius: 180 },
    layers: [{
      id: 'status',
      radialUnits: [0, 1],
      angleMode: 'free',
      tree: [
        { name: 'Completed', value: 60, color: '#4caf50' },
        { name: 'In Progress', value: 30, color: '#ff9800' },
        { name: 'Blocked', value: 10, color: '#f44336' }
      ]
    }]
  },
  tooltip: true,
  labels: true
});
```

## Example 7: Semi-Circle Gauge

```javascript
renderSVG({
  el: '#chart',
  config: {
    size: {
      radius: 200,
      angle: Math.PI  // 180 degrees
    },
    layers: [{
      id: 'gauge',
      radialUnits: [0.7, 1],
      angleMode: 'free',
      baseOffset: -Math.PI / 2,  // Start at bottom
      tree: [
        { name: 'Low', value: 33, color: '#4caf50' },
        { name: 'Medium', value: 33, color: '#ff9800' },
        { name: 'High', value: 34, color: '#f44336' }
      ]
    }]
  },
  tooltip: true
});
```

## Example 8: With Event Callbacks

```javascript
renderSVG({
  el: '#chart',
  config: {
    size: { radius: 200 },
    layers: [{
      id: 'interactive',
      radialUnits: [0, 2],
      angleMode: 'free',
      tree: [
        { name: 'Item A', value: 40 },
        { name: 'Item B', value: 35 },
        { name: 'Item C', value: 25 }
      ]
    }]
  },
  onArcEnter: ({ arc, path }) => {
    path.style.filter = 'brightness(1.2)';
    console.log('Entered:', arc.data.name);
  },
  onArcLeave: ({ path }) => {
    path.style.filter = 'none';
  },
  onArcClick: ({ arc }) => {
    alert(`Clicked: ${arc.data.name} (${arc.data.value})`);
  }
});
```

---

[← Back to Documentation](../README.md) | [Next: Advanced Examples →](./advanced.md)
