# Developing Peek Notes

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm dev          # Tailwind watcher plus the dev server on :5220; in Drawdy run ⌘K → "Add extension dev server" on a local board
pnpm build        # regenerates src/bookmark-art.ts, src/panel-css.ts, src/webview-html.ts and dist/*.drawdyx
pnpm preflight    # before submitting: committed, built, pushed, under Drawdy's limits, above the live version
```

A note lives in its element's `meta` under `mickyngub.peek-notes` as `{ body, links, updatedAt }`, so it is saved, synced and undone with the board. The bookmark and the open note are preview components: they pan and zoom with the board but are never saved into it, so they only show for people who have Peek Notes. The logo (`icon.png`, and the rail button in `src/action-button.ts`) and the bookmark (`assets/bookmark.png`, a 3x PNG cut from a chroma-green background) were drawn with Codex imagegen. `pnpm art` turns the bookmark into `src/bookmark-art.ts`. Drawdy builds published versions from `src/index.ts` and runs no build step, so commit the generated `src/bookmark-art.ts`, `src/panel-css.ts` and `src/webview-html.ts` after `pnpm build`.

Bump `driverVersion` in `manifest.json` for every release and add it to `CHANGELOG.md`.
