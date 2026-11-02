import { FIELD, PRIMARY, SECONDARY, SECTION_LABEL } from "../webview/classes";
import { PANEL_CSS } from "./panel-css";

const MARK_FILLED = `<svg class="hidden h-5 w-3.75 group-data-[has-note=true]:block" viewBox="0 0 18 24" aria-hidden="true"><path d="M3 1.25h12A1.75 1.75 0 0 1 16.75 3v19.1L9 17.4l-7.75 4.7V3A1.75 1.75 0 0 1 3 1.25Z" fill="#ffc21a" stroke="#1b2140" stroke-width="1.5" stroke-linejoin="round"/><path d="M5.5 6.5h7M5.5 10h5" stroke="#1b2140" stroke-width="1.5" stroke-linecap="round"/></svg>`;
const MARK_OUTLINE = `<svg class="size-4.5 text-fg-subtle group-data-[has-note=true]:hidden" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 2H19C19.5523 2 20 2.44772 20 3V22.1433C20 22.4194 19.7761 22.6434 19.5 22.6434C19.4061 22.6434 19.314 22.6168 19.2344 22.5669L12 18.0313L4.76559 22.5669C4.53163 22.7136 4.22306 22.6429 4.07637 22.4089C4.02647 22.3293 4 22.2373 4 22.1433V3C4 2.44772 4.44772 2 5 2ZM18 4H6V19.4324L12 15.6707L18 19.4324V4Z"/></svg>`;
const EMPTY_ART = `<svg class="mb-2 h-10 w-14 text-fg-subtle" viewBox="0 0 56 40" fill="none" aria-hidden="true"><rect x="2" y="7" width="46" height="30" rx="6" stroke="currentColor" stroke-width="1.5"/><path d="M10 17h20M10 23h13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".6"/><path d="M35.5 3.5h8a1.25 1.25 0 0 1 1.25 1.25v15.5l-5.25-3.25-5.25 3.25V4.75A1.25 1.25 0 0 1 35.5 3.5Z" fill="#ffc21a" stroke="#1b2140" stroke-width="1.25" stroke-linejoin="round"/></svg>`;

const BODY = `
<main class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4 [scrollbar-color:var(--color-line-strong)_transparent] [scrollbar-width:thin]">
    <section id="editor" class="flex flex-col gap-4" hidden>
        <div id="target" class="group flex items-center gap-3 rounded-xl bg-section px-3 py-2.5" data-has-note="false">
            <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-control-subtle">${MARK_FILLED}${MARK_OUTLINE}</span>
            <span class="flex min-w-0 flex-col">
                <span id="target-label" class="truncate text-label-md text-fg"></span>
                <span class="text-caption text-fg-subtle"><span class="group-data-[has-note=true]:hidden">No note yet</span><span class="hidden group-data-[has-note=true]:inline">Bookmarked on the board</span></span>
            </span>
        </div>
        <div class="flex flex-col gap-2">
            <label for="body" class="${SECTION_LABEL}">Details</label>
            <textarea id="body" rows="6" class="${FIELD} field-sizing-content min-h-32 max-h-72" placeholder="The long version: steps, context, anything that would crowd the box." spellcheck="true"></textarea>
        </div>
        <div class="flex flex-col gap-2">
            <label for="links" class="${SECTION_LABEL}"><span>Sources</span><span class="text-fg-subtle">One per line</span></label>
            <textarea id="links" rows="2" class="${FIELD} field-sizing-content min-h-16 max-h-40" placeholder="https://… or a book, page or person" spellcheck="false"></textarea>
        </div>
    </section>
    <div id="empty" class="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center" data-reason="none">
        ${EMPTY_ART}
        <p id="empty-title" class="text-label text-fg">Select a box to add a note</p>
        <p id="empty-hint" class="text-body text-balance text-fg-subtle">Its bookmark opens the note right on the board.</p>
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
        <button id="save" type="button" class="group ${PRIMARY}">Save note<kbd id="save-keys" class="font-sans text-label text-on-accent/55 group-disabled:text-fg-disabled"></kbd></button>
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
