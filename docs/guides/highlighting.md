# Highlighting

[← Back to Documentation](../README.md)

Highlight related arcs sharing the same key across layers.

## Quick Start

```javascript
renderSVG({
  el: '#chart',
  config,
  highlightByKey: true  // Enable with defaults
});
```

**Behavior**: Hovering an arc highlights all arcs with matching keys.

## Configuration

```typescript
interface HighlightByKeyOptions {
  className?: string;
  includeSource?: boolean;
  deriveKey?: (arc: LayoutArc) => string | null;
  pinOnClick?: boolean;
  pinClassName?: string;
  onPinChange?: (payload: {
    arc: LayoutArc;
    path: SVGPathElement;
    pinned: boolean;
    event: MouseEvent;
  }) => void;
}
```

### Options

**className**: CSS class for highlighted arcs (default: 'sand-arc-highlighted')

```javascript
highlightByKey: {
  className: 'my-highlight-class'
}
```

**includeSource**: Whether to highlight the source arc (default: true)

```javascript
highlightByKey: {
  includeSource: false  // Don't highlight the hovered arc itself
}
```

**deriveKey**: Custom function to derive highlight key

```javascript
highlightByKey: {
  deriveKey: (arc) => arc.data.category  // Highlight by category instead of key
}
```

**pinOnClick**: Keep highlight on click (default: false)

```javascript
highlightByKey: {
  pinOnClick: true  // Click to pin highlight
}
```

**pinClassName**: CSS class for pinned state (default: 'sand-arc-pinned')

```javascript
highlightByKey: {
  pinOnClick: true,
  pinClassName: 'my-pinned-class'
}
```

**onPinChange**: Callback when pin state changes

```javascript
highlightByKey: {
  pinOnClick: true,
  onPinChange: ({ arc, path, pinned, event }) => {
    console.log(`${arc.data.name} is ${pinned ? 'pinned' : 'unpinned'}`);
    console.log('Arc key:', arc.key);
    console.log('Click position:', event.clientX, event.clientY);
  }
}
```

## Styling

```css
.sand-arc-highlighted {
  opacity: 1 !important;
  filter: brightness(1.2);
  stroke: #333;
  stroke-width: 2px;
}

/* Dim non-highlighted arcs */
.sand-arc-path:not(.sand-arc-highlighted) {
  opacity: 0.3;
}

/* Pinned state */
.sand-arc-pinned {
  stroke: #ff0000;
  stroke-width: 3px;
}
```

## Use Cases

- **Cross-layer relationships**: Show related items across layers
- **Category highlighting**: All items in same category
- **Time series**: Highlight same entity across time periods
- **Comparative analysis**: Compare same metric across dimensions

## Example

```javascript
const config = {
  layers: [
    {
      id: 'departments',
      radialUnits: [0, 1],
      angleMode: 'free',
      tree: [
        { name: 'Engineering', key: 'eng', value: 100 },
        { name: 'Design', key: 'design', value: 50 }
      ]
    },
    {
      id: 'teams',
      radialUnits: [1, 2],
      angleMode: 'align',
      alignWith: 'departments',
      tree: [
        { name: 'Frontend', key: 'eng', value: 50 },
        { name: 'Backend', key: 'eng', value: 50 },
        { name: 'UI', key: 'design', value: 25 },
        { name: 'UX', key: 'design', value: 25 }
      ]
    }
  ]
};

renderSVG({
  el: '#chart',
  config,
  highlightByKey: {
    pinOnClick: true,
    onPinChange: ({ arc, pinned }) => {
      if (pinned) {
        console.log('Pinned:', arc.data.name);
      } else {
        console.log('Unpinned');
      }
    }
  }
});
// Hovering "Engineering" highlights Engineering, Frontend, and Backend
```

---

[← Back to Documentation](../README.md) | [Next: Transitions →](./transitions.md)
