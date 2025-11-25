# Color Themes

[← Back to Documentation](../README.md)

Sand.js includes a comprehensive color theme system with 14 built-in palettes and flexible assignment strategies.

## Table of Contents

- [Overview](#overview)
- [Theme Types](#theme-types)
- [Color Assignment Strategies](#color-assignment-strategies)
- [Built-in Palettes](#built-in-palettes)
- [Custom Palettes](#custom-palettes)
- [Custom Color Keys](#custom-color-keys)
- [Node Color Overrides](#node-color-overrides)
- [Examples](#examples)

---

## Overview

The color theme system determines how colors are assigned to arcs in your sunburst chart. It consists of:

1. **Theme Type**: The category of palette (qualitative, sequential, or diverging)
2. **Palette**: The specific color scheme to use
3. **Assignment Strategy**: How colors are mapped to arcs
4. **Custom Derivation**: Optional function to derive color keys from arcs

### Basic Usage

```javascript
import { renderSVG } from '@akitain/sandjs';

renderSVG({
  el: '#chart',
  config,
  colorTheme: {
    type: 'qualitative',
    palette: 'ocean',
    assignBy: 'key'
  }
});
```

---

## Theme Types

Sand.js supports three theme types, each suited for different data characteristics.

### Qualitative

For categorical data with no inherent order.

**Best for:**
- Categories without ranking
- Departments, teams, products
- Discrete groups

**Characteristics:**
- Distinct, easily distinguishable colors
- No implied progression or hierarchy
- Maximum perceptual difference between colors

```javascript
colorTheme: {
  type: 'qualitative',
  palette: 'default',  // or 'pastel', 'vibrant', 'earth', 'ocean', 'sunset'
  assignBy: 'key'      // Common choice for qualitative
}
```

### Sequential

For ordered data with progression from low to high.

**Best for:**
- Values with natural ordering
- Metrics, scores, rankings
- Time periods

**Characteristics:**
- Light to dark progression
- Single hue or related hues
- Implies magnitude or importance

```javascript
colorTheme: {
  type: 'sequential',
  palette: 'blues',   // or 'greens', 'purples', 'oranges'
  assignBy: 'depth'   // Common choice for sequential
}
```

### Diverging

For data with a meaningful midpoint.

**Best for:**
- Positive/negative values
- Above/below average
- Deviation from center

**Characteristics:**
- Two contrasting hues
- Light midpoint
- Dark extremes on both ends

```javascript
colorTheme: {
  type: 'diverging',
  palette: 'redBlue',  // or 'orangePurple', 'greenRed'
  assignBy: 'value'    // Common choice for diverging
}
```

---

## Color Assignment Strategies

The `assignBy` property determines how colors from the palette are assigned to arcs.

### By Key

Assigns consistent colors based on arc keys.

```javascript
colorTheme: {
  assignBy: 'key'
}
```

**How it works:**
- Arcs with the same `key` get the same color
- Keys are mapped to palette indices
- Consistent across layers and updates

**Example:**
```javascript
// Configuration
layers: [
  {
    id: 'layer1',
    tree: [
      { name: 'Engineering', key: 'eng', value: 50 },
      { name: 'Design', key: 'design', value: 30 }
    ]
  },
  {
    id: 'layer2',
    tree: [
      { name: 'Frontend', key: 'eng', value: 25 },  // Same color as Engineering
      { name: 'Backend', key: 'eng', value: 25 },   // Same color as Engineering
      { name: 'UI Team', key: 'design', value: 30 }  // Same color as Design
    ]
  }
]
```

**Best for:**
- Qualitative themes
- Maintaining visual consistency across layers
- Highlighting relationships

**Default for:** Qualitative themes

### By Depth

Assigns colors based on hierarchical depth.

```javascript
colorTheme: {
  assignBy: 'depth'
}
```

**How it works:**
- Depth 0 gets first color
- Depth 1 gets second color
- Pattern continues through palette

**Example:**
```javascript
tree: [
  {
    name: 'Root',  // Depth 0 - first color
    children: [
      { name: 'Child 1', value: 30 },  // Depth 1 - second color
      {
        name: 'Child 2',
        value: 20,
        children: [
          { name: 'Grandchild', value: 20 }  // Depth 2 - third color
        ]
      }
    ]
  }
]
```

**Best for:**
- Sequential themes
- Showing hierarchy levels
- Distinguishing parent-child relationships

**Default for:** Sequential and diverging themes

### By Index

Assigns colors sequentially by arc position.

```javascript
colorTheme: {
  assignBy: 'index'
}
```

**How it works:**
- First arc gets first color
- Second arc gets second color
- Cycles through palette

**Example:**
```javascript
tree: [
  { name: 'Arc 1', value: 25 },  // First color
  { name: 'Arc 2', value: 25 },  // Second color
  { name: 'Arc 3', value: 25 },  // Third color
  { name: 'Arc 4', value: 25 }   // Fourth color
]
```

**Best for:**
- Simple categorization
- When keys are unavailable
- Aesthetic variation

### By Value

Maps colors to normalized arc values.

```javascript
colorTheme: {
  assignBy: 'value'
}
```

**How it works:**
- Lowest value gets first color
- Highest value gets last color
- Interpolated in between

**Example:**
```javascript
// Values: 10, 50, 90
// With 5-color sequential palette:
{ name: 'Low', value: 10 }   // First color (lightest)
{ name: 'Mid', value: 50 }   // Middle color
{ name: 'High', value: 90 }  // Last color (darkest)
```

**Best for:**
- Diverging themes
- Heatmap-style visualizations
- Showing value magnitude

**Normalization:**
Values are normalized within each layer:
```
normalizedValue = (value - minValue) / (maxValue - minValue)
colorIndex = floor(normalizedValue * (paletteSize - 1))
```

---

## Built-in Palettes

### Qualitative Palettes

#### default
Classic categorical colors with good contrast.
```javascript
palette: 'default'
// Colors: 10 distinct hues
```

#### pastel
Soft, muted colors for subtle visualizations.
```javascript
palette: 'pastel'
// Colors: Light, low-saturation hues
```

#### vibrant
Bold, saturated colors for high impact.
```javascript
palette: 'vibrant'
// Colors: High-saturation, energetic
```

#### earth
Natural, warm earth tones.
```javascript
palette: 'earth'
// Colors: Browns, greens, tans
```

#### ocean
Cool blues and greens.
```javascript
palette: 'ocean'
// Colors: Blues, teals, aquas
```

#### sunset
Warm oranges, reds, and yellows.
```javascript
palette: 'sunset'
// Colors: Oranges, reds, pinks
```

### Sequential Palettes

#### blues
Light to dark blue progression.
```javascript
palette: 'blues'
// Range: #e3f2fd → #0d47a1
```

#### greens
Light to dark green progression.
```javascript
palette: 'greens'
// Range: #e8f5e9 → #1b5e20
```

#### purples
Light to dark purple progression.
```javascript
palette: 'purples'
// Range: #f3e5f5 → #4a148c
```

#### oranges
Light to dark orange progression.
```javascript
palette: 'oranges'
// Range: #fff3e0 → #e65100
```

### Diverging Palettes

#### redBlue
Red (negative) to blue (positive) through white.
```javascript
palette: 'redBlue'
// Range: #d32f2f → #ffffff → #1976d2
```

#### orangePurple
Orange to purple through white.
```javascript
palette: 'orangePurple'
// Range: #ff6f00 → #ffffff → #7b1fa2
```

#### greenRed
Green (positive) to red (negative) through white.
```javascript
palette: 'greenRed'
// Range: #388e3c → #ffffff → #d32f2f
```

---

## Custom Palettes

Define your own color palettes using hex codes, RGB, or any CSS color format.

### Array of Colors

```javascript
colorTheme: {
  type: 'qualitative',
  palette: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7dc6f', '#a29bfe'],
  assignBy: 'key'
}
```

### Requirements

- Must be an array of valid CSS color strings
- Minimum 2 colors recommended
- Will cycle if more arcs than colors

### Example: Brand Colors

```javascript
const brandPalette = [
  '#003f5c',  // Navy
  '#58508d',  // Purple
  '#bc5090',  // Pink
  '#ff6361',  // Coral
  '#ffa600'   // Orange
];

colorTheme: {
  type: 'qualitative',
  palette: brandPalette,
  assignBy: 'key'
}
```

### Example: Custom Sequential

```javascript
// Light to dark custom gradient
const customSequential = [
  '#fff7ec',
  '#fee8c8',
  '#fdd49e',
  '#fdbb84',
  '#fc8d59',
  '#ef6548',
  '#d7301f',
  '#990000'
];

colorTheme: {
  type: 'sequential',
  palette: customSequential,
  assignBy: 'depth'
}
```

---

## Custom Color Keys

Use the `deriveKey` function to derive color assignment keys from arc properties.

### Basic Usage

```javascript
colorTheme: {
  type: 'qualitative',
  palette: 'ocean',
  deriveKey: (arc) => arc.data.category  // Use custom property
}
```

### Use Cases

#### Color by Custom Property

```javascript
// Node structure
tree: [
  { name: 'Project A', value: 50, category: 'development' },
  { name: 'Project B', value: 30, category: 'research' },
  { name: 'Project C', value: 20, category: 'development' }
]

// Color theme
colorTheme: {
  type: 'qualitative',
  palette: 'vibrant',
  deriveKey: (arc) => arc.data.category
  // Project A and C get same color (both 'development')
  // Project B gets different color ('research')
}
```

#### Color by First Letter

```javascript
colorTheme: {
  type: 'qualitative',
  palette: 'default',
  deriveKey: (arc) => arc.data.name[0].toUpperCase()
  // Groups arcs by first letter of name
}
```

#### Color by Value Range

```javascript
colorTheme: {
  type: 'qualitative',
  palette: ['#green', '#yellow', '#red'],
  deriveKey: (arc) => {
    if (arc.data.value < 30) return 'low';
    if (arc.data.value < 70) return 'medium';
    return 'high';
  }
}
```

#### Color by Layer

```javascript
colorTheme: {
  type: 'qualitative',
  palette: 'ocean',
  deriveKey: (arc) => arc.layerId
  // Each layer gets distinct color
}
```

### Function Signature

```typescript
type DeriveKeyFunction = (arc: LayoutArc) => string | undefined;
```

**Parameters:**
- `arc`: Complete arc object with geometry and metadata

**Returns:**
- String key for color assignment
- `undefined` falls back to default behavior

**Available Arc Properties:**
```javascript
{
  layerId: string;
  data: TreeNodeInput;  // Original node
  x0: number;           // Start angle
  x1: number;           // End angle
  y0: number;           // Inner radius
  y1: number;           // Outer radius
  depth: number;        // Hierarchical depth
  key?: string;         // Node key
  percentage: number;   // Percentage of parent
}
```

---

## Node Color Overrides

Individual nodes can override the theme color using the `color` property.

### Basic Override

```javascript
tree: [
  {
    name: 'Normal Arc',
    value: 50
    // Uses theme color
  },
  {
    name: 'Special Arc',
    value: 50,
    color: '#ff0000'  // Overrides theme, renders red
  }
]
```

### Use Cases

#### Highlight Special Items

```javascript
tree: [
  { name: 'Regular', value: 30 },
  { name: 'PREMIUM', value: 20, color: '#ffd700' },  // Gold
  { name: 'Regular', value: 50 }
]
```

#### Status Indicators

```javascript
tree: [
  { name: 'Completed', value: 60, color: '#4caf50' },  // Green
  { name: 'In Progress', value: 30, color: '#ff9800' }, // Orange
  { name: 'Blocked', value: 10, color: '#f44336' }      // Red
]
```

#### Mixed Coloring

```javascript
tree: [
  {
    name: 'Department',
    children: [
      { name: 'Team A', value: 30 },  // Theme color
      { name: 'VIP Team', value: 20, color: '#9c27b0' },  // Purple
      { name: 'Team B', value: 50 }   // Theme color
    ]
  }
]
```

### Supported Formats

Any valid CSS color:
```javascript
color: '#ff6b6b'                    // Hex
color: 'rgb(255, 107, 107)'         // RGB
color: 'rgba(255, 107, 107, 0.8)'   // RGBA with transparency
color: 'hsl(0, 100%, 71%)'          // HSL
color: 'red'                        // Named color
```

---

## Examples

### Example 1: Department Hierarchy

```javascript
renderSVG({
  el: '#chart',
  config: {
    size: { radius: 200 },
    layers: [{
      id: 'main',
      radialUnits: [0, 2],
      angleMode: 'free',
      tree: [
        { name: 'Engineering', key: 'eng', value: 50 },
        { name: 'Design', key: 'design', value: 30 },
        { name: 'Marketing', key: 'marketing', value: 20 }
      ]
    }]
  },
  colorTheme: {
    type: 'qualitative',
    palette: 'vibrant',
    assignBy: 'key'
  }
});
```

### Example 2: Time Series with Sequential

```javascript
renderSVG({
  el: '#chart',
  config: {
    size: { radius: 200 },
    layers: [{
      id: 'quarters',
      radialUnits: [0, 4],
      angleMode: 'free',
      tree: [
        {
          name: 'Q1',
          children: [
            { name: 'Jan', value: 100 },
            { name: 'Feb', value: 120 },
            { name: 'Mar', value: 110 }
          ]
        },
        // ... more quarters
      ]
    }]
  },
  colorTheme: {
    type: 'sequential',
    palette: 'blues',
    assignBy: 'depth'  // Quarters light, months darker
  }
});
```

### Example 3: Performance with Diverging

```javascript
renderSVG({
  el: '#chart',
  config: {
    size: { radius: 200 },
    layers: [{
      id: 'performance',
      radialUnits: [0, 2],
      angleMode: 'free',
      tree: [
        { name: 'High Performers', value: 30 },   // Dark blue
        { name: 'Average', value: 50 },           // Light/white
        { name: 'Needs Improvement', value: 20 }  // Dark red
      ]
    }]
  },
  colorTheme: {
    type: 'diverging',
    palette: 'redBlue',
    assignBy: 'value'
  }
});
```

### Example 4: Custom Brand Palette

```javascript
const brandColors = ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560'];

renderSVG({
  el: '#chart',
  config,
  colorTheme: {
    type: 'qualitative',
    palette: brandColors,
    assignBy: 'key'
  }
});
```

### Example 5: Custom Derivation

```javascript
// Color by priority level
renderSVG({
  el: '#chart',
  config: {
    size: { radius: 200 },
    layers: [{
      id: 'tasks',
      radialUnits: [0, 2],
      angleMode: 'free',
      tree: [
        { name: 'Critical Bug', value: 20, priority: 'high' },
        { name: 'Feature', value: 50, priority: 'medium' },
        { name: 'Nice to Have', value: 30, priority: 'low' }
      ]
    }]
  },
  colorTheme: {
    type: 'qualitative',
    palette: {
      high: '#f44336',
      medium: '#ff9800',
      low: '#4caf50'
    },
    deriveKey: (arc) => arc.data.priority
  }
});
```

---

## Accessing Palette Constants

Import palette constants to inspect available colors:

```javascript
import {
  QUALITATIVE_PALETTES,
  SEQUENTIAL_PALETTES,
  DIVERGING_PALETTES
} from '@akitain/sandjs';

console.log(QUALITATIVE_PALETTES.ocean);
// Array of colors in the ocean palette

console.log(SEQUENTIAL_PALETTES.blues);
// Array of colors from light to dark blue

console.log(DIVERGING_PALETTES.redBlue);
// Array of colors from red through white to blue
```

---

## Best Practices

1. **Match Theme to Data Type**
   - Categorical → Qualitative
   - Ordered → Sequential
   - Centered → Diverging

2. **Use Stable Keys**
   - Ensure keys don't change between updates
   - Use semantic keys (not random values)

3. **Consider Accessibility**
   - Ensure sufficient contrast
   - Don't rely solely on color
   - Test with colorblind simulation

4. **Limit Palette Size**
   - Too many colors reduce distinguishability
   - Consider grouping for >10 categories

5. **Test Visual Hierarchy**
   - Dark colors appear more prominent
   - Use intentionally for emphasis

6. **Override Sparingly**
   - Node color overrides should be exceptional
   - Maintain visual consistency where possible

---

## Related Documentation

- [Configuration Reference](../api/configuration.md)
- [Styling Guide](./styling.md)
- [Examples](../examples/basic.md)

---

[← Back to Documentation](../README.md) | [Next: Navigation →](./navigation.md)
