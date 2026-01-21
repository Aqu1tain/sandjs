# Browser Support

Sand.js is designed for modern browsers. This guide documents officially supported browsers and any known limitations.

## Compatibility Matrix

| Browser | Minimum Version | Status |
|---------|-----------------|--------|
| Chrome | 80+ | Supported |
| Firefox | 74+ | Supported |
| Safari | 13.1+ | Supported |
| Edge | 80+ | Supported |
| Opera | 67+ | Supported |
| iOS Safari | 13.4+ | Supported |
| Chrome Android | 80+ | Supported |
| Samsung Internet | 13.0+ | Supported |
| Internet Explorer | - | Not Supported |

> **Note:** The distributed bundle targets ESNext and includes ES2020 syntax (optional chaining, nullish coalescing). If you need to support older browsers, you must transpile the bundle with Babel or similar tools.

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

### ES2020+ Features Used

- Optional chaining (`?.`)
- Nullish coalescing (`??`)
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

The distributed bundle (`dist/sandjs.mjs`) targets **ESNext** and includes ES2020 syntax. If you need to support older browsers:

1. **Transpile with Babel**: Add `@babel/preset-env` with appropriate targets
2. **Use source files**: Import from source and include in your build pipeline
3. **Add polyfills**: `WeakMap`, `AbortController`, and `PointerEvent` polyfills may be needed

Example Babel configuration for broader support:

```json
{
  "presets": [
    ["@babel/preset-env", {
      "targets": "> 0.5%, last 2 versions, not dead"
    }]
  ]
}
```
