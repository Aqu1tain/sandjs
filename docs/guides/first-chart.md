# Your First Chart

[← Back to Documentation](../README.md)

A step-by-step tutorial to create your first sunburst chart with Sand.js.

## Prerequisites

Before starting, make sure you have:
- Sand.js installed (`npm install @akitain/sandjs`)
- A basic HTML file with an SVG element
- Basic JavaScript knowledge

## Step 1: Set Up Your HTML

Create a simple HTML file:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My First Sunburst</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .chart-container {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    }

    h1 {
      text-align: center;
      color: #333;
      margin-top: 0;
    }
  </style>
</head>
<body>
  <div class="chart-container">
    <h1>My First Sunburst Chart</h1>
    <svg id="chart" width="400" height="400"></svg>
  </div>
</body>
</html>
```

## Step 2: Import Sand.js

Add the script to import Sand.js. You can use either a module bundler or CDN:

### Option A: Using Module (with bundler)

```html
<script type="module">
  import { renderSVG } from '@akitain/sandjs';

  // Your code here
</script>
```

### Option B: Using CDN

```html
<script src="https://unpkg.com/@akitain/sandjs@0.3.6/dist/sandjs.iife.min.js"></script>
<script>
  const { renderSVG } = window.SandJS;

  // Your code here
</script>
```

## Step 3: Define Your Data

### Option A: Simple API (Recommended)

For basic charts, use the `data` + `radius` shorthand:

```javascript
const chart = renderSVG({
  el: '#chart',
  radius: 180,
  data: [
    { name: 'Engineering', value: 45 },
    {
      name: 'Design',
      value: 30,
      children: [
        { name: 'UI Design', value: 15 },
        { name: 'UX Research', value: 15 }
      ]
    },
    { name: 'Marketing', value: 25 }
  ],
  tooltip: true
});
```

The Simple API automatically handles layer configuration and tree depth calculation.

### Option B: Full Configuration (Advanced)

For multi-layer charts or advanced layouts, use the full `config` object:

```javascript
const config = {
  size: {
    radius: 180  // Chart will be 360x360 pixels
  },
  layers: [
    {
      id: 'main',
      radialUnits: [0, 2],  // From center to outer edge
      angleMode: 'free',    // Distribute by value
      tree: [
        {
          name: 'Engineering',
          value: 45,
          key: 'eng'
        },
        {
          name: 'Design',
          value: 30,
          key: 'design',
          children: [
            { name: 'UI Design', value: 15 },
            { name: 'UX Research', value: 15 }
          ]
        },
        {
          name: 'Marketing',
          value: 25,
          key: 'marketing'
        }
      ]
    }
  ]
};

const chart = renderSVG({
  el: '#chart',
  config: config,
  tooltip: true
});
```

## Step 4: That's It!

Your chart is now rendered. The Simple API is perfect for getting started quickly.

## Complete Code

### Using Simple API (Recommended)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My First Sunburst</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .chart-container {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    }

    h1 {
      text-align: center;
      color: #333;
      margin-top: 0;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="chart-container">
    <h1>My First Sunburst Chart</h1>
    <svg id="chart" width="400" height="400"></svg>
  </div>

  <script src="https://unpkg.com/@akitain/sandjs@0.3.6/dist/sandjs.iife.min.js"></script>
  <script>
    const { renderSVG } = window.SandJS;

    const chart = renderSVG({
      el: '#chart',
      radius: 180,
      data: [
        { name: 'Engineering', value: 45 },
        {
          name: 'Design',
          value: 30,
          children: [
            { name: 'UI Design', value: 15 },
            { name: 'UX Research', value: 15 }
          ]
        },
        { name: 'Marketing', value: 25 }
      ],
      tooltip: true,
      colorTheme: {
        type: 'qualitative',
        palette: 'ocean'
      }
    });
  </script>
</body>
</html>
```

### Using Full Config

Here's the same chart with full configuration:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My First Sunburst</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .chart-container {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    }

    h1 {
      text-align: center;
      color: #333;
      margin-top: 0;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="chart-container">
    <h1>My First Sunburst Chart</h1>
    <svg id="chart" width="400" height="400"></svg>
  </div>

  <script src="https://unpkg.com/@akitain/sandjs@0.3.6/dist/sandjs.iife.min.js"></script>
  <script>
    const { renderSVG } = window.SandJS;

    const config = {
      size: {
        radius: 180
      },
      layers: [
        {
          id: 'main',
          radialUnits: [0, 2],
          angleMode: 'free',
          tree: [
            {
              name: 'Engineering',
              value: 45,
              key: 'eng'
            },
            {
              name: 'Design',
              value: 30,
              key: 'design',
              children: [
                { name: 'UI Design', value: 15 },
                { name: 'UX Research', value: 15 }
              ]
            },
            {
              name: 'Marketing',
              value: 25,
              key: 'marketing'
            }
          ]
        }
      ]
    };

    const chart = renderSVG({
      el: '#chart',
      config: config,
      tooltip: true
    });
  </script>
</body>
</html>
```

## Step 5: Enhance Your Chart

Now that you have a basic chart, try adding more features:

### Add Colors

```javascript
const chart = renderSVG({
  el: '#chart',
  config: config,
  tooltip: true,
  colorTheme: {
    type: 'qualitative',
    palette: 'ocean',
    assignBy: 'key'
  }
});
```

### Add Labels

```javascript
const chart = renderSVG({
  el: '#chart',
  config: config,
  tooltip: true,
  labels: true,
  colorTheme: {
    type: 'qualitative',
    palette: 'ocean',
    assignBy: 'key'
  }
});
```

### Add Navigation

```javascript
const chart = renderSVG({
  el: '#chart',
  config: config,
  tooltip: true,
  labels: true,
  navigation: true,
  breadcrumbs: true,
  transition: true,
  colorTheme: {
    type: 'qualitative',
    palette: 'ocean',
    assignBy: 'key'
  }
});
```

## Experiment

Try modifying:
- **Values**: Change the `value` properties
- **Names**: Update the `name` properties
- **Structure**: Add more children or layers
- **Colors**: Try different palettes: `'vibrant'`, `'pastel'`, `'earth'`
- **Size**: Change the `radius` value

## Next Steps

- [Learn Core Concepts](./core-concepts.md) - Understand how Sand.js works
- [Explore Color Themes](./color-themes.md) - Customize your chart's appearance
- [Try Basic Examples](../examples/basic.md) - See more examples

---

[← Back to Documentation](../README.md) | [Next: Core Concepts →](./core-concepts.md)
