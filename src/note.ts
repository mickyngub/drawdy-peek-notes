import type { SubscribedDrawdyElement } from "@drawdy/driver-protocol";

export const NOTE_KEY = "mickyngub.peek-notes";
export const MAX_BODY = 4000;
export const MAX_LINKS = 12;
export const MAX_LINK = 500;

export type Note = {
    body: string;
    links: string[];
    updatedAt: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

export function cleanLinks(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    const links: string[] = [];
    for (const entry of raw) {
        if (typeof entry !== "string") continue;
        const link = entry.trim().slice(0, MAX_LINK);
        if (link) links.push(link);
        if (links.length >= MAX_LINKS) break;
    }
    return links;
}

export function parseLinks(text: string): string[] {
    return cleanLinks(text.split(/\r?\n/));
}

/** Null when there is nothing worth keeping, so an emptied note is removed. */
export function makeNote(
    body: string,
    links: string[],
    updatedAt: number
): Note | null {
    const trimmed = body.replace(/\s+$/, "").slice(0, MAX_BODY);
    const cleaned = cleanLinks(links);
    if (!trimmed.trim() && cleaned.length === 0) return null;
    return { body: trimmed, links: cleaned, updatedAt };
}

export function readNote(meta: unknown): Note | null {
    if (!isRecord(meta)) return null;
    const raw = meta[NOTE_KEY];
    if (!isRecord(raw)) return null;
    return makeNote(
        typeof raw.body === "string" ? raw.body : "",
        cleanLinks(raw.links),
        typeof raw.updatedAt === "number" ? raw.updatedAt : 0
    );
}

const firstLine = (text: string | undefined): string =>
    text
        ?.split(/\r?\n/)
        .find((line) => line.trim())
        ?.trim() ?? "";

const TYPE_NAMES: Record<string, string> = {
    frame: "Frame",
    image: "Image",
    text: "Text",
    freedraw: "Drawing",
    component: "Embed",
};

export function labelOf(el: SubscribedDrawdyElement): string {
    const text = firstLine(el.text) || firstLine(el.frameName);
    if (text) return text;
    if (el.type === "path") {
        return el.componentType === "sticky-note" ? "Sticky note" : "Shape";
    }
    return TYPE_NAMES[el.type ?? ""] ?? "Element";
}

export function firstLineOf(note: Note): string {
    return firstLine(note.body) || note.links[0] || "";
}

export const isUrl = (link: string): boolean => /^https?:\/\/\S+$/i.test(link);

/** A link as people read it: no scheme, no www, no trailing slash. */
export function displayLink(link: string): string {
    if (!isUrl(link)) return link;
    return link.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const words = new Intl.Segmenter(undefined, { granularity: "word" });

// Google Sans Flex advance widths at 12 px for U+0020 to U+007E, measured in
// Drawdy's page and rounded up, so text laid out with them never re-wraps.
const ASCII_12 = [
    2.7, 4, 3.9, 7.7, 7.3, 10, 7.6, 2.2, 4, 4, 5.2, 6.7, 2.9, 4.1, 2.9, 3.6,
    7.8, 4.5, 6.4, 6.5, 7.2, 6.8, 6.7, 6, 6.7, 6.7, 2.9, 2.9, 6.7, 6.7, 6.7,
    5.8, 10.7, 8.1, 7.3, 8.9, 8.5, 6.7, 6.4, 9.5, 8.4, 3, 6.4, 7.6, 6.2, 10.4,
    8.5, 9.9, 7, 9.9, 7.1, 6.7, 6.5, 7.9, 7.6, 11.4, 7.7, 7.2, 6.9, 4.6, 3.6,
    4.6, 5.6, 6.8, 5.4, 6.5, 7.3, 6.6, 7.3, 6.8, 4.6, 7.2, 6.8, 2.8, 2.8, 6.1,
    2.6, 10.5, 6.8, 7.2, 7.3, 7.3, 4.5, 5.7, 4.4, 6.8, 6.2, 9.4, 5.9, 6.2, 5.8,
    4.8, 2.9, 4.8, 6.7,
];
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|\p{Extended_Pictographic}/u;
// Thai falls back to the system's Thai face: about 7.1 px a cluster on
// average at 12 px, held higher for the wide letters.
const THAI = /[฀-๿]/;

function graphemeWidth(grapheme: string): number {
    const code = grapheme.codePointAt(0) ?? 0;
    if (grapheme.length === 1 && code >= 32 && code < 127)
        return ASCII_12[code - 32];
    if (WIDE.test(grapheme)) return 12.6;
    if (THAI.test(grapheme)) return 7.5;
    return 7.6;
}

export function textWidth(text: string, fontPx = 12): number {
    let width = 0;
    for (const { segment } of graphemes.segment(text))
        width += graphemeWidth(segment);
    return (width * fontPx) / 12;
}

/** Cuts at the last whole grapheme that fits, adding an ellipsis when it cuts. */
export function truncate(text: string, maxPx: number, fontPx = 12): string {
    if (textWidth(text, fontPx) <= maxPx) return text;
    const budget = maxPx - textWidth("…", fontPx);
    let out = "";
    let width = 0;
    for (const { segment } of graphemes.segment(text)) {
        const next = width + textWidth(segment, fontPx);
        if (next > budget) break;
        out += segment;
        width = next;
    }
    return `${out.trimEnd()}…`;
}

function hardBreak(word: string, maxPx: number, fontPx: number): string[] {
    const lines: string[] = [];
    let line = "";
    let width = 0;
    for (const { segment } of graphemes.segment(word)) {
        const w = textWidth(segment, fontPx);
        if (width + w > maxPx && line) {
            lines.push(line);
            line = "";
            width = 0;
        }
        line += segment;
        width += w;
    }
    if (line) lines.push(line);
    return lines;
}

/**
 * Word-wraps one paragraph. Words come from Intl.Segmenter, which also splits
 * Thai and other scripts written without spaces.
 */
export function wrapParagraph(
    text: string,
    maxPx: number,
    fontPx = 12
): string[] {
    const lines: string[] = [];
    let line = "";
    let width = 0;
    for (const { segment } of words.segment(text)) {
        const w = textWidth(segment, fontPx);
        if (width + w <= maxPx + 0.01) {
            line += segment;
            width += w;
            continue;
        }
        if (line.trim()) lines.push(line.trimEnd());
        const piece = segment.trimStart();
        if (textWidth(piece, fontPx) <= maxPx) {
            line = piece;
            width = textWidth(piece, fontPx);
            continue;
        }
        const broken = hardBreak(piece, maxPx, fontPx);
        line = broken.pop() ?? "";
        width = textWidth(line, fontPx);
        lines.push(...broken);
    }
    if (line.trim() || lines.length === 0) lines.push(line.trimEnd());
    return lines;
}

export function wrapText(text: string, maxPx: number, fontPx = 12): string[] {
    const lines = text
        .split(/\r?\n/)
        .flatMap((paragraph) => wrapParagraph(paragraph, maxPx, fontPx));
    while (lines.length > 0 && !lines[lines.length - 1]) lines.pop();
    return lines;
}
