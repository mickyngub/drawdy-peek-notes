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

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const words = new Intl.Segmenter(undefined, { granularity: "word" });
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|\p{Extended_Pictographic}/u;

const unitsOf = (grapheme: string): number => (WIDE.test(grapheme) ? 2 : 1);

export function textUnits(text: string): number {
    let units = 0;
    for (const { segment } of graphemes.segment(text))
        units += unitsOf(segment);
    return units;
}

/** Cuts at the last whole grapheme that fits, adding an ellipsis when it cuts. */
export function truncate(text: string, maxUnits: number): string {
    if (textUnits(text) <= maxUnits) return text;
    let out = "";
    let units = 0;
    for (const { segment } of graphemes.segment(text)) {
        const next = units + unitsOf(segment);
        if (next > maxUnits - 1) break;
        out += segment;
        units = next;
    }
    return `${out.trimEnd()}…`;
}

function hardBreak(word: string, maxUnits: number): string[] {
    const lines: string[] = [];
    let line = "";
    let units = 0;
    for (const { segment } of graphemes.segment(word)) {
        const width = unitsOf(segment);
        if (units + width > maxUnits && line) {
            lines.push(line);
            line = "";
            units = 0;
        }
        line += segment;
        units += width;
    }
    if (line) lines.push(line);
    return lines;
}

/**
 * Word-wraps one paragraph. Words come from Intl.Segmenter, which also splits
 * Thai and other scripts written without spaces.
 */
export function wrapParagraph(text: string, maxUnits: number): string[] {
    const lines: string[] = [];
    let line = "";
    let units = 0;
    for (const { segment } of words.segment(text)) {
        const width = textUnits(segment);
        if (units + width <= maxUnits) {
            line += segment;
            units += width;
            continue;
        }
        if (line.trim()) lines.push(line.trimEnd());
        const piece = segment.trimStart();
        if (textUnits(piece) <= maxUnits) {
            line = piece;
            units = textUnits(piece);
            continue;
        }
        const broken = hardBreak(piece, maxUnits);
        line = broken.pop() ?? "";
        units = textUnits(line);
        lines.push(...broken);
    }
    if (line.trim() || lines.length === 0) lines.push(line.trimEnd());
    return lines;
}

export function wrapText(text: string, maxUnits: number): string[] {
    const lines = text
        .split(/\r?\n/)
        .flatMap((paragraph) => wrapParagraph(paragraph, maxUnits));
    while (lines.length > 0 && !lines[lines.length - 1]) lines.pop();
    return lines;
}
