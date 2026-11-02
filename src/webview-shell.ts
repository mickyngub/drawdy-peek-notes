import { FIELD, PRIMARY, SECONDARY, SECTION_LABEL } from "../webview/classes";
import { PANEL_CSS } from "./panel-css";

const BOOKMARK_LINE = `<svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 2H19C19.5523 2 20 2.44772 20 3V22.1433C20 22.4194 19.7761 22.6434 19.5 22.6434C19.4061 22.6434 19.314 22.6168 19.2344 22.5669L12 18.0313L4.76559 22.5669C4.53163 22.7136 4.22306 22.6429 4.07637 22.4089C4.02647 22.3293 4 22.2373 4 22.1433V3C4 2.44772 4.44772 2 5 2ZM18 4H6V19.4324L12 15.6707L18 19.4324V4Z"/></svg>`;

const BODY = `
<main class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4 [scrollbar-color:var(--color-line-strong)_transparent] [scrollbar-width:thin]">
    <section id="editor" class="flex flex-col gap-4" hidden>
        <div class="flex flex-col gap-2">
            <label for="body" class="${SECTION_LABEL}"><span>Details</span><span id="target-label" class="min-w-0 truncate text-fg-subtle"></span></label>
            <textarea id="body" rows="6" class="${FIELD} min-h-28" placeholder="The long version: steps, context, anything that would crowd the box." spellcheck="true"></textarea>
        </div>
        <div class="flex flex-col gap-2">
            <label for="links" class="${SECTION_LABEL}"><span>Sources</span><span class="text-fg-subtle">One per line</span></label>
            <textarea id="links" rows="3" class="${FIELD} min-h-20" placeholder="https://… or a book, page or person" spellcheck="false"></textarea>
        </div>
    </section>
    <div id="empty" class="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong px-4 py-6 text-center" data-reason="none">
        <span class="text-fg-subtle">${BOOKMARK_LINE}</span>
        <p id="empty-title" class="text-label text-fg">Select a box to add a note</p>
        <p id="empty-hint" class="text-body text-fg-subtle">Its bookmark opens the note right on the board.</p>
    </div>
    <section id="list-wrap" class="flex flex-col gap-2" hidden>
        <div class="${SECTION_LABEL}"><span>On this board</span><span id="list-count" class="text-fg-subtle"></span></div>
        <div id="list" class="-mx-2 flex flex-col" role="list" aria-label="Notes on this board"></div>
    </section>
</main>
<footer id="footer" class="flex shrink-0 flex-col gap-2 border-t border-divider px-4 py-3" hidden>
    <p id="status" role="status" class="text-body text-fg-subtle empty:hidden"></p>
    <div class="flex items-center gap-2">
        <button id="remove" type="button" class="${SECONDARY}">Remove</button>
        <button id="save" type="button" class="${PRIMARY}" title="Save (⌘ Enter)">Save note</button>
    </div>
</footer>
`;

export function shellHtml(js: string): string {
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource-variable/google-sans-flex@5.3.2/wght.css" />
<style id="drawdy-styling">:root{/*__DRAWDY_STYLING__*/}</style>
<style>${PANEL_CSS}</style>
</head>
<body class="flex h-screen flex-col overflow-hidden bg-panel font-sans text-body text-fg antialiased">
${BODY}
<script>${js}</script>
</body>
</html>`;
}
