import assert from "node:assert/strict";
import { test } from "node:test";
import type { ModuleStyling } from "@drawdy/driver-protocol";
import { panelState } from "../src/index";
import type { Note } from "../src/note";
import {
    buildCard,
    buildHits,
    buildMarks,
    CARD,
    CARD_HIT,
    cardLayout,
    CLOSE_HIT,
    EDIT_HIT,
    hitOf,
    MARK,
    markHitId,
    markPosition,
    type Noted,
    type OverlayState,
} from "../src/overlay";

const note = (body: string, links: string[] = []): Note => ({
    body,
    links,
    updatedAt: 0,
});
const noted = (id: string, x: number, y: number, body = "Details"): Noted => ({
    id,
    rect: { x, y, width: 200, height: 100 },
    label: `Box ${id}`,
    note: note(body),
});
const styling = {
    background: "#1f1f23",
    foreground: "#fafafa",
    mutedForeground: "#a1a1aa",
    border: "#333",
    theme: "dark",
} as ModuleStyling;
const state = (over: Partial<OverlayState> = {}): OverlayState => ({
    notes: [noted("a", 0, 0), noted("b", 400, 0)],
    open: null,
    dragging: new Set(),
    hovered: null,
    zoom: 1,
    styling,
    ...over,
});

test("the card caps long notes and says how many lines are hidden", () => {
    const long = Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n");
    const layout = cardLayout("Title", note(long));
    assert.equal(layout.lines.length, CARD.maxLines);
    assert.equal(layout.hidden, 30 - CARD.maxLines);
});

test("the card grows for sources and shortens long links", () => {
    const plain = cardLayout("T", note("one line"));
    const sourced = cardLayout(
        "T",
        note("one line", ["https://example.com/" + "x".repeat(80)])
    );
    assert.equal(
        sourced.height - plain.height,
        CARD.gap + CARD.caption + CARD.captionGap + CARD.line
    );
    assert.ok(sourced.links[0].text.endsWith("…"));
    assert.ok(sourced.links[0].text.startsWith("example.com/"));
    assert.equal(sourced.links[0].url, true);
    assert.equal(cardLayout("T", note("", ["A book"])).links[0].url, false);
});

test("the bookmark sits inside the top-right corner and keeps its screen size", () => {
    const rect = { x: 100, y: 50, width: 200, height: 80 };
    for (const zoom of [0.5, 1, 2]) {
        const at = markPosition(rect, zoom);
        const fromRight = (rect.x + rect.width - at.x) * zoom;
        assert.ok(Math.abs(fromRight - (MARK.inset + MARK.width)) < 1e-9);
    }
    const narrow = markPosition({ x: 0, y: 0, width: 10, height: 10 }, 1);
    assert.ok(narrow.x > 10, "a narrow box gets its bookmark beside it");
});

test("bookmarks skip boxes being dragged", () => {
    const marks = buildMarks(state({ dragging: new Set(["a"]) }));
    assert.deepEqual(
        marks.map((m) => m.drawdyElementId),
        ["peek-notes:mark:b"]
    );
});

test("a press means the button under it before the card or a bookmark", () => {
    assert.deepEqual(hitOf([CARD_HIT, EDIT_HIT]), { kind: "edit" });
    assert.deepEqual(hitOf([CLOSE_HIT, CARD_HIT]), { kind: "close" });
    assert.deepEqual(hitOf(["x", markHitId("box-1")]), {
        kind: "mark",
        elementId: "box-1",
    });
    assert.deepEqual(hitOf([CARD_HIT]), { kind: "card" });
    assert.equal(hitOf(["some-shape"]), null);
});

test("the card only shows for the open note and not while it is dragged", () => {
    assert.deepEqual(buildCard(state()), []);
    assert.deepEqual(
        buildCard(state({ open: "a" })).map((el) => el.drawdyElementId),
        ["peek-notes:card-shadow", "peek-notes:card", "peek-notes:card-caret"],
        "the shadow sits under the card and the caret over its edge"
    );
    assert.deepEqual(
        buildCard(state({ open: "a", dragging: new Set(["a"]) })),
        []
    );
    const [a] = buildCard(state({ open: "a" }));
    const [b] = buildCard(state({ open: "b" }));
    assert.equal(
        a.drawdyElementId,
        b.drawdyElementId,
        "one card is reused in place"
    );
});

test("the panel lists notes in reading order and shows the selected note", () => {
    const notes = [
        noted("low", 0, 300),
        noted("right", 500, 0),
        noted("left", 0, 0),
    ];
    const panel = panelState(notes, 1, { id: "right", label: "Box right" });
    assert.deepEqual(
        panel.notes.map((row) => row.id),
        ["left", "right", "low"]
    );
    assert.deepEqual(panel.target?.note, { body: "Details", links: [] });
    assert.equal(
        panelState(notes, 1, { id: "plain", label: "x" }).target?.note,
        null
    );
    assert.equal(panelState(notes, 0, null).target, null);
});

test("hit areas cover every bookmark, and the open card with its two buttons", () => {
    const ids = (st: OverlayState) =>
        buildHits(st).map((h) => h.drawdyElementId);
    assert.deepEqual(ids(state()), [markHitId("a"), markHitId("b")]);
    assert.deepEqual(ids(state({ open: "a" })), [
        markHitId("a"),
        markHitId("b"),
        CARD_HIT,
        EDIT_HIT,
        CLOSE_HIT,
    ]);
    assert.deepEqual(ids(state({ open: "a", dragging: new Set(["a"]) })), [
        markHitId("b"),
    ]);
    const hits = buildHits(state({ open: "a", zoom: 2 })) as unknown as {
        x: number;
        y: number;
        width: number;
        height: number;
    }[];
    const [card, edit, close] = hits.slice(2);
    assert.equal(card.width, CARD.width / 2);
    assert.equal(card.height, cardLayout("Box a", note("Details")).height / 2);
    assert.ok(
        edit.x > card.x && close.x > edit.x,
        "Edit sits left of close inside the card"
    );
    assert.ok(close.x + close.width <= card.x + card.width);
});
