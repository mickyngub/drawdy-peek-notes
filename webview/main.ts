import type {
    DriverToWebview,
    NoteRow,
    PanelState,
    Target,
    WebviewToDriver,
} from "../src/shared/messages";
import { ROW } from "./classes";

type DrawdyWebviewApi = {
    postMessage(message: unknown): void;
    onMessage(listener: (message: unknown) => void): () => void;
};

declare function acquireDrawdyApi(): DrawdyWebviewApi;

const STATUS_MS = 2000;
const MARK = `<svg class="mt-0.5 h-4 w-3 shrink-0" viewBox="0 0 18 24" aria-hidden="true"><path d="M3 1.25h12A1.75 1.75 0 0 1 16.75 3v19.1L9 17.4l-7.75 4.7V3A1.75 1.75 0 0 1 3 1.25Z" fill="#ffc21a" stroke="#1b2140" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

const api = acquireDrawdyApi();
const byId = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;

const stylingEl = byId<HTMLStyleElement>("drawdy-styling");
const editorEl = byId<HTMLElement>("editor");
const targetEl = byId<HTMLDivElement>("target");
const targetLabelEl = byId<HTMLSpanElement>("target-label");
const bodyEl = byId<HTMLTextAreaElement>("body");
const linksEl = byId<HTMLTextAreaElement>("links");
const emptyEl = byId<HTMLDivElement>("empty");
const emptyTitleEl = byId<HTMLParagraphElement>("empty-title");
const emptyHintEl = byId<HTMLParagraphElement>("empty-hint");
const listWrapEl = byId<HTMLElement>("list-wrap");
const listCountEl = byId<HTMLSpanElement>("list-count");
const listEl = byId<HTMLDivElement>("list");
const footerEl = byId<HTMLElement>("footer");
const statusEl = byId<HTMLParagraphElement>("status");
const removeEl = byId<HTMLButtonElement>("remove");
const saveEl = byId<HTMLButtonElement>("save");
const saveKeysEl = byId<HTMLElement>("save-keys");

let state: PanelState = { selected: 0, target: null, notes: [] };
let editing: string | null = null;
let baseline = { body: "", links: "" };
let pending: { id: string; body: string; links: string } | null = null;
let statusTimer: ReturnType<typeof setTimeout> | null = null;
let transient = "";

const send = (message: WebviewToDriver): void => api.postMessage(message);

const isDirty = (): boolean =>
    editing !== null &&
    (bodyEl.value !== baseline.body || linksEl.value !== baseline.links);

function renderStatus(): void {
    statusEl.textContent = transient || (isDirty() ? "Unsaved changes" : "");
}

function setStatus(text: string, sticky = false): void {
    if (statusTimer) clearTimeout(statusTimer);
    transient = text;
    renderStatus();
    statusTimer = sticky
        ? null
        : setTimeout(() => {
              transient = "";
              renderStatus();
          }, STATUS_MS);
}

function load(target: Target | null): void {
    editing = target?.id ?? null;
    baseline = {
        body: target?.note?.body ?? "",
        links: target?.note?.links.join("\n") ?? "",
    };
    bodyEl.value = baseline.body;
    linksEl.value = baseline.links;
}

function save(): void {
    if (!editing) return;
    pending = { id: editing, body: bodyEl.value, links: linksEl.value };
    send({
        type: "save",
        id: editing,
        body: pending.body,
        links: pending.links.split("\n"),
    });
    setStatus("Saving…", true);
}

function syncButtons(): void {
    saveEl.disabled = !isDirty();
    removeEl.disabled = !state.target?.note;
    renderStatus();
}

function renderList(rows: NoteRow[]): void {
    listWrapEl.hidden = rows.length === 0;
    listCountEl.textContent = String(rows.length);
    listEl.replaceChildren(
        ...rows.map((row) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = ROW;
            button.dataset.id = row.id;
            button.setAttribute("role", "listitem");
            button.setAttribute(
                "aria-current",
                String(row.id === state.target?.id)
            );
            button.innerHTML = MARK;
            const text = document.createElement("span");
            text.className = "flex min-w-0 flex-1 flex-col";
            const label = document.createElement("span");
            label.className = "truncate text-label text-fg";
            label.textContent = row.label;
            const preview = document.createElement("span");
            preview.className = "truncate text-body text-fg-subtle";
            preview.textContent = row.preview;
            text.append(label, preview);
            button.append(text);
            button.addEventListener("click", () =>
                send({ type: "focus", id: row.id })
            );
            return button;
        })
    );
}

function render(): void {
    const { target, selected } = state;
    editorEl.hidden = target === null;
    footerEl.hidden = target === null;
    emptyEl.hidden = target !== null;
    emptyEl.dataset.reason = selected > 1 ? "many" : "none";
    if (selected > 1) {
        emptyTitleEl.textContent = "Select just one box";
        emptyHintEl.textContent =
            "A note belongs to a single box, shape or frame.";
    } else {
        emptyTitleEl.textContent = "Select a box to add a note";
        emptyHintEl.textContent =
            "Its bookmark opens the note right on the board.";
    }
    targetEl.dataset.hasNote = String(Boolean(target?.note));
    targetLabelEl.textContent = target?.label || "Selected box";
    targetLabelEl.title = target?.label ?? "";
    renderList(state.notes);
    syncButtons();
}

function onState(next: PanelState): void {
    const nextId = next.target?.id ?? null;
    if (editing && editing !== nextId && isDirty()) save();
    if (nextId !== editing || !isDirty()) load(next.target);
    state = next;
    render();
}

api.onMessage((raw) => {
    const message = raw as DriverToWebview;
    switch (message.type) {
        case "state": {
            onState(message);
            return;
        }
        case "saved": {
            if (!message.ok) {
                setStatus("Couldn't save the note. Try again.");
                return;
            }
            if (pending?.id === message.id && editing === message.id) {
                if (message.removed) {
                    bodyEl.value = "";
                    linksEl.value = "";
                }
                baseline = message.removed
                    ? { body: "", links: "" }
                    : { body: pending.body, links: pending.links };
            }
            pending = null;
            setStatus(message.removed ? "Note removed" : "Saved");
            syncButtons();
            return;
        }
        case "theme": {
            stylingEl.textContent = `:root{${message.cssVars}}`;
            return;
        }
        default: {
            return;
        }
    }
});

for (const field of [bodyEl, linksEl]) {
    field.addEventListener("input", syncButtons);
    field.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
        event.preventDefault();
        if (isDirty()) save();
    });
}

saveEl.addEventListener("click", save);
removeEl.addEventListener("click", () => {
    if (!editing) return;
    pending = { id: editing, body: "", links: "" };
    send({ type: "remove", id: editing });
    setStatus("Removing…", true);
});

const mac = /Mac|iPhone|iPad/.test(navigator.platform);
saveKeysEl.textContent = mac ? "⌘↵" : "Ctrl ↵";
saveEl.title = mac ? "Save (⌘ Enter)" : "Save (Ctrl Enter)";

render();
send({ type: "ready" });
