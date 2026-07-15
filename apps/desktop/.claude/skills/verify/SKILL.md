---
name: verify
description: Verify MergeScope desktop changes by driving the app in browser demo mode with Playwright + system Edge (no Tauri build needed for frontend changes).
---

# Verifying MergeScope (apps/desktop)

## Surface

The app is a Tauri GUI, but the frontend runs standalone in a browser: when
`__TAURI_INTERNALS__` is absent, `src/services/backend.ts` serves an
in-memory **demo session** (3 conflict groups: current-only insert,
incoming-only insert, overlapping `timeout` conflict; demo git context with
branches `feature/discounts` / `feature/credit-limit`). That covers every UI
flow. Only Rust-side behavior (CLI, git detection, save/encoding) needs the
real exe (`cargo test` covers most of it; `npm run tauri build` for E2E).

## Launch

```bash
cd apps/desktop && npm run dev        # vite on http://localhost:1420 (strict port)
```

Port 1420 already in use usually means a dev server is already running —
reuse it (vite serves from source, changes are already live via HMR).

## Drive

No Playwright in the repo. Install `playwright-core` in the session
scratchpad (quick, no browser download) and use the system Edge:

```js
import { chromium } from "playwright-core";
const browser = await chromium.launch({ channel: "msedge", headless: true });
```

Wait for `.diff-panel .view-line`, then ~1s more (scroll sync/alignment
attach 100ms after ready + async diff compute).

Useful DOM hooks:

- Panels: `.diff-panel` (left = current, right = incoming), headers
  `.panel-header`, side badges `.badge-side`.
- Alignment filler zones: `.msr-align-filler` (hatched). Assert alignment by
  comparing `getBoundingClientRect().top` of a `.view-line` containing the
  same unchanged text across panels (e.g. `attempt(i);`).
- Conflict list: `.conflict-item` (+ `.active`); toolbar counter
  `.toolbar-counter` (works even with the sidebar hidden — prefer it).
- Result editor: `.result-panel .view-line`; statusbar `.status-ok` /
  `.statusbar`.
- Toggles in the top bar are `<label class="toggle">` with text
  List / Base / Changes only / Ignore WS.
- Click a Monaco line: `locator(".view-line", { hasText: ... }).click()` —
  reaches the editor mouse handlers fine.

## Gotchas

- Dev-only console noise: `Error: no diff result available` (×2 per page
  load) comes from React StrictMode double-mount disposing models mid-diff.
  Pre-existing, absent in release builds — don't chase it.
- Unchecking "List" hides `.conflict-item`s → use `.toolbar-counter` for
  active-group assertions in side-by-side mode.
- Prefs don't persist in browser mode (no Tauri), every reload is default
  state (dark theme, English, conflict list shown → inline diff mode).
