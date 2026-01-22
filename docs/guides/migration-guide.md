# Migration Guide

This guide covers breaking changes and migration steps when upgrading Sand.js.

## Migrating to 1.0

Sand.js 1.0 is largely backward compatible with 0.x versions. Most changes are additive new features. However, there are a few behavioral changes to be aware of.

### Breaking Changes Summary

| Version | Change | Impact |
|---------|--------|--------|
| 0.4.0 | Instant node removal | Visual change during navigation |
| 0.3.3 | Debug logging opt-in | No console warnings by default |

### Debug Logging Is Now Opt-In (v0.3.3)

**Before:** Label visibility warnings (e.g., "Hiding label because arc span is too narrow") appeared in the console by default.

**After:** Console logging is disabled by default. Pass `debug: true` to enable.

```javascript
// Before (0.3.2 and earlier)
renderSVG({
  el: '#chart',
  config
  // Warnings appeared automatically
});

// After (0.3.3+)
renderSVG({
  el: '#chart',
  config,
  debug: true  // Enable diagnostic logging
});
```

### Instant Node Removal (v0.4.0)

**Before:** Disappearing nodes during navigation faded out with animation.

**After:** Disappearing nodes remove instantly. Only nodes that stay and expand are animated.

This change improves perceived performance during drill-down navigation. If you relied on the fade-out animation for custom styling, you may need to adjust your CSS transitions.

### Multi-Parent Nodes Stable (1.0)

The multi-parent nodes feature introduced in v0.3.5 is now stable. The console warning on first use has been removed.

**Before (0.3.5 - 0.4.x):**
```javascript
// Console warning: "Multi-parent nodes is an experimental feature..."
const tree = {
  name: 'Child',
  parents: ['Parent1', 'Parent2']
};
```

**After (1.0):**
```javascript
// No warning, feature is stable
const tree = {
  name: 'Child',
  parents: ['Parent1', 'Parent2']
};
```

**Known limitations** (documented, not bugs):
- Key highlighting may not work as expected with multi-parent nodes
- Navigation can be ambiguous when a node has multiple parents

---

## New Features in 1.0

These are additive and don't require migration, but you may want to adopt them.

### Simple API (v0.4.0)

New shorthand for simple charts without layer configuration:

```javascript
// Before: Full config required
renderSVG({
  el: '#chart',
  config: {
    size: { radius: 300 },
    layers: [{
      id: 'main',
      radialUnits: [0, 5],
      angleMode: 'free',
      tree: { name: 'Root', children: [...] }
    }]
  }
});

// After: Simple API
renderSVG({
  el: '#chart',
  radius: 300,
  data: { name: 'Root', children: [...] }
});
```

### Label Options (v0.3.4 - 1.0)

New label customization options:

```javascript
renderSVG({
  el: '#chart',
  config,
  labels: {
    showLabels: true,
    labelColor: '#ffffff',      // Fixed color
    autoLabelColor: true,       // Auto contrast (black/white)
    fontSize: { min: 10, max: 16 },
    fontSizeScale: 0.5,         // Scale factor (v0.4.0+)
    minRadialThickness: 20,     // Hide labels on thin arcs
    rootLabelStyle: 'straight', // 'curved' or 'straight'
    labelPadding: 8,            // Padding around text (1.0)
    labelFit: 'both'            // 'both', 'height', or 'width' (1.0)
  }
});
```

### Border Customization (v0.3.4)

```javascript
renderSVG({
  el: '#chart',
  config,
  borderColor: '#1a1f2e',
  borderWidth: 2
});
```

### Keyboard Accessibility (1.0)

Arcs are now keyboard-accessible by default:
- `Tab` to focus arcs
- `Enter` or `Space` to drill down
- Focus shows tooltip and breadcrumb

No code changes required - this is automatic.

---

## Version Compatibility

| Sand.js | Node.js | Browsers |
|---------|---------|----------|
| 1.0 | 18+ | Chrome 80+, Firefox 74+, Safari 13.1+, Edge 80+ |
| 0.4.x | 18+ | Chrome 80+, Firefox 74+, Safari 13.1+, Edge 80+ |
| 0.3.x | 16+ | Chrome 66+, Firefox 57+, Safari 13+, Edge 79+ |

> **Note:** Starting from v0.3.0, the bundle uses ES2020 syntax (optional chaining, nullish coalescing). For older browsers, transpile with Babel.

---

## Deprecations

There are currently no deprecated APIs. All existing APIs remain supported.

---

## Getting Help

If you encounter issues during migration:

1. Check the [CHANGELOG](../../CHANGELOG.md) for detailed release notes
2. Open an issue on [GitHub](https://github.com/Aqu1tain/sandjs/issues)
