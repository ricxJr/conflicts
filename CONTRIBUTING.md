# Contributing to MergeScope

Thanks for your interest in improving MergeScope! This guide covers how to set
up the project, the conventions we follow, and how to add the most common
kinds of contributions (translations, themes, shortcuts).

MergeScope is a fully local, offline-first desktop app — no network, no
telemetry (RNF-004). Please keep contributions in line with that principle.

## Prerequisites

- **Node.js ≥ 20**
- **Rust** (MSVC toolchain, via `rustup`)
- **Visual Studio 2022 Build Tools** with the C++ workload (Windows)

## Project layout

```
apps/desktop           # Tauri app (React frontend + src-tauri Rust backend)
packages/merge-engine  # TypeScript merge analysis engine (diff, graph, resolutions)
fixtures/              # Spec §28.4 test fixtures (one directory per scenario)
docs/                  # Architecture, integrations, ADRs
scripts/              # Icon generation, git mergetool setup
```

This is an npm-workspaces monorepo. See
[docs/architecture/overview.md](docs/architecture/overview.md) for the module
map and [docs/decisions/adr.md](docs/decisions/adr.md) for the key decisions.

## Getting started

```bash
npm install                                  # install all workspaces
npm run dev                                   # UI dev server with a demo session (no Rust)
npm run tauri build --workspace @mergescope/desktop   # full release build
```

`npm run dev` opens a browser demo session with representative conflict data —
the fastest way to iterate on the UI without a Rust toolchain.

## Checks before opening a PR

```bash
npm run lint          # ESLint across the repo
npm run format:check  # Prettier
npm test              # engine + UI store tests (vitest)
cargo test            # Rust backend tests (run inside apps/desktop/src-tauri)
```

- Keep code style consistent with the surrounding files; formatting is enforced
  by Prettier (`npm run format` to fix).
- Add or update tests for behavior changes. Store/engine behavior lives in
  `apps/desktop/tests` and `packages/merge-engine/tests`.

## Pull request flow

1. Fork and create a topic branch off `main` (e.g. `feat/pt-br-glossary`).
2. Make focused commits with clear messages.
3. Ensure all checks above pass.
4. Open a PR describing the change and how you verified it.

## How to add a new language

Translations live in `apps/desktop/src/i18n/locales/`.

1. Copy `en.json` to `<lang-code>.json` (e.g. `es.json`) and translate every
   value. **Keep the keys identical** — a test enforces key parity across
   locales.
2. Register the locale in `apps/desktop/src/i18n/index.ts` (add it to
   `resources` and to `LANGUAGES`).
3. Add the language type to `Language` in `apps/desktop/src/types/session.ts`
   and a `language.<code>` label to every locale file.

## How to add a theme color token

1. Add the field to `CustomTheme` and `DEFAULT_CUSTOM_THEME` in
   `apps/desktop/src/types/session.ts`.
2. If it maps to a CSS variable, add it to `CSS_VAR_MAP` in
   `apps/desktop/src/editor/monaco.ts` (and use it in `global.css`); Monaco-only
   colors are wired in `defineCustomMonacoTheme`.
3. Add the token to `COLOR_TOKENS` and a `settings.color.<token>` label to every
   locale so it shows up in the Settings → Appearance editor.

## How to add a command / shortcut

1. Add an entry to `COMMAND_META` and an action to `getCommandActions()` in
   `apps/desktop/src/features/commands.ts`.
2. Add a `command.<id>` label to every locale file.
3. (Optional) Give it a default chord in `DEFAULT_KEYBINDINGS`
   (`apps/desktop/src/features/keybindings.ts`). All commands are user-remappable
   from Settings → Shortcuts regardless.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
