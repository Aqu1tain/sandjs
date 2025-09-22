# Sand.js Documentation

This folder contains the generated API reference and supporting guides for Sand.js. The API reference is produced from the TypeScript declaration files using **API Extractor** and **API Documenter**.

## Generating the Markdown Reference

```bash
npm run docs:build
```

This command will:

1. Build the library in production mode so the latest declarations are available in `dist/`.
2. Clean previous documentation artifacts (`temp/` and `docs/api/`).
3. Run `api-extractor` to analyze the public surface and produce `temp/sandjs.api.json`.
4. Run `api-documenter markdown` to emit Markdown reference files into `docs/api/`.

The generated Markdown files are not committed yet; inspect and publish them where appropriate (for example, a documentation site or knowledge base).

## Folder Structure

- `docs/api/` — generated API reference (gitignored; regenerate via the script above).
- `docs/guides/` — optional long-form guides and tutorials (create as needed).
- `docs/README.md` — overview and build instructions.

## Authoring Notes

- Add TSDoc comments to the source code to control the API reference output. API Documenter understands `@remarks`, `@example`, and other TSDoc tags.
- Ensure all exported symbols you want documented are part of the `src/index.ts` barrel so they appear in `dist/index.d.ts`.
- Run `npm run docs:extract` locally if you only need to validate the API report without generating Markdown.
