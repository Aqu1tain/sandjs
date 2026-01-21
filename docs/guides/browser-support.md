# Browser Support

Sand.js is designed for modern browsers. This guide documents officially supported browsers and any known limitations.

## Compatibility Matrix

| Browser | Minimum Version | Status |
|---------|-----------------|--------|
| Chrome | 66+ | Supported |
| Firefox | 57+ | Supported |
| Safari | 13+ | Supported |
| Edge | 79+ (Chromium) | Supported |
| Opera | 53+ | Supported |
| iOS Safari | 13+ | Supported |
| Chrome Android | 66+ | Supported |
| Samsung Internet | 9.0+ | Supported |
| Internet Explorer | - | Not Supported |

## Required Browser Features

Sand.js relies on the following browser APIs:

### Core Requirements

| Feature | Used For |
|---------|----------|
| SVG 1.1 | Chart rendering |
| ES6 (ES2015) | Language features |
| WeakMap | Navigation state tracking |
| AbortController | Event listener cleanup |
| Pointer Events | Mouse/touch interactions |
| requestAnimationFrame | Smooth animations |

### ES6+ Features Used

- Arrow functions
- `const` / `let`
- Template literals
- Destructuring
- Spread operator
- `Map` / `Set` / `WeakMap`
- Classes

### Fallbacks Provided

| Feature | Fallback |
|---------|----------|
| `requestAnimationFrame` | `setTimeout` (16ms) |
| `performance.now()` | `Date.now()` |

## Why IE 11 Is Not Supported

Internet Explorer 11 lacks several critical features:

- **WeakMap**: Required for navigation system memory management
- **Pointer Events**: Required for unified mouse/touch handling
- **AbortController**: Required for proper event listener cleanup
- **ES6 syntax**: Would require full transpilation and polyfills

Supporting IE 11 would require significant polyfills and increase bundle size substantially. Given IE 11's end-of-life status (June 2022), we recommend using a modern browser.

## Mobile Considerations

Sand.js works on mobile browsers with these notes:

- **Touch**: Pointer Events provide unified touch/mouse support
- **Performance**: Reduce node count by ~50% for smooth interactions on mobile
- **Viewport**: Charts are responsive; use appropriate `radius` values for mobile screens

## Testing Your Browser

You can verify compatibility by checking if your browser supports these APIs:

```javascript
const isSupported =
  typeof WeakMap !== 'undefined' &&
  typeof AbortController !== 'undefined' &&
  typeof PointerEvent !== 'undefined' &&
  typeof requestAnimationFrame !== 'undefined';

console.log('Sand.js supported:', isSupported);
```

## Known Browser-Specific Issues

### Safari

- No known issues

### Firefox

- No known issues

### Edge (Legacy, pre-Chromium)

- Edge 16-18 may work but is not officially tested
- Recommend upgrading to Edge 79+ (Chromium-based)

## Transpilation

The distributed bundle (`dist/sandjs.mjs`) targets ES2017. If you need broader compatibility, you can:

1. Use the source files directly with your own build pipeline
2. Transpile the distributed bundle with Babel

Note: Even with transpilation, polyfills for `WeakMap`, `AbortController`, and `PointerEvent` would be required for older browsers.
