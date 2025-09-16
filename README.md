# 🏝️ Sand.js
**Sunburst Advanced Node Data**

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

### Phase 0.3 – Animation & Polish
- Animated transitions (update with interpolation by key)
- Zoom/drill-down
- Basic radial labels
- Export: `exportSVG()`, `exportPNG()`
- Color themes (qualitative, sequential, diverging)
- Accessibility (aria-labels, keyboard nav)

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
