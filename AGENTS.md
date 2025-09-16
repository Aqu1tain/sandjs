# Repository Guidelines

## Project Structure & Module Organization
TypeScript source files live in `src/`, with `src/index.ts` exporting the public API for Sand.js. Keep renderer utilities in `src/render/`, layout logic in `src/layout/`, and shared types in `src/types/`. Rollup emits build artifacts into `dist/`; this directory is generated, reviewed locally, and left out of commits. Documentation assets sit in `README.md` and `CHANGELOG.md`, while experimental notebooks or demos belong in `examples/` (create the folder when needed) to keep the root clean.

## Build, Test, and Development Commands
`npm run clean` removes the `dist/` folder so every build starts fresh. `npm run build` runs a full Rollup bundle in production mode, compiling TypeScript and copying distributable assets. `npm run prepublishOnly` is triggered by npm publishing; run it locally before tagging a release to verify the package shape. During active development, pair the build with `npm link` or `npm pack` to dogfood the bundle inside consumer apps.

## Coding Style & Naming Conventions
Follow the strict TypeScript defaults defined in `tsconfig.json`. Use two-space indentation, `camelCase` for variables and functions, `PascalCase` for exported classes and types, and uppercase `SAND_` prefixes for shared constants. Prefer pure functions for layout math, document non-trivial algorithms with short comments, and keep modules under 300 lines by extracting helpers. Always run the TypeScript compiler in watch mode when editing core files to catch regressions early.

## Testing Guidelines
Adopt Vitest (preferred) or Jest for unit coverage. Place specs beside the code in `src/**/__tests__/` using the `*.spec.ts` suffix. Snapshot tests are helpful for verifying arc geometry; update snapshots only after inspecting the rendered SVG. Until an automated test script lands, run `npm run build` as a smoke test and share manual validation notes in the PR description.

## Commit & Pull Request Guidelines
The history follows Conventional Commits (`feat:`, `fix:`, `chore:`). Keep commits focused and include migration notes in the body when APIs change. Pull requests require: a clear summary, linked GitHub issue, testing notes, and screenshots or GIFs for visual updates. Request review before merging, wait for CI (once added), and never publish new versions without maintainer approval.

## After
When you've finished with your modifications, always suggest a short commit name for these modifications to the user.