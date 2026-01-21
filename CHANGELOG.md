# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Multi-parent nodes stable**: Removed EXPERIMENTAL status from multi-parent nodes feature. Added comprehensive test suite (23 tests) covering detection, normalization, validation, layout, and integration. Documented known limitations (key highlighting, navigation ambiguity). Stable since 1.0.
- **Layer-specific rootLabelStyle**: Added `rootLabelStyle` option to `LayerConfig` for per-layer control of root label rendering (`'curved'` or `'straight'`). Layer setting takes priority over global `LabelOptions.rootLabelStyle`.
- **Configurable fontSizeScale**: Added `fontSizeScale` option to `LabelOptions` to control font size calculation. Default is `0.5`. Use smaller values (e.g., `0.25`) for large charts where fonts would otherwise always hit max size.
- **Accessibility improvements** (#47): Added keyboard navigation and ARIA support for screen readers:
  - Arc elements are now focusable (`tabindex="0"`) and have `role="button"` with descriptive `aria-label`
  - Keyboard navigation: Tab to focus arcs, Enter/Space to drill down
  - Focus shows tooltip and breadcrumb, blur hides them
  - SVG container has `role="graphics-document"` and `aria-label`
  - Tooltip element has `role="tooltip"`, breadcrumb has `role="status"`
- **Performance benchmarks** (#49): Added benchmark suite and performance documentation:
  - Benchmark scripts for layout, render, and navigation (`npm run bench`)
  - Performance guide with node limits and optimization tips (`docs/guides/performance.md`)
- **Configurable label padding** (#55): Added `labelPadding` option to `LabelOptions` to control spacing between label text and arc boundaries (default: 8px).
- **Label fit mode**: Added `labelFit` option to `LabelOptions` with values `'both'` (default), `'height'`, or `'width'` to control which dimension is checked for label visibility. When set to `'width'`, font size uses the configured max instead of scaling with arc thickness.

### Fixed
- **Straight label centering**: Fixed straight labels on full-circle root nodes (360° arcs) to render at the true center instead of on the arc midpoint. Only applies to innermost rings (`y0 ≈ 0`); outer full-circle layers keep labels on the ring's mid-radius to avoid overlapping other layers.

## [0.4.0] - 2026-01-20

### Added
- **Simple API**: New simplified way to create sunbursts without layer configuration. Use `data` and `radius` props directly instead of wrapping everything in `config.layers`. The library auto-computes layer depth from tree structure. Example: `renderSVG({ el: '#chart', radius: 400, data: [{ name: 'A', children: [...] }] })`. Full `config` API remains available for advanced use cases (multi-layer, aligned layers, etc.).
- **Label font size control** (#40): Added `fontSize` option to `LabelOptions` - accepts a number for fixed size or `{ min, max }` object for range. Added `minRadialThickness` option to control visibility threshold.
- **Root label style** (#26): Added `rootLabelStyle` option to `LabelOptions` with values `'curved'` (default) or `'straight'` to display root node labels as centered text instead of following the arc path.
- **CI workflow**: Added GitHub Actions workflow for automated testing on PRs to main/dev branches.

### Changed
- **Instant node removal** (#39): Disappearing nodes during navigation now remove instantly without fade/collapse animation. Only nodes that stay and expand are animated.

### Refactoring
- **path-management.ts**: Extracted `attachEventHandlers`, `applyBorderStyles`, `applyDataAttributes`, `buildClassList` helpers. Simplified opacity conditionals with single guard clause.
- **orchestration.ts**: Split `renderSVG` (222→59 lines) into `createRenderLoop`, `executeRender`, `processArcs`, `applySvgDimensions`, `appendNewElement`, `scheduleRemovals`. Replaced `Object.defineProperties` with direct assignment.
- **label-system.ts**: Extracted `resolveLabelColor` helper. Replaced if-else chain in `logHiddenLabel` with `LABEL_HIDDEN_REASONS` map. Added `LABEL_TANGENT_*` constants for magic numbers.
- **navigation.ts**: Consolidated 8 mutable variables into `NavigationState` type. Renamed WeakMaps to clearer names (`nodeToBase`, `baseToPath`, `derivedToPath`). Extracted `registerSingleArc` and `setFocus` helpers. Flattened nested conditionals with guard clauses.
- **aligned.ts**: Reduced `layoutAlignedLayer` cognitive complexity from 27 to ~5 by extracting `getSourceLayer`, `buildRootSourceMap`, `getAlignedSlot`, `computeTrimmedBounds`, `layoutAlignedNode`, `fallbackToFreeLayout`.
- **breadcrumbs.ts**: Use `.dataset` instead of `setAttribute` for data attributes.
- **orchestration.ts**: Refactor `scheduleRemovals` to use options object (8→1 parameters).
- **normalization.ts**: Reduced `normalizeTree` cognitive complexity from 17 to ~6 by extracting `isMultiParentNode`, `warnMultiParentFeature`, `addToMultiParentGroup`, `normalizeValue`, `normalizeNode`.
- **orchestration.ts**: Replace boolean `supportsFragment` parameter with `BatchTargets` strategy pattern.
- **removal.ts, path-management.ts**: Use `element.remove()` instead of `parentNode.removeChild(element)`.
- **normalization.ts**: Avoid object literal as default parameter for `warnOnce`.
- **navigation.ts**: Extract nested ternary into `resolveNavigationOptions` helper.
- **index.ts**: Use `Set` with `has()` instead of array with `includes()` for `foundKeys`.
- **document.ts, animation.ts**: Compare with `undefined` directly instead of using `typeof`.
- **colorAssignment.ts**: Use `codePointAt()` instead of `charCodeAt()`.
- **multi-parent-test.html**: Improve text contrast ratio.

## [0.3.6] - 2025-11-27

### Enhanced
- **Multi-parent nodes nested support**: Multi-parent nodes can now be placed at any depth in the tree hierarchy, not just at root level. Removed restriction that limited `parents` property to root-level nodes only.

### Added
- **Multi-parent validation**: Added validation to prevent parent nodes referenced in `parents` arrays from having their own children. When a parent node has children, the multi-parent group is skipped with a clear error message explaining the constraint violation.

### Fixed
- **Multi-parent radial positioning**: Fixed radial depth calculation for multi-parent children by properly converting y1 pixel values back to units. This prevents multi-parent children from overlapping with their unified parent arcs.

## [0.3.5] - 2025-11-27

### Added
- **Multi-parent nodes (EXPERIMENTAL)**: Added `parents` property to `TreeNodeInput` to create unified parent arcs spanning multiple nodes. When a node specifies `parents: ['key1', 'key2']`, the parent nodes with those keys are treated as ONE combined arc, and the node becomes a child of that unified parent. Multiple nodes can share the same parent set, creating many-to-many relationships. Multi-parent nodes can be placed at any depth in the tree hierarchy (root level or nested). This feature is marked as experimental and includes a console warning on first use due to potential issues with animations, value calculations, and navigation. Parent nodes in a multi-parent group should not have their own individual children.

## [0.3.4] - 2025-11-26

### Added
- **Border customization**: Added `borderColor` and `borderWidth` options to customize arc borders (strokes). Supports both global settings via `RenderSvgOptions` and per-layer overrides via `LayerConfig`. Layer-specific settings take priority over global options. Accepts any valid CSS color string for `borderColor` (hex, rgb, rgba, named colors) and numeric pixel values for `borderWidth`.

- **Label visibility and color control**: Added comprehensive label customization with three levels of control:
  - **Global control** via `labels` option: `true`/`false` for simple enable/disable, or `LabelOptions` object with `showLabels`, `labelColor`, and `autoLabelColor` properties
  - **Layer-level control** via `LayerConfig.showLabels` and `LayerConfig.labelColor` to override global settings per layer
  - **Node-level control** via `TreeNodeInput.labelColor` for individual arc label colors (highest priority)
  - **Auto-contrast mode**: When `autoLabelColor: true`, automatically chooses black or white label color based on arc background using WCAG relative luminance calculation for optimal readability
  - Priority cascade: Node labelColor → Layer labelColor → Global labelColor → Auto-contrast → Default (#000000)

## [0.3.3] - 2025-11-21

### Fixed
- **Label positioning and orientation**: Fixed two critical label rendering bugs:
  - Labels are now properly centered on arcs instead of appearing offset to the bottom-left. Added `text-anchor: middle` attribute to `<textPath>` elements for correct SVG text alignment.
  - Label inversion now uses tangent direction instead of midpoint angle, ensuring labels are always readable regardless of arc configuration. Labels at 0° and 180° now have correct orientation in all cases.

### Changed
- **Console logging is now opt-in via `debug` option**: Label visibility warnings (e.g., "Hiding label because arc span is too narrow") no longer appear by default. Pass `debug: true` to `renderSVG()` to enable diagnostic logging for debugging layout issues.

## [0.3.2] - 2025-10-23

### Refactoring
- **Split layout/index.ts into modular files** (#10): Extracted layout logic into separate, focused modules for improved maintainability and code organization. Created `normalization.ts` for tree normalization and utility functions, `shared.ts` for common types and arc creation, `free.ts` for free layout mode (value-based angular distribution), and `aligned.ts` for aligned layout mode (key-based alignment). Reduced index.ts from 467 lines to 98 lines.

- **Split navigation.ts into modular files** (#9): Extracted navigation logic into separate modules for better organization. Created `navigation/types.ts` for core types (FocusTarget, NavigationTransitionContext), `navigation/tree-utils.ts` for tree traversal utilities (findNodeByKey, getNodeAtPath, collectNodesAlongPath, indexBaseConfig), `navigation/config-derivation.ts` for config derivation logic, and `navigation/focus-helpers.ts` for focus management helpers. Reduced navigation.ts from 534 lines to 282 lines.

- **Extract constants and utilities from svg.ts** (#8): Extracted commonly used constants, types, and utility functions from svg.ts into separate modules. Created `svg/constants.ts` for SVG namespaces, label thresholds, and collapsed arc constants, `svg/types.ts` for RuntimeSet, AnimationHandle, AnimationDrivers, and ManagedPath types, `svg/runtime-creation.ts` for runtime set creation and disposal, and `svg/utils.ts` for utility functions (isSunburstConfig, ensureLabelDefs, extractConfigFromUpdate). Reduced svg.ts from 1,298 lines to 1,186 lines (112 lines saved).

### Performance
- **Batch DOM manipulations** (#16): Added DocumentFragment batching for DOM operations to improve rendering performance by reducing reflows and repaints. Includes fallback for test environments that don't support createDocumentFragment.

### Enhancement
- **Encapsulate render state** (#17): Created RenderState class to centralize all mutable render state (currentOptions, baseConfig, pathRegistry, runtimes, getArcColor, isRendering, pendingRender) for better lifecycle management and easier testing.

### Testing
- **Add comprehensive test coverage** (#18): Created 25 new tests across 2 new test files. Added `colorAssignment.spec.ts` with 11 tests covering key-based, value-based, depth-based, and index-based assignment, custom palettes, and node color overrides. Added `geometry.spec.ts` with 14 tests covering arc path generation, polar to cartesian conversion, full circles, wedges, and edge cases. Increased total test coverage from 15 to 38 tests (153% increase). All tests pass successfully.

## [0.3.1] - 2025-10-23

### Performance
- **Optimized color assignment from O(n²) to O(n)** (#12): Pre-compute min/max values once during color assigner creation instead of recalculating for every arc, significantly improving performance for large datasets.

### Refactoring
- **Consolidated duplicate key resolution logic** (#13): Created shared `resolveKeyFromSource()` helper function in `keys.ts` and removed duplicate implementations from `highlight.ts` and `navigation.ts`, following DRY principles.

### Enhancement
- **Migrated to AbortController for event listener cleanup** (#14): Replaced manual `removeEventListener` calls with modern AbortController pattern for more robust cleanup and automatic listener removal when elements are removed from DOM.

### Documentation
- **Added explanatory comments to magic numbers** (#15): Documented geometry calculations (SVG arc flags), easing functions (cubic ease-in-out with reference link), tooltip positioning (cursor offset rationale), and all label/collapsed arc rendering thresholds throughout the codebase for better maintainability.

### Fixed
- **Removed non-null assertion in highlight.ts** (#11): Replaced unsafe non-null assertion operator with proper null checking to prevent potential runtime errors.

## [0.3.0] - 2025-10-20

### Added
- **Navigation/Drilldown System**: Interactive drill-down navigation with click-to-focus on any arc, smooth morphing transitions, breadcrumb trail support, and programmatic reset capability via `resetNavigation()`.
- **Color Theme System**: Comprehensive automatic coloring with 14 built-in palettes across three theme types:
  - **Qualitative palettes** (6): `default`, `pastel`, `vibrant`, `earth`, `ocean`, `sunset` for categorical data
  - **Sequential palettes** (4): `blues`, `greens`, `purples`, `oranges` for ordered data
  - **Diverging palettes** (3): `redBlue`, `orangePurple`, `greenRed` for data with meaningful midpoints
- **Color Assignment Strategies**: Four ways to map colors to arcs - by key (consistent), depth (hierarchical), index (sequential), or value (magnitude-based).
- **New Exports**: `QUALITATIVE_PALETTES`, `SEQUENTIAL_PALETTES`, `DIVERGING_PALETTES` constants and `ColorThemeOptions`, `NavigationOptions`, `TransitionOptions` types.
- **Navigation Options**: Configure drilldown behavior with `layers` (which layers support navigation), `rootLabel` (breadcrumb root text), `onFocusChange` callback, and `focusTransition` (animation settings).
- **Breadcrumb Interactivity**: Optional `interactive` flag for breadcrumbs to enable navigation via trail clicks.

### Changed
- Refactored color assignment logic to maintain consistent colors during navigation - each key now maps to the same color regardless of zoom level or drilldown state.
- Improved label positioning with increased safety margins (15%), better width estimation (0.7 factor), and enhanced padding (8px) to prevent text cutoff on partial arcs.
- Fixed text inversion boundaries so labels at vertical positions (90°/270°) render with correct orientation for readability.
- Normalized angle calculations for text rotation to handle full-circle and partial arc cases correctly.
- Extracted magic numbers into dedicated constant files (`tooltipConstants.ts`, `breadcrumbConstants.ts`) for easier customization.
- Consolidated duplicate utility functions (`clamp01`, `ZERO_TOLERANCE`) into shared modules for maintainability.
- Simplified demo to showcase color theme system with interactive controls for theme type, palette selection, and assignment strategy.

### Fixed
- Fixed `labelPendingLogReason` self-assignment bug that prevented proper label state clearing during arc animations.
- Fixed collapsed children disappearing unexpectedly during navigation transitions.
- Fixed text labels appearing upside-down due to incorrect angle normalization.
- Fixed color assignments shifting during drilldown navigation by caching the color assigner based on full configuration.
- Fixed demo radial space allocation error by adjusting layer configuration to properly accommodate node hierarchy.

## [0.2.3] - 2025-09-23

### Added
- Introduced `npm run dev`, a Rollup watch + local web server workflow that auto-rebuilds bundles and serves the demo for rapid iteration.

### Changed
- Reworked the demo into the "Sand.js Studio" single-screen app with live JSON editing, collapsible branch toggles, and a leaner visual design.
- Simplified the demo styling to better showcase built-in arc metadata and reduce custom decoration.
- Updated the README CDN snippet to reference `@akitain/sandjs@0.2.3`.
- Skipped redundant asset copies during dev watch runs to quiet Rollup while keeping publish builds intact.

## [0.2.2] - 2025-09-23

### Added
- Enriched default SVG nodes with `data-depth`/`data-collapsed` attributes and root/collapsed class tokens so integrators can style arcs without custom hooks.

### Changed
- Normalized arc class merging to dedupe tokens when combining defaults with `classForArc` overrides.
- Corrected Changelog 0.2.1 release date (2025-09-21 when it was 2025-09-22)

## [0.2.1] - 2025-09-22

### Changed
- Broke out render runtimes (tooltip, highlight, breadcrumbs) into reusable modules and persist them across updates to avoid re-instantiation costs.
- Recycled keyed SVG paths so update cycles no longer churn event listeners or DOM nodes.
- Expanded render handle tests and documentation to cover the update workflow and responsive sizing defaults.

## [0.2.0] - 2025-09-22

### Added
- Highlight-by-key runtime with optional pinning, plus demo integration showing related arc highlighting.
- Collapsed node support in layout, including demo toggles to expand/collapse branches while preserving radial depth.
- Breadcrumb helpers and tooltip enhancements exposed via `formatArcBreadcrumb`.
- `renderSVG` update/destroy handle for redrawing in place without re-binding listeners.
- API docs generation workflow and GitHub Pages docs landing page.

### Changed
- Demo data refreshed with Pulp Fiction network theme and interactive controls.
- README examples and configuration essentials updated to cover new interactions.
- Build tooling configured to generate API reference via API Extractor/Documenter.

## [0.1.2] - 2025-09-16

### Added
- Added `.npmignore` to prepare npm publish

### Changed
- Changed `publishConfig` into `package.json` in order to make the package public

## [0.1.1] - 2025-09-16

### Changed
- Updated `README.md` and `package.json` because sandjs was already taken

## [0.1.0] - 2025-09-16

### Added
- Core layout engine with `free` and `align` layers, offsets, and padding controls.
- SVG renderer with tooltips, hover/click callbacks, and full-circle arc support.
- TypeScript definitions and Rollup builds (ESM + minified IIFE) with demo data showcase.
- Node test suite covering layout behaviours and offset edge cases.
