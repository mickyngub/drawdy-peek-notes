import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
    labelOf,
    makeNote,
    MAX_LINKS,
    NOTE_KEY,
    parseLinks,
    readNote,
    textUnits,
    truncate,
    wrapText,
} from "../src/note";

const manifest = JSON.parse(
    readFileSync(new URL("../manifest.json", import.meta.url), "utf8")
);

test("notes are stored under the extension's own id", () => {
    assert.equal(NOTE_KEY, manifest.driverId);
});

test("readNote keeps a saved note and ignores everything else", () => {
    const note = {
        body: "Step one\nStep two",
        links: ["https://a.dev"],
        updatedAt: 5,
    };
    assert.deepEqual(readNote({ [NOTE_KEY]: note }), note);
    assert.equal(readNote(undefined), null);
    assert.equal(readNote({ other: note }), null);
    assert.equal(readNote({ [NOTE_KEY]: null }), null);
    assert.equal(readNote({ [NOTE_KEY]: { body: "  ", links: [] } }), null);
});

test("readNote drops bad links and caps how many it keeps", () => {
    const links = [3, " ", "https://x.dev ", ...Array(20).fill("ref")];
    const note = readNote({ [NOTE_KEY]: { body: "", links } });
    assert.equal(note?.links[0], "https://x.dev");
    assert.equal(note?.links.length, MAX_LINKS);
});

test("makeNote trims the end and treats a blank note as removed", () => {
    assert.deepEqual(makeNote("Hello  \n\n", [" "], 1), {
        body: "Hello",
        links: [],
        updatedAt: 1,
    });
    assert.equal(makeNote(" \n ", ["", "  "], 1), null);
    assert.deepEqual(parseLinks("a\n\n  b  \r\nc"), ["a", "b", "c"]);
});

test("labelOf names an element by its text, then by what it is", () => {
    assert.equal(
        labelOf({ id: "1", type: "path", text: "\n Collect needs \nmore" }),
        "Collect needs"
    );
    assert.equal(
        labelOf({ id: "2", type: "frame", frameName: "Sprint 4" }),
        "Sprint 4"
    );
    assert.equal(
        labelOf({ id: "3", type: "path", componentType: "sticky-note" }),
        "Sticky note"
    );
    assert.equal(
        labelOf({ id: "4", type: "path", componentType: "rect" }),
        "Shape"
    );
    assert.equal(labelOf({ id: "5", type: "image" }), "Image");
});

test("wrapText breaks English at spaces and keeps blank lines between paragraphs", () => {
    const lines = wrapText("one two three four five six\n\nseven", 10);
    assert.deepEqual(lines, ["one two", "three four", "five six", "", "seven"]);
    assert.deepEqual(wrapText("end\n\n\n", 10), ["end"]);
});

test("wrapText breaks Thai at word boundaries without losing text", () => {
    const thai =
        "เวลาผมทำworkflowในกล่องก็จะเขียนข้อความหรือใจความหลักส่วนรายละเอียดเนื้อหาเยอะๆจะแอบไว้";
    const lines = wrapText(thai, 12);
    assert.ok(lines.length > 1);
    for (const line of lines) assert.ok(textUnits(line) <= 12, line);
    assert.equal(lines.join(""), thai);
    assert.ok(
        lines.every((line) => !/^[ัิ-ฺ็-๎]/u.test(line)),
        "a line starts with a combining mark"
    );
});

test("wrapText hard-breaks a word longer than a line", () => {
    const url = "https://example.com/a/very/long/path/without/spaces";
    const lines = wrapText(url, 16);
    assert.equal(lines.join(""), url);
    for (const line of lines) assert.ok(textUnits(line) <= 16);
});

test("truncate counts wide characters twice and adds an ellipsis", () => {
    assert.equal(truncate("short", 10), "short");
    assert.equal(truncate("a longer title here", 10), "a longer…");
    assert.equal(textUnits("日本"), 4);
    assert.ok(textUnits(truncate("日本語のテキスト", 7)) <= 7);
});
