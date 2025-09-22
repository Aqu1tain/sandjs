# Changelog

## [Unreleased]

## [0.1.0] - 2025-09-16

### Added
- Core layout engine with `free` and `align` layers, offsets, and padding controls.
- SVG renderer with tooltips, hover/click callbacks, and full-circle arc support.
- TypeScript definitions and Rollup builds (ESM + minified IIFE) with demo data showcase.
- Node test suite covering layout behaviours and offset edge cases.

## [0.1.1] - 2025-09-16

### Changed
- Updated `README.md` and `package.json` because sandjs was already taken

## [0.1.2] - 2025-09-16

### Added
- Added `.npmignore` to prepare npm publish

### Changed
- Changed `publishConfig` into `package.json` in order to make the package public

## [0.2.0] - 2025-09-20

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