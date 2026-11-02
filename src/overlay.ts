import type {
    DomElementSchema,
    DrawdyPreviewElementSchema,
    DriverCommandIssuer,
    ModuleStyling,
} from "@drawdy/driver-protocol";
import { BOOKMARK_ART } from "./bookmark-art";
import { displayLink, isUrl, truncate, wrapText, type Note } from "./note";

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
const artWidth = (height: number): number =>
    Math.round((height * BOOKMARK_ART.width) / BOOKMARK_ART.height);
// The lift puts the ribbon's eyes just over the box's top edge, peeking.
export const MARK = {
    width: artWidth(30),
    height: 30,
    inset: 10,
    lift: 8,
    gap: 4,
};
export const CARD = {
    width: 304,
    pad: 14,
    gap: 10,
    header: 28,
    button: 28,
    buttonGap: 2,
    iconWidth: artWidth(16),
    line: 20,
    bodyPx: 13,
    linkPx: 12,
    linkIcon: 14,
    caption: 16,
    captionGap: 4,
    maxLines: 14,
    offset: 30,
    caret: 8,
    blur: 18,
};
const INNER = CARD.width - CARD.pad * 2;
// Headroom for glyphs wider than the measured table.
const WRAP = INNER - 6;
const TITLE_WIDTH =
    INNER - CARD.iconWidth - 8 - 6 - CARD.button * 2 - CARD.buttonGap;
const LINK_TEXT = INNER - CARD.linkIcon - 6;
const CLOSE_LEFT = CARD.pad + INNER - CARD.button;
const EDIT_LEFT = CLOSE_LEFT - CARD.buttonGap - CARD.button;

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

const ICONS = {
    edit: "M6.41421 15.89L16.5563 5.74786L15.1421 4.33365L5 14.4758V15.89H6.41421ZM7.24264 17.89H3V13.6474L14.435 2.21233C14.8256 1.8218 15.4587 1.8218 15.8492 2.21233L18.6777 5.04075C19.0682 5.43128 19.0682 6.06444 18.6777 6.45497L7.24264 17.89ZM3 19.89H21V21.89H3V19.89Z",
    close: "M11.9997 10.5865L16.9495 5.63672L18.3637 7.05093L13.4139 12.0007L18.3637 16.9504L16.9495 18.3646L11.9997 13.4149L7.04996 18.3646L5.63574 16.9504L10.5855 12.0007L5.63574 7.05093L7.04996 5.63672L11.9997 10.5865Z",
    link: "M18.3638 15.5355L16.9496 14.1213L18.3638 12.7071C20.3164 10.7545 20.3164 7.58866 18.3638 5.63604C16.4112 3.68341 13.2453 3.68341 11.2927 5.63604L9.87849 7.05025L8.46428 5.63604L9.87849 4.22182C12.6122 1.48815 17.0443 1.48815 19.778 4.22182C22.5117 6.95549 22.5117 11.3876 19.778 14.1213L18.3638 15.5355ZM15.5353 18.364L14.1211 19.7782C11.3875 22.5118 6.95531 22.5118 4.22164 19.7782C1.48797 17.0445 1.48797 12.6123 4.22164 9.87868L5.63585 8.46446L7.05007 9.87868L5.63585 11.2929C3.68323 13.2455 3.68323 16.4113 5.63585 18.364C7.58847 20.3166 10.7543 20.3166 12.7069 18.364L14.1211 16.9497L15.5353 18.364ZM14.8282 7.75736L16.2425 9.17157L9.17139 16.2426L7.75717 14.8284L14.8282 7.75736Z",
    source: "M21 8V20.9932C21 21.5501 20.5552 22 20.0066 22H3.9934C3.44495 22 3 21.556 3 21.0082V2.9918C3 2.45531 3.4487 2 4.00221 2H14.9968L21 8ZM19 9H14V4H5V20H19V9ZM8 7H11V9H8V7ZM8 11H16V13H8V11ZM8 15H16V17H8V15Z",
};

const icon = (path: string, color: string): string =>
    svgUri(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path style="fill:${color}" d="${path}"/></svg>`
    );

export type CardLayout = {
    title: string;
    lines: string[];
    hidden: number;
    links: { text: string; url: boolean }[];
    height: number;
};

export function cardLayout(label: string, note: Note): CardLayout {
    const wrapped = wrapText(note.body, WRAP, CARD.bodyPx);
    const lines = wrapped.slice(0, CARD.maxLines);
    const hidden = wrapped.length - lines.length;
    const links = note.links.map((link) => ({
        text: truncate(displayLink(link), LINK_TEXT - 4, CARD.linkPx),
        url: isUrl(link),
    }));
    let height = 2 + CARD.pad * 2 + CARD.header + CARD.gap + 1;
    if (lines.length > 0)
        height += CARD.gap + (lines.length + (hidden > 0 ? 1 : 0)) * CARD.line;
    if (links.length > 0)
        height +=
            CARD.gap +
            CARD.caption +
            CARD.captionGap +
            links.length * CARD.line;
    return {
        title: truncate(label, TITLE_WIDTH - 4, 12),
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

const image = (
    child: string,
    width: number,
    height: number
): DomElementSchema => ({
    type: "image",
    child,
    styles: { width: [width, "px"], height: [height, "px"] },
});

const spacer = (width: number): DomElementSchema => ({
    type: "box",
    styles: { width: [width, "px"], height: [1, "px"] },
});

const visibleNotes = (state: OverlayState): Noted[] =>
    state.notes.filter((n) => !state.dragging.has(n.id));

export function buildMarks(state: OverlayState): DrawdyPreviewElementSchema[] {
    return visibleNotes(state).map((noted) => {
        const lifted =
            state.hovered === markHitId(noted.id) || state.open === noted.id;
        const at = markPosition(noted.rect, state.zoom);
        // Headroom above the ribbon, so lifting it does not clip its top.
        const room = 3;
        return component(
            `${PREFIX}mark:${noted.id}`,
            { x: at.x, y: at.y - room / state.zoom },
            { width: MARK.width, height: MARK.height + room },
            state.zoom,
            {
                type: "column",
                styles: lifted ? { transform: "translateY(-2px)" } : {},
                children: [
                    {
                        type: "box",
                        styles: { width: [1, "px"], height: [room, "px"] },
                    },
                    image(BOOKMARK_ART.uri, MARK.width, MARK.height),
                ],
            }
        );
    });
}

type Palette = {
    surface: string;
    border: string;
    text: string;
    muted: string;
    subtle: string;
    divider: string;
    hover: string;
    shadow: number;
};

function palette(s: ModuleStyling): Palette {
    return {
        surface: s.background,
        border: s.border,
        text: s.foreground,
        muted: s.mutedForeground,
        subtle: `color-mix(in srgb, ${s.foreground} 50%, transparent)`,
        divider: `color-mix(in srgb, ${s.foreground} 8%, transparent)`,
        hover: `color-mix(in srgb, ${s.foreground} 8%, ${s.background})`,
        shadow: s.theme === "light" ? 0.14 : 0.5,
    };
}

function text(
    child: string,
    width: number,
    color: string,
    fontPx: number,
    height = CARD.line,
    weight?: "medium"
): DomElementSchema {
    return {
        type: "text",
        child,
        styles: {
            width: [width, "px"],
            height: [height, "px"],
            overflow: "hidden",
            fontSize: [fontPx, "px"],
            color,
            ...(weight ? { fontWeight: weight } : {}),
        },
    };
}

const openNote = (state: OverlayState): Noted | undefined =>
    visibleNotes(state).find((n) => n.id === state.open);

function cardBody(
    state: OverlayState,
    layout: CardLayout,
    p: Palette
): DomElementSchema[] {
    const button = (hitId: string, path: string): DomElementSchema => {
        const hovered = state.hovered === hitId;
        return {
            type: "row",
            styles: {
                width: [CARD.button, "px"],
                height: [CARD.button, "px"],
                mainAxisAlignment: "center",
                crossAxisAlignment: "center",
                borderRadius: [8, "px"],
                ...(hovered ? { backgroundColor: p.hover } : {}),
            },
            children: [image(icon(path, hovered ? p.text : p.muted), 16, 16)],
        };
    };
    const children: DomElementSchema[] = [
        {
            type: "row",
            styles: {
                height: [CARD.header, "px"],
                crossAxisAlignment: "center",
            },
            children: [
                image(BOOKMARK_ART.uri, CARD.iconWidth, 16),
                spacer(8),
                text(layout.title, TITLE_WIDTH, p.muted, 12, 16, "medium"),
                spacer(6),
                button(EDIT_HIT, ICONS.edit),
                spacer(CARD.buttonGap),
                button(CLOSE_HIT, ICONS.close),
            ],
        },
        {
            type: "box",
            styles: {
                width: [INNER, "px"],
                height: [1, "px"],
                backgroundColor: p.divider,
            },
        },
    ];
    if (layout.lines.length > 0) {
        const body = layout.lines.map((line) =>
            text(line, INNER, p.text, CARD.bodyPx)
        );
        if (layout.hidden > 0) {
            const more = layout.hidden === 1 ? "line" : "lines";
            body.push(
                text(
                    `${layout.hidden} more ${more} in the panel`,
                    INNER,
                    p.subtle,
                    12
                )
            );
        }
        children.push({ type: "column", children: body });
    }
    if (layout.links.length > 0) {
        children.push({
            type: "column",
            styles: { gap: CARD.captionGap },
            children: [
                text("Sources", INNER, p.subtle, 11, CARD.caption, "medium"),
                {
                    type: "column",
                    children: layout.links.map((link) => ({
                        type: "row",
                        styles: {
                            height: [CARD.line, "px"],
                            crossAxisAlignment: "center",
                        },
                        children: [
                            image(
                                icon(
                                    link.url ? ICONS.link : ICONS.source,
                                    p.subtle
                                ),
                                CARD.linkIcon,
                                CARD.linkIcon
                            ),
                            spacer(6),
                            text(
                                link.text,
                                LINK_TEXT,
                                p.muted,
                                CARD.linkPx,
                                16
                            ),
                        ],
                    })),
                },
            ],
        });
    }
    return children;
}

function shadowSvg(width: number, height: number, opacity: number): string {
    const b = CARD.blur;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width + b * 2}" height="${height + b * 2}"><defs><filter id="b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${b / 2.5}"/></filter></defs><rect x="${b}" y="${b + 4}" width="${width}" height="${height - 4}" rx="12" fill="#000" fill-opacity="${opacity}" filter="url(#b)"/></svg>`;
}

