<div align="center">

# 🏝️ Sand.js
**Sunburst Advanced Node Data**

[![npm version](https://img.shields.io/npm/v/@akitain/sandjs.svg)](https://www.npmjs.com/package/@akitain/sandjs)
[![GitHub stars](https://img.shields.io/github/stars/aqu1tain/sandjs.svg?style=social&label=Star)](https://github.com/aQu1tain/sandjs)

</div>

---

## ✨ What is Sand.js?

**Sand.js** is a lightweight, framework-agnostic JavaScript library for building **sunburst charts** using **SVG**.  
It is fully **data-driven**: you describe your chart in **JSON**, and Sand.js takes care of both **layout computation** and **rendering**.  

Sand.js is designed to be:
- **Lightweight**: no heavy dependencies.
- **Agnostic**: works with plain HTML, or in any framework.
- **JSON-driven**: describe your sunburst once, render anywhere.
- **Accessible**: interactive charts with sensible defaults.

---

## 📖 Key Concepts

| Term        | Description |
|-------------|-------------|
| **Sunburst** | The entire chart, composed of one or more layers. |
| **Layer**    | A logical group of rings, defined by a dataset and a mode (`free` or `align`). |
| **Ring**     | A radial band, automatically computed from nodes and their `expandLevels`. |
| **Node**     | A declared unit of data in JSON. May have children (tree mode) or not (flat mode). |
| **Leaf**     | A node without children. |
| **Key-group** | A logical grouping of nodes sharing the same `key`, used for alignment and interactions. |
| **Arc**      | A computed geometric entity ready to be rendered (`x0, x1, y0, y1`). |

---

## 🧩 Entities

### Sunburst
| Property      | Type       | Description |
|---------------|------------|-------------|
| `size.radius` | `number`   | Final radius in pixels. |
| `size.angle?` | `number`   | Total angle (default `2π` = full circle). |
| `layers`      | `Layer[]`  | List of layers from inside out. |

---

### Layer
| Property      | Type       | Description |
|---------------|------------|-------------|
| `id`          | `string`   | Unique identifier. |
| `radialUnits` | `[n,n]`    | Radial interval in unit rings. |
| `angleMode`   | `"free" \| "align"` | Angular partition mode. |
| `alignWith?`  | `string`   | Reference layer ID (if `align`). |
| `padAngle?`   | `number`   | Angular spacing between arcs. |
| `baseOffset?` | `number`   | Global rotation (radians). |
| `arcOffsetMode?` | `"relative" \| "absolute"` | How offsets are applied. |
| `tree`        | `Node \| Node[]` | Data for the layer. Supports tree or flat structure. |

---

### Node
| Property     | Type       | Description |
|--------------|------------|-------------|
| `name`       | `string`   | Display name. |
| `value`      | `number`   | Size of the arc (summed if children exist). |
| `key?`       | `string`   | Stable identifier for alignment, animation, and coloring. |
| `expandLevels?` | `number` | Radial thickness in rings (default = 1). |
| `offset?`    | `number`   | Local offset. |
| `color?`     | `string`   | Custom arc color (overrides palette). |
| `children?`  | `Node[]`   | Child nodes (tree mode only). |
| `tooltip?`   | `string`   | Custom tooltip text. |
| `collapsed?` | `boolean`  | Keep descendants hidden from layout while their values contribute to the parent arc. |
| `hidden?`    | `boolean`  | Hides the node completely. |

---

### Arc (computed by layout)
| Property   | Type     | Description |
|------------|----------|-------------|
| `layerId`  | string   | Origin layer ID. |
| `data`     | Node     | Reference to original node. |
| `x0, x1`   | number   | Angular start and end (radians). |
| `y0, y1`   | number   | Inner/outer radius (pixels). |
| `depth`    | number   | Logical depth in its layer. |
| `key?`     | string   | Copy of node key. |
| `percentage` | number | Relative percentage in its parent. |

---

## 🚀 Getting Started

```bash
npm install @akitain/sandjs
```

Render a sunburst in the browser:

```html
<svg id="chart"></svg>
<script type="module">
  import { renderSVG } from 'sandjs';

  const config = {
    size: { radius: 160 },
    layers: [
      {
        id: 'root',
        radialUnits: [0, 2],
        angleMode: 'free',
        tree: [
          { name: 'Data', value: 6, key: 'data' },
          {
            name: 'Design',
            key: 'design',
            value: 4,
            children: [
              { name: 'UI', value: 2 },
              { name: 'Brand', value: 2 }
            ]
          }
        ]
      }
    ]
  };

  const chart = renderSVG({
    el: '#chart',
    config,
    tooltip: true,
    onArcClick: ({ arc }) => console.log('Pinned', arc.data.name)
  });

  // Update the chart later without re-attaching listeners
  chart.update({
    config: {
      ...config,
      size: { radius: 180 },
    }
  });
</script>
```

The demo under `demo/` shows relative/absolute offsets, tooltips, and selection callbacks. Run `npm run dev` to start the development server at `http://localhost:4173` to experiment.

---

## 🎨 Color Themes

Sand.js includes a comprehensive color theme system with 14 built-in palettes and flexible assignment strategies.

### Theme Types

**Qualitative** (for categorical data):
```javascript
import { renderSVG, QUALITATIVE_PALETTES } from '@akitain/sandjs';

renderSVG({
  el: '#chart',
  config,
  colorTheme: {
    type: 'qualitative',
    palette: 'ocean', // 'default' | 'pastel' | 'vibrant' | 'earth' | 'ocean' | 'sunset'
    assignBy: 'key'   // assigns consistent colors based on arc keys
  }
});
```

**Sequential** (for ordered data):
```javascript
colorTheme: {
  type: 'sequential',
  palette: 'blues', // 'blues' | 'greens' | 'purples' | 'oranges'
  assignBy: 'depth' // light to dark by depth level
}
```

**Diverging** (for data with meaningful midpoint):
```javascript
colorTheme: {
  type: 'diverging',
  palette: 'redBlue', // 'redBlue' | 'orangePurple' | 'greenRed'
  assignBy: 'value'   // color by normalized value
}
```

### Color Assignment Strategies

- **`key`**: Consistent colors for arcs with the same key (default for qualitative)
- **`depth`**: Colors by hierarchical depth (default for sequential/diverging)
- **`index`**: Sequential colors by arc index in layer
- **`value`**: Colors mapped to normalized arc values

### Custom Palettes

```javascript
colorTheme: {
  type: 'qualitative',
  palette: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7dc6f'], // custom colors
  assignBy: 'key'
}
```

### Custom Color Keys

```javascript
colorTheme: {
  type: 'qualitative',
  palette: 'default',
  deriveKey: (arc) => arc.data.category // use any arc property for color grouping
}
```

**Note**: Individual node colors set via `node.color` always take precedence over theme colors.

---

## 🧭 Navigation & Drilldown

Enable interactive drill-down navigation with smooth transitions:

```javascript
const chart = renderSVG({
  el: '#chart',
  config,
  navigation: true, // enables click-to-zoom with defaults
  transition: true  // smooth animations
});
```

### Advanced Navigation Options

```javascript
navigation: {
  layers: ['main', 'details'], // which layers support navigation
  rootLabel: 'Home',           // breadcrumb root text
  focusTransition: {           // custom zoom animation
    duration: 600,
    easing: (t) => t * t       // quadratic ease-in
  },
  onFocusChange: (focus) => {
    if (focus) {
      console.log('Focused on:', focus.arc.data.name);
    } else {
      console.log('Returned to root');
    }
  }
}
```

### Programmatic Navigation

```javascript
// Reset to root view
if (chart.resetNavigation) {
  chart.resetNavigation();
}
```

### Interactive Breadcrumbs

```javascript
breadcrumbs: {
  container: '#breadcrumb-trail',
  interactive: true,  // enable click-to-navigate on breadcrumb items
  separator: ' › ',
  rootLabel: 'Overview'
}
```

---

### Configuration essentials

- **Layers** (`free` or `align`): `free` splits siblings by value; `align` reuses the angular span of a keyed arc in another layer.
- **Offsets**: `defaultArcOffset` and per-node `offset` shift arcs. In `relative` mode the offset is a fraction of the available span; in `absolute` mode it is applied in radians.
- **Padding**: Use `padAngle` on a layer or node to reserve gap space between siblings.
- **Callbacks**: `renderSVG` exposes `onArcEnter`, `onArcMove`, `onArcLeave`, and `onArcClick` with the arc metadata and the rendered `path`.
- **Tooltips**: enable with `tooltip: true` or pass `{ formatter, container }` for custom markup.
- **Breadcrumbs**: pass `breadcrumbs: true` to auto-render a trail or supply `{ container, formatter, separator }`; `formatArcBreadcrumb(arc)` helps generate custom labels.
- **Highlights**: enable `highlightByKey: true` (or supply options) to add a shared class for arcs with the same `key`, and optionally toggle pinned highlights via `pinOnClick`.
- **Collapsing**: set `collapsed: true` on a node to keep its descendants hidden from the rendered layout while preserving its aggregated value.
- **Updates**: keep the returned handle from `renderSVG` and call `chart.update({ config: nextConfig })` (or pass a full config) to redraw without re-binding listeners.

See `src/types/index.ts` for the full TypeScript contracts.

## 🧪 Build & Test

```bash
npm run test    # type check + node test runner
npm run build   # rollup (ESM + minified IIFE bundles)
npm run verify  # convenience: runs tests and build
```

`dist/` contains the publishable artifacts. The IIFE bundle exposes `window.SandJS` for CDN usage (`https://unpkg.com/@akitain/sandjs@0.3.1/dist/sandjs.iife.min.js`).

## ✅ Release Checklist

1. `npm run verify`
2. Manually review the `demo/` example in a browser.
3. Update `CHANGELOG.md` and bump the package version.
4. `npm publish --access public`

---

## 🛣️ Roadmap

### Phase 0.1 – MVP (npm + CDN)
- Core layout (`layout(config)` → arcs `{x0,x1,y0,y1}`)
- SVG renderer (`renderSVG({ el, config })`)
- JSON-driven charts (radius, layers, nodes)
- Modes `free` / `align` with `key`
- Basic `expandLevels` (within a layer)
- Offsets: `baseOffset`, `arcOffsetMode`, `defaultArcOffset`
- Auto color palette (category10)
- Simple interactions: hover, click callbacks
- Builds: ESM + IIFE (CDN/global)
- Publish to npm + GitHub Pages demo

### Phase 0.2 – Interactions & Stability
- Tooltips (name, value, %)
- Breadcrumbs (full path of arc)
- Highlight by key
- Collapse/expand (`collapsed: true`)
- API `update(newConfig)` (no animation yet)
- Unit tests for invariants (angles, radial order)

### Phase 0.3 – Animation & Polish ✅
- ✅ Animated transitions (morphing arcs with key-based interpolation)
- ✅ Zoom/drill-down (interactive navigation with breadcrumbs)
- ✅ Radial labels (auto-positioned text on curved paths)
- ✅ Color themes (14 palettes: qualitative, sequential, diverging)
- ✅ Transition options (duration, easing, delay)
- Export: `exportSVG()`, `exportPNG()` → planned for 0.4
- Accessibility (aria-labels, keyboard nav) → planned for 0.4

### Phase 0.4 – Extensions & Performance
- Canvas renderer (performance for >5k arcs)
- Plugin system (legends, labels, effects)
- Layout-only mode (server / custom renderers)
- Partial angle support (gauge 180°/270°)
- Advanced animation (easing, delays)
- Large dataset tests (50k arcs in Canvas)
- Publish also on JSR (Deno/Bun)

### Long term (1.0+)
- Online editor/playground
- Smart labels (collision detection)
- Skins/themes (flat, material, dark)
- Framework wrappers (React/Vue/Svelte)
- Full documentation site + gallery


## 📝 License

MIT © Aqu1tain
