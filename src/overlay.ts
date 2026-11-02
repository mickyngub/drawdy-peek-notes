import type {
    DomElementSchema,
    DrawdyPreviewElementSchema,
    DriverCommandIssuer,
    ModuleStyling,
} from "@drawdy/driver-protocol";
import { truncate, wrapText, type Note } from "./note";

export type Rect = { x: number; y: number; width: number; height: number };

export type Noted = { id: string; rect: Rect; label: string; note: Note };

export type OverlayState = {
    notes: readonly Noted[];
    open: string | null;
    dragging: ReadonlySet<string>;
    hovered: string | null;
    zoom: number;
    styling: ModuleStyling;
};

export type Ctx = {
    driverId: string;
    issueCommand: DriverCommandIssuer;
    nextRequestId: () => string;
};

// Sizes are screen pixels; the builders divide by zoom so the bookmark and
// the card stay the same size on screen at any zoom.
export const MARK = { width: 18, height: 24, inset: 10, lift: 4, gap: 4 };
export const CARD = {
    width: 288,
    pad: 12,
    header: 28,
    gap: 8,
    line: 18,
    label: 16,
    offset: 28,
    maxLines: 14,
    // A conservative average glyph width at 12 px, so lines never re-wrap.
    charPx: 7,
    editWidth: 44,
    button: 26,
    iconWidth: 12,
};
const INNER = CARD.width - CARD.pad * 2;
const LINE_UNITS = Math.floor(INNER / CARD.charPx);
const TITLE_WIDTH =
    INNER - CARD.iconWidth - CARD.editWidth - CARD.button - CARD.gap * 3;
const TITLE_UNITS = Math.floor(TITLE_WIDTH / 7.5);
const BUTTON_TOP = CARD.pad + (CARD.header - CARD.button) / 2;
const CLOSE_LEFT = CARD.pad + INNER - CARD.button;
const EDIT_LEFT = CLOSE_LEFT - CARD.gap - CARD.editWidth;

const PREFIX = "peek-notes:";
const MARK_HIT = `${PREFIX}mark-hit:`;
export const CARD_HIT = `${PREFIX}card-hit`;
export const EDIT_HIT = `${PREFIX}edit-hit`;
export const CLOSE_HIT = `${PREFIX}close-hit`;

export const markHitId = (elementId: string): string =>
    `${MARK_HIT}${elementId}`;

export type Hit =
    | { kind: "edit" }
    | { kind: "close" }
    | { kind: "mark"; elementId: string }
    | { kind: "card" };

/** What a press on these scene ids means; buttons win over the card under them. */
export function hitOf(ids: readonly string[]): Hit | null {
    if (ids.includes(EDIT_HIT)) return { kind: "edit" };
    if (ids.includes(CLOSE_HIT)) return { kind: "close" };
    const mark = ids.find((id) => id.startsWith(MARK_HIT));
    if (mark) return { kind: "mark", elementId: mark.slice(MARK_HIT.length) };
    if (ids.includes(CARD_HIT)) return { kind: "card" };
    return null;
}

const svgUri = (svg: string): string =>
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export const BOOKMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 24" width="18" height="24"><path d="M3 1.25h12A1.75 1.75 0 0 1 16.75 3v19.1L9 17.4l-7.75 4.7V3A1.75 1.75 0 0 1 3 1.25Z" fill="#ffc21a" stroke="#1b2140" stroke-width="1.5" stroke-linejoin="round"/><path d="M5.5 6.5h7M5.5 10h5" stroke="#1b2140" stroke-width="1.5" stroke-linecap="round"/></svg>`;
const BOOKMARK_URI = svgUri(BOOKMARK_SVG);