// Points at the box; its right edge overlaps the card's border by a pixel to
// hide it there, so caret and card read as one shape.
function caretSvg(p: Palette): string {
    const c = CARD.caret;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${c + 1}" height="${c * 2}"><path d="M${c + 1} 0L1 ${c}L${c + 1} ${c * 2}Z" style="fill:${p.surface}"/><path d="M${c + 0.5} 0.5L1 ${c}L${c + 0.5} ${c * 2 - 0.5}" style="fill:none;stroke:${p.border}"/></svg>`;
}

export function buildCard(state: OverlayState): DrawdyPreviewElementSchema[] {
    const noted = openNote(state);
    if (!noted) return [];
    const zoom = state.zoom;
    const p = palette(state.styling);
    const layout = cardLayout(noted.label, noted.note);
    const at = cardPosition(noted.rect, zoom);
    const b = CARD.blur;
    const caretTop = CARD.pad + CARD.header / 2 - CARD.caret;
    return [
        component(
            `${PREFIX}card-shadow`,
            { x: at.x - b / zoom, y: at.y - b / zoom },
            { width: CARD.width + b * 2, height: layout.height + b * 2 },
            zoom,
            {
                type: "row",
                children: [
                    image(
                        svgUri(shadowSvg(CARD.width, layout.height, p.shadow)),
                        CARD.width + b * 2,
                        layout.height + b * 2
                    ),
                ],
            }
        ),
        component(
            `${PREFIX}card`,
            at,
            { width: CARD.width, height: layout.height },
            zoom,
            {
                type: "column",
                styles: {
                    padding: [CARD.pad, "px"],
                    gap: CARD.gap,
                    backgroundColor: p.surface,
                    borderColor: p.border,
                    borderWidth: [1, "px"],
                    borderRadius: [12, "px"],
                },
                children: cardBody(state, layout, p),
            }
        ),
        component(
            `${PREFIX}card-caret`,
            { x: at.x - CARD.caret / zoom, y: at.y + caretTop / zoom },
            { width: CARD.caret + 1, height: CARD.caret * 2 },
            zoom,
            {
                type: "row",
                children: [
                    image(svgUri(caretSvg(p)), CARD.caret + 1, CARD.caret * 2),
                ],
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
        local(EDIT_HIT, EDIT_LEFT, CARD.pad, CARD.button, CARD.button),
        local(CLOSE_HIT, CLOSE_LEFT, CARD.pad, CARD.button, CARD.button)
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
