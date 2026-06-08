# Repository Guidelines

## Project Structure & Module Organization

Hashiri is a Vite React TypeScript app for a local-first note stream. Application code lives in `src/`: `App.tsx` contains the main UI, `main.tsx` mounts React, `db.ts` handles IndexedDB persistence, `types.ts` defines shared types, and `styles.css` contains global styling. Static entry files and build configuration live at the repository root (`index.html`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`). Product scope and non-goals are documented in `docs/product-concept.md`.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run dev`: start the Vite development server.
- `npm run build`: type-check with `tsc -b` and produce a production build.
- `npm run lint`: run ESLint across the repository.
- `npm run preview`: serve the production build locally for inspection.

Use Node.js `^20.19.0 || >=22.12.0`, matching the Vite toolchain requirement in `package.json`.

## Coding Style & Naming Conventions

Use TypeScript and React function components. Follow the existing style: two-space indentation, double quotes, semicolons, and concise helper functions near their call sites. Prefer explicit domain types in `src/types.ts` when data crosses module boundaries. Name React components in `PascalCase`, variables and functions in `camelCase`, and constants in `UPPER_SNAKE_CASE` only for true constants.

## Testing Guidelines

No automated test runner is configured yet. For now, run `npm run lint` and `npm run build` before opening a PR, then manually verify core flows in the browser: create a note, edit it, archive it, resume it, and reload to confirm IndexedDB persistence. If tests are added, place them near the relevant module or under `src/__tests__/`, and use names like `db.test.ts` or `App.test.tsx`.

## Commit & Pull Request Guidelines

Recent history uses short imperative commits, sometimes with Conventional Commit prefixes such as `feat:`, `fix:`, `style:`, `chore:`, and `docs:`. Keep commits focused and describe the user-visible change or maintenance task.

PR descriptions must be written in Japanese. Include a concise summary, verification steps, and screenshots or recordings for UI changes. Add `close #<issue-number>` at the start of the PR description only when the user explicitly specified that issue number.

## Security & Configuration Tips

The app stores notes in the browser profile's IndexedDB and currently has no backend. Do not add secrets or environment-specific credentials to the repository. Treat local browser data as user data when testing destructive flows.
