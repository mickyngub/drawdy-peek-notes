# Developing Peek Notes

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm dev          # Tailwind watcher plus the dev server on :5220; in Drawdy run ⌘K → "Add extension dev server" on a local board
pnpm build        # regenerates src/panel-css.ts, src/webview-html.ts and dist/*.drawdyx
pnpm preflight    # before submitting: committed, built, pushed, under Drawdy's limits, above the live version
```

A note lives in its element's `meta` under `mickyngub.peek-notes` as `{ body, links, updatedAt }`, so it is saved, synced and undone with the board. The bookmark and the open note are preview components: they pan and zoom with the board but are never saved into it, so they only show for people who have Peek Notes. Drawdy builds published versions from `src/index.ts` and runs no build step, so commit the generated `src/panel-css.ts` and `src/webview-html.ts` after `pnpm build`.

Bump `driverVersion` in `manifest.json` for every release and add it to `CHANGELOG.md`.
