# Event Callbacks

[← Back to Documentation](../README.md)

Handle user interactions with custom event callbacks.

## Available Events

Sand.js provides four event callbacks:

```typescript
interface RenderSvgOptions {
  onArcEnter?: (payload: ArcPointerEventPayload) => void;
  onArcMove?: (payload: ArcPointerEventPayload) => void;
  onArcLeave?: (payload: ArcPointerEventPayload) => void;
  onArcClick?: (payload: ArcClickEventPayload) => void;
}
```

## Event Payloads

### ArcPointerEventPayload

```typescript
interface ArcPointerEventPayload {
  arc: LayoutArc;         // The arc data
  path: SVGPathElement;   // The SVG element
  event: PointerEvent;    // Browser pointer event
}
```

### ArcClickEventPayload

```typescript
interface ArcClickEventPayload {
  arc: LayoutArc;         // The arc data
  path: SVGPathElement;   // The SVG element
  event: MouseEvent;      // Browser mouse event
}
```

## onArcEnter

Triggered when pointer enters an arc.

```javascript
renderSVG({
  el: '#chart',
  config,
  onArcEnter: ({ arc, path, event }) => {
    console.log('Entered:', arc.data.name);
    path.style.opacity = '0.8';
  }
});
```

**Use cases:**
- Show custom UI elements
- Highlight related content
- Update external displays
- Trigger sound effects

## onArcMove

Triggered when pointer moves within an arc.

```javascript
renderSVG({
  el: '#chart',
  config,
  onArcMove: ({ arc, path, event }) => {
    // Update custom tooltip position
    const tooltip = document.getElementById('custom-tooltip');
    tooltip.style.left = `${event.clientX + 10}px`;
    tooltip.style.top = `${event.clientY + 10}px`;
  }
});
```

**Use cases:**
- Custom tooltip positioning
- Cursor tracking
- Real-time coordinate display
- Interactive annotations

## onArcLeave

Triggered when pointer leaves an arc.

```javascript
renderSVG({
  el: '#chart',
  config,
  onArcLeave: ({ arc, path, event }) => {
    console.log('Left:', arc.data.name);
    path.style.opacity = '1';
  }
});
```

**Use cases:**
- Reset visual states
- Hide custom elements
- Clear temporary data
- Log interaction time

## onArcClick

Triggered when an arc is clicked.

```javascript
renderSVG({
  el: '#chart',
  config,
  onArcClick: ({ arc, path, event }) => {
    console.log('Clicked:', arc.data.name);
    alert(`You clicked: ${arc.data.name}`);

    // Prevent default behavior if needed
    event.preventDefault();
  }
});
```

**Use cases:**
- Navigation triggers
- Detail panel updates
- Selection tracking
- External data fetching

## Complete Example

```javascript
renderSVG({
  el: '#chart',
  config,
  onArcEnter: ({ arc, path }) => {
    path.style.filter = 'brightness(1.2)';
    document.getElementById('info-panel').innerHTML = `
      <h3>${arc.data.name}</h3>
      <p>Value: ${arc.data.value}</p>
    `;
  },
  onArcMove: ({ arc, event }) => {
    const coords = document.getElementById('coordinates');
    coords.textContent = `X: ${event.clientX}, Y: ${event.clientY}`;
  },
  onArcLeave: ({ path }) => {
    path.style.filter = 'none';
    document.getElementById('info-panel').innerHTML = '';
  },
  onArcClick: ({ arc, event }) => {
    console.log('Clicked arc:', arc);

    // Fetch additional data
    fetch(`/api/details/${arc.key}`)
      .then(res => res.json())
      .then(data => {
        document.getElementById('detail-view').innerHTML =
          `<pre>${JSON.stringify(data, null, 2)}</pre>`;
      });
  }
});
```

## Best Practices

1. **Keep handlers fast**: Slow handlers impact interaction responsiveness
2. **Clean up resources**: Use `onArcLeave` to reset states
3. **Handle edge cases**: Check for missing data or properties
4. **Prevent default carefully**: Only when necessary
5. **Debounce intensive operations**: Especially in `onArcMove`

## Event Order

Typical interaction sequence:

```
onArcEnter → onArcMove (multiple times) → onArcLeave
                    ↓
              onArcClick (if clicked)
```

## Accessing Arc Data

All arc properties are available:

```javascript
onArcClick: ({ arc }) => {
  console.log('Layer:', arc.layerId);
  console.log('Name:', arc.data.name);
  console.log('Value:', arc.data.value);
  console.log('Key:', arc.key);
  console.log('Depth:', arc.depth);
  console.log('Percentage:', arc.percentage);
  console.log('Angular range:', arc.x0, arc.x1);
  console.log('Radial range:', arc.y0, arc.y1);

  // Access any custom node properties
  console.log('Custom:', arc.data.customProperty);
}
```

---

[← Back to Documentation](../README.md)