const closeUri = (color: string): string =>
    svgUri(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="${color}" d="M11.9997 10.5865L16.9495 5.63672L18.3637 7.05093L13.4139 12.0007L18.3637 16.9504L16.9495 18.3646L11.9997 13.4149L7.04996 18.3646L5.63574 16.9504L10.5855 12.0007L5.63574 7.05093L7.04996 5.63672L11.9997 10.5865Z"/></svg>`
    );

export type CardLayout = {
    title: string;
    lines: string[];
    hidden: number;
    links: string[];
    height: number;
};

export function cardLayout(label: string, note: Note): CardLayout {
    const wrapped = wrapText(note.body, LINE_UNITS);
    const lines = wrapped.slice(0, CARD.maxLines);
    const hidden = wrapped.length - lines.length;
    const links = note.links.map((link) => truncate(link, LINE_UNITS));
    let height = CARD.pad * 2 + CARD.header + 2;
    if (lines.length > 0) height += CARD.gap + lines.length * CARD.line;
    if (hidden > 0) height += CARD.line;
    if (links.length > 0)
        height += CARD.gap + CARD.label + links.length * CARD.line;
    return {
        title: truncate(label, TITLE_UNITS),
        lines,
        hidden,
        links,
        height,
    };
}

export function markPosition(
    rect: Rect,
    zoom: number
): { x: number; y: number } {
    const fitsInside = rect.width * zoom >= MARK.width + MARK.inset * 2;
    const x = fitsInside
        ? rect.x + rect.width - (MARK.inset + MARK.width) / zoom
        : rect.x + rect.width + MARK.gap / zoom;
    return { x, y: rect.y - MARK.lift / zoom };
}

export function cardPosition(
    rect: Rect,
    zoom: number
): { x: number; y: number } {
    return { x: rect.x + rect.width + CARD.offset / zoom, y: rect.y };
}

const round = (v: number): number => Math.round(v * 1000) / 1000;

/**
 * Text on the canvas is DOM on the widget layer, which scales it by zoom. The
 * schema is laid out at its screen size and scaled by 1 / zoom about its
 * top-left, so it lands at its design size on screen (Serene's approach).
 */
function component(
    id: string,
    at: { x: number; y: number },
    size: { width: number; height: number },
    zoom: number,
    schema: DomElementSchema
): DrawdyPreviewElementSchema {
    const s = 1 / zoom;
    const dx = round((-size.width * (1 - s)) / 2);
    const dy = round((-size.height * (1 - s)) / 2);
    return {
        type: "component",
        drawdyElementId: id,
        x: at.x,
        y: at.y,
        width: size.width * s,
        height: size.height * s,
        schema: {
            type: "row",
            styles: {
                width: [size.width, "px"],
                height: [size.height, "px"],
                overflow: "hidden",
                pointerEvents: "none",
                transform: `translate(${dx}px, ${dy}px) scale(${round(s * 1e6) / 1e6})`,
            },
            children: [
                // The host lines widgets up on their first baseline; a full-height
                // box with no text keeps the content from being pushed down.
                {
                    type: "box",
                    styles: { width: [0, "px"], height: [size.height, "px"] },
                },
                {
                    ...schema,
                    styles: {
                        ...schema.styles,
                        width: [size.width, "px"],
                        height: [size.height, "px"],
                    },
                } as DomElementSchema,
            ],
        },
    };
}

const visibleNotes = (state: OverlayState): Noted[] =>
    state.notes.filter((n) => !state.dragging.has(n.id));

export function buildMarks(state: OverlayState): DrawdyPreviewElementSchema[] {
    return visibleNotes(state).map((noted) => {
        const lifted =
            state.hovered === markHitId(noted.id) || state.open === noted.id;
        return component(
            `${PREFIX}mark:${noted.id}`,
            markPosition(noted.rect, state.zoom),
            { width: MARK.width, height: MARK.height },
            state.zoom,
            {
                type: "row",
                styles: lifted ? { transform: "translateY(-2px)" } : {},
                children: [
                    {
                        type: "image",
                        child: BOOKMARK_URI,
                        styles: {
                            width: [MARK.width, "px"],
                            height: [MARK.height, "px"],
                        },
                    },
                ],
            }
        );
    });
}

const hoverFill = (s: ModuleStyling): string =>
    `color-mix(in srgb, ${s.foreground} 8%, ${s.background})`;

function textLine(
    child: string,
    color: string,
    height = CARD.line,
    fontSize = 12
): DomElementSchema {
    return {
        type: "text",
        child,
        styles: {
            width: [INNER, "px"],
            height: [height, "px"],
            overflow: "hidden",
            fontSize: [fontSize, "px"],
            color,
        },
    };
}

const openNote = (state: OverlayState): Noted | undefined =>
    visibleNotes(state).find((n) => n.id === state.open);

export function buildCard(state: OverlayState): DrawdyPreviewElementSchema[] {
    const noted = openNote(state);
    if (!noted) return [];
    const s = state.styling;
    const layout = cardLayout(noted.label, noted.note);
    const button = (
        hitId: string,
        width: number,
        child: DomElementSchema
    ): DomElementSchema => ({
        type: "row",
        styles: {
            width: [width, "px"],
            height: [CARD.button, "px"],
            mainAxisAlignment: "center",
            crossAxisAlignment: "center",
            borderRadius: [8, "px"],
            ...(state.hovered === hitId
                ? { backgroundColor: hoverFill(s) }
                : {}),
        },
        children: [child],
    });
    const children: DomElementSchema[] = [
        {
            type: "row",
            styles: {
                height: [CARD.header, "px"],
                gap: CARD.gap,
                crossAxisAlignment: "center",
            },
            children: [
                {
                    type: "image",
                    child: BOOKMARK_URI,
                    styles: {
                        width: [CARD.iconWidth, "px"],
                        height: [16, "px"],
                    },
                },
                {
                    type: "text",
                    child: layout.title,
                    styles: {
                        width: [TITLE_WIDTH, "px"],
                        overflow: "hidden",
                        fontSize: [13, "px"],
                        fontWeight: "medium",
                        color: s.foreground,
                    },
                },
                button(EDIT_HIT, CARD.editWidth, {
                    type: "text",
                    child: "Edit",
                    styles: {
                        fontSize: [12, "px"],
                        fontWeight: "medium",
                        color:
                            state.hovered === EDIT_HIT
                                ? s.foreground
                                : s.mutedForeground,
                    },
                }),
                button(CLOSE_HIT, CARD.button, {
                    type: "image",
                    child: closeUri(
                        state.hovered === CLOSE_HIT
                            ? s.foreground
                            : s.mutedForeground
                    ),
                    styles: { width: [16, "px"], height: [16, "px"] },
                }),
            ],
        },
    ];
    if (layout.lines.length > 0 || layout.hidden > 0) {
        const body = layout.lines.map((line) => textLine(line, s.foreground));
        if (layout.hidden > 0) {
            const more = layout.hidden === 1 ? "line" : "lines";
            body.push(
                textLine(
                    `+${layout.hidden} more ${more}, open Edit to read all`,
                    s.mutedForeground
                )
            );
        }
        children.push({ type: "column", children: body });
    }
    if (layout.links.length > 0) {
        children.push({
            type: "column",
            children: [
                textLine("Sources", s.mutedForeground, CARD.label, 11),
                ...layout.links.map((link) =>
                    textLine(link, s.mutedForeground)
                ),
            ],
        });
    }
    return [
        component(
            `${PREFIX}card`,
            cardPosition(noted.rect, state.zoom),
            { width: CARD.width, height: layout.height },
            state.zoom,
            {
                type: "column",
                styles: {
                    padding: [CARD.pad, "px"],
                    gap: CARD.gap,
                    backgroundColor: s.background,
                    borderColor: s.border,
                    borderWidth: [1, "px"],
                    borderRadius: [12, "px"],
                },
                children,
            }
        ),
    ];
}

function hitArea(id: string, rect: Rect): DrawdyPreviewElementSchema {
    return {
        type: "shape",
        drawdyElementId: id,
        componentType: "rect",
        ...rect,
        fillColor: "#000000",
        strokeColor: "transparent",
        strokeWidth: 0,
        roughness: 0,
        opacity: 0,
    };
}

/**
 * Invisible hit-testable shapes over the bookmarks and the card. They take
 * the presses and hovers (the drawn DOM ignores the pointer), and pressing
 * one leaves the board's selection alone, so the card stays open for its
 * buttons. The buttons come after the card so they sit on top of it.
 */
export function buildHits(state: OverlayState): DrawdyPreviewElementSchema[] {
    const zoom = state.zoom;
    const hits = visibleNotes(state).map((n) =>
        hitArea(markHitId(n.id), {
            ...markPosition(n.rect, zoom),
            width: MARK.width / zoom,
            height: MARK.height / zoom,
        })
    );
    const open = openNote(state);
    if (!open) return hits;
    const at = cardPosition(open.rect, zoom);
    const height = cardLayout(open.label, open.note).height;
    const local = (id: string, x: number, y: number, w: number, h: number) =>
        hitArea(id, {
            x: at.x + x / zoom,
            y: at.y + y / zoom,
            width: w / zoom,
            height: h / zoom,
        });
    hits.push(
        local(CARD_HIT, 0, 0, CARD.width, height),
        local(EDIT_HIT, EDIT_LEFT, BUTTON_TOP, CARD.editWidth, CARD.button),
        local(CLOSE_HIT, CLOSE_LEFT, BUTTON_TOP, CARD.button, CARD.button)
    );
    return hits;
}

const stamp = (ctx: Ctx) => ({
    driverId: ctx.driverId,
    requestId: ctx.nextRequestId(),
});

/** One preview batch, updated in place while its element ids stay the same. */
class PreviewBatch {
    private _previewId: string | null = null;
    private _ids = "";
    private _sent = "";

    public constructor(
        private readonly _ctx: Ctx,
        private readonly _hitTestable = false
    ) {}

    public async sync(elements: DrawdyPreviewElementSchema[]): Promise<void> {
        if (elements.length === 0) {
            await this.clear();
            return;
        }
        const sent = JSON.stringify(elements);
        if (sent === this._sent) return;
        const ids = elements.map((el) => el.drawdyElementId).join(",");
        if (this._previewId && ids === this._ids) {
            this._sent = sent;
            await this._ctx.issueCommand({
                type: "command:scene:update-drawdy-preview-elements",
                ...stamp(this._ctx),
                req: { elements },
            });
            return;
        }
        await this.clear();
        const res = await this._ctx.issueCommand({
            type: "command:scene:create-drawdy-preview-elements",
            ...stamp(this._ctx),
            req: { elements, hitTestable: this._hitTestable },
        });
        if (res.res.error !== undefined) return;
        this._previewId = res.res.value.previewId;
        this._ids = ids;
        this._sent = sent;
    }

    public async clear(): Promise<void> {
        const previewId = this._previewId;
        this._previewId = null;
        this._ids = "";
        this._sent = "";
        if (!previewId) return;
        await this._ctx.issueCommand({
            type: "command:scene:delete-drawdy-preview-elements",
            ...stamp(this._ctx),
            req: { previewIds: [previewId] },
        });
    }
}

export class Overlay {
    private readonly _marks: PreviewBatch;
    private readonly _card: PreviewBatch;
    private readonly _hits: PreviewBatch;
    private readonly _registered = new Set<string>();
    private _dirty = false;
    private _syncing = false;

    public constructor(
        ctx: Ctx,
        private readonly _read: () => OverlayState,
        /** Asks for scene click and pointer events on a hit area's id. */
        private readonly _onHitArea: (elementId: string) => void
    ) {
        this._marks = new PreviewBatch(ctx);
        this._card = new PreviewBatch(ctx);
        this._hits = new PreviewBatch(ctx, true);
    }

    public request(): void {
        this._dirty = true;
        if (this._syncing) return;
        void this._drain();
    }

    private async _drain(): Promise<void> {
        this._syncing = true;
        try {
            while (this._dirty) {
                this._dirty = false;
                const state = this._read();
                const hits = buildHits(state);
                for (const hit of hits) {
                    if (this._registered.has(hit.drawdyElementId)) continue;
                    this._registered.add(hit.drawdyElementId);
                    this._onHitArea(hit.drawdyElementId);
                }
                try {
                    await Promise.all([
                        this._marks.sync(buildMarks(state)),
                        this._card.sync(buildCard(state)),
                        this._hits.sync(hits),
                    ]);
                } catch {
                    // A failed command leaves stale previews; the next change redraws.
                }
            }
        } finally {
            this._syncing = false;
        }
    }
}
