# Breadcrumbs

[← Back to Documentation](../README.md)

Visualize navigation paths through hierarchical data with breadcrumb trails.

## Quick Start

```javascript
renderSVG({
  el: '#chart',
  config,
  breadcrumbs: true  // Enable with defaults
});
```

## Configuration

```typescript
interface BreadcrumbOptions {
  container?: HTMLElement | string;
  formatter?: (arc: LayoutArc) => string;
  separator?: string;
  emptyLabel?: string;
  interactive?: boolean;
}
```

### Options

**container**: Where to render breadcrumbs (default: auto-created div above chart)

```javascript
breadcrumbs: {
  container: '#breadcrumb-trail'
}
```

**formatter**: Custom label formatting

```javascript
breadcrumbs: {
  formatter: (arc) => arc.data.name.toUpperCase()
}
```

**separator**: Text between breadcrumb items (default: ' > ')

```javascript
breadcrumbs: {
  separator: ' / '  // or ' › ' or ' → '
}
```

**emptyLabel**: Label shown when no breadcrumb trail exists (default: '')

```javascript
breadcrumbs: {
  emptyLabel: 'Home'
}
```

**interactive**: Enable click navigation (default: false)

```javascript
breadcrumbs: {
  interactive: true  // Click to navigate
}
```

## Integration with Navigation

Breadcrumbs automatically update when navigation is enabled:

```javascript
renderSVG({
  el: '#chart',
  config,
  navigation: {
    rootLabel: 'Dashboard'  // Label for navigation root
  },
  breadcrumbs: {
    interactive: true,
    emptyLabel: 'Dashboard'  // Label when at root
  }
});
```

**Note**: `navigation.rootLabel` is for the navigation system, while `breadcrumbs.emptyLabel` is shown when no trail exists.

## Styling

```css
.sand-breadcrumbs {
  padding: 10px;
  background: #f5f5f5;
  border-radius: 4px;
}

.sand-breadcrumb-item {
  color: #666;
  cursor: default;
}

.sand-breadcrumb-item.interactive {
  color: #1976d2;
  cursor: pointer;
  text-decoration: underline;
}

.sand-breadcrumb-separator {
  margin: 0 8px;
  color: #999;
}
```

## Programmatic Usage

Use `formatArcBreadcrumb` helper:

```javascript
import { formatArcBreadcrumb } from '@akitain/sandjs';

const trail = formatArcBreadcrumb(arc);
// Returns: BreadcrumbTrailItem[]
```

---

[← Back to Documentation](../README.md) | [Next: Highlighting →](./highlighting.md)
