import type {
    DriverCommandIssuer,
    DriverManifest,
    DriverModule,
    DriverSubscriptionEvent,
    ModuleStyling,
    SubscribeableKey,
    SubscribedDrawdyElement,
} from "@drawdy/driver-protocol";
import { ACTION_BUTTON_SVG } from "./action-button";
import { firstLineOf, labelOf, makeNote, NOTE_KEY, readNote } from "./note";
import { CARD_HIT, hitOf, Overlay, type Noted, type Rect } from "./overlay";
import type {
    DriverToWebview,
    PanelState,
    WebviewToDriver,
} from "./shared/messages";
import { WEBVIEW_HTML } from "./webview-html";

const PROPERTIES: SubscribeableKey[] = [
    "meta",
    "x",
    "y",
    "width",
    "height",
    "text",
    "frameName",
    "type",
    "componentType",
];
const FLY_MS = 400;
const FOCUS_ZOOM = { min: 0.6, max: 1.5 };

type Driver = {
    manifest: DriverManifest;
    issueCommand: DriverCommandIssuer;
    styling: ModuleStyling;
    actionButtonId: string;
    webviewId: string;
    webviewHtml: string | null;
    notes: Map<string, Noted>;
    selection: string[];
    target: { id: string; label: string } | null;
    open: string | null;
    dragging: Set<string>;
    hovered: string | null;
    zoom: number;
    overlay: Overlay;
    lastPanel: string;
};

let driver: Driver | null = null;
let requestId = 0;

const nextRequestId = (): string => String(requestId++);

function stylingCssVars(styling: ModuleStyling): string {
    const { tokens, ...flat } = styling as ModuleStyling & {
        tokens?: Record<string, string>;
    };
    const vars = Object.entries(flat).map(([key, value]) =>
        key === "theme"
            ? `color-scheme: ${value};`
            : `--drawdy-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${value};`
    );
    for (const [name, value] of Object.entries(tokens ?? {}))
        vars.push(`${name}: ${value};`);
    return vars.join("");
}

function stamp(d: Driver) {
    return { driverId: d.manifest.driverId, requestId: nextRequestId() };
}

function post(message: DriverToWebview): void {
    if (!driver) return;
    void driver.issueCommand({
        type: "command:webview:post-message",
        ...stamp(driver),
        req: { webviewDomId: driver.webviewId, message },
    });
}

function rectOf(el: SubscribedDrawdyElement): Rect | null {
    const { x, y, width, height } = el;
    const values = [x, y, width, height];
    if (!values.every((v) => typeof v === "number" && Number.isFinite(v)))
        return null;
    return { x: x!, y: y!, width: width!, height: height! };
}

function absorb(d: Driver, elements: readonly SubscribedDrawdyElement[]): void {
    for (const el of elements) {
        if (d.target?.id === el.id)
            d.target = { id: el.id, label: labelOf(el) };
        const note = readNote(el.meta);
        const rect = rectOf(el);
        if (!note || !rect) {
            d.notes.delete(el.id);
            if (d.open === el.id) d.open = null;
            continue;
        }
        d.notes.set(el.id, { id: el.id, rect, label: labelOf(el), note });
    }
}

function forget(d: Driver, ids: readonly string[]): void {
    for (const id of ids) {
        d.notes.delete(id);
        if (d.open === id) d.open = null;
        if (d.target?.id === id) d.target = null;
    }
}

export function panelState(
    notes: Iterable<Noted>,
    selected: number,
    target: { id: string; label: string } | null
): PanelState {
    const all = [...notes];
    const rows = all
        .slice()
        .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)
        .map((n) => ({
            id: n.id,
            label: n.label,
            preview: firstLineOf(n.note),
        }));
    const noted = target ? all.find((n) => n.id === target.id) : undefined;
    return {
        selected,
        target: target
            ? {
                  id: target.id,
                  label: target.label,
                  note: noted
                      ? { body: noted.note.body, links: noted.note.links }
                      : null,
              }
            : null,
        notes: rows,
    };
}

function refresh(d: Driver): void {
    d.overlay.request();
    const state = panelState(d.notes.values(), d.selection.length, d.target);
    const serialized = JSON.stringify(state);
    if (serialized === d.lastPanel) return;
    d.lastPanel = serialized;
    post({ type: "state", ...state });
}

async function fetchElements(
    d: Driver,
    ids?: string[]
): Promise<SubscribedDrawdyElement[]> {
    const res = await d.issueCommand({
        type: "command:scene:get-drawdy-elements",
        ...stamp(d),
        req: { properties: PROPERTIES, drawdyElementIds: ids },
    });
    return res.res.error === undefined ? res.res.value.drawdyElements : [];
}

async function onSelection(d: Driver, ids: string[]): Promise<void> {
    d.selection = ids;
    const only = ids.length === 1 ? ids[0] : null;
    d.open = only && d.notes.has(only) ? only : null;
    if (!only) {
        d.target = null;
        refresh(d);
        return;
    }
    if (d.target?.id !== only) d.target = { id: only, label: "" };
    d.overlay.request();
    const [el] = await fetchElements(d, [only]);
    if (d.selection.length !== 1 || d.selection[0] !== only) return;
    if (!el) {
        d.target = null;
    } else {
        d.target = { id: only, label: labelOf(el) };
        absorb(d, [el]);
        if (d.notes.has(only)) d.open = only;
    }
    refresh(d);
}

async function select(d: Driver, ids: string[]): Promise<void> {
    await d.issueCommand({
        type: "command:scene:set-selection",
        ...stamp(d),
        req: { drawdyElementIds: ids },
    });
}

async function openPanel(d: Driver): Promise<void> {
    const html = (d.webviewHtml ??= WEBVIEW_HTML.replace(
        "/*__DRAWDY_STYLING__*/",
        stylingCssVars(d.styling)
    ));
    await d.issueCommand({
        type: "command:webview:create",
        ...stamp(d),
        req: {
            webviewDomId: d.webviewId,
            htmlContent: html,
            keepStateWhenClosed: true,
        },
    });
}

async function saveNote(
    d: Driver,
    id: string,
    body: string,
    links: string[]
): Promise<void> {
    const note = makeNote(body, links, Date.now());
    const res = await d.issueCommand({
        type: "command:scene:update-drawdy-elements",
        ...stamp(d),
        req: {
            updates: [
                {
                    drawdyElementId: id,
                    properties: { meta: { [NOTE_KEY]: note } },
                },
            ],
        },
    });
    const ok = res.res.error === undefined;
    if (ok) {
        const [el] = await fetchElements(d, [id]);
        if (el) absorb(d, [el]);
        else forget(d, [id]);
        const selectedAlone = d.selection.length === 1 && d.selection[0] === id;
        d.open = note && selectedAlone ? id : d.open === id ? null : d.open;
        refresh(d);
    }
    post({ type: "saved", id, ok, removed: note === null });
}

async function focus(d: Driver, id: string): Promise<void> {
    if (!d.notes.has(id)) return;
    const zoom = Math.min(FOCUS_ZOOM.max, Math.max(FOCUS_ZOOM.min, d.zoom));
    await d.issueCommand({
        type: "command:camera:fly-to-elements",
        ...stamp(d),
        req: { drawdyElementIds: [id], flyDurationMs: FLY_MS, zoom },
    });
    d.open = id;
    await select(d, [id]);
    refresh(d);
}

async function onMarkClicked(d: Driver, id: string): Promise<void> {
    if (!d.notes.has(id)) return;
    if (d.open === id) {
        d.open = null;
        refresh(d);
        return;
    }
    d.open = id;
    refresh(d);
    if (d.selection.length !== 1 || d.selection[0] !== id)
        await select(d, [id]);
}

async function onHit(d: Driver, ids: readonly string[]): Promise<void> {
    const hit = hitOf(ids);
    if (!hit) return;
    switch (hit.kind) {
        case "mark": {
            await onMarkClicked(d, hit.elementId);
            return;
        }
        case "close": {
            d.open = null;
            d.hovered = null;
            refresh(d);
            return;
        }
        case "edit": {
            const id = d.open;
            if (!id) return;
            if (d.selection.length !== 1 || d.selection[0] !== id)
                await select(d, [id]);
            await openPanel(d);
            return;
        }
        default: {
            return;
        }
    }
}

function onHover(
    d: Driver,
    body: Extract<
        DriverSubscriptionEvent,
        { type: "subscription:scene:pointer" }
    >["body"]
): void {
    let hovered = d.hovered;
    if (body.type === "enter") {
        const id = body.drawdyElementIds.find(
            (id) => id !== CARD_HIT && hitOf([id]) !== null
        );
        if (id) hovered = id;
    } else if (body.type === "out") {
        if (hovered && body.drawdyElementIds.includes(hovered)) hovered = null;
    } else if (body.type === "cancel") {
        hovered = null;
    }
    if (hovered === d.hovered) return;
    d.hovered = hovered;
    d.overlay.request();
}

async function handleWebviewMessage(
    d: Driver,
    message: WebviewToDriver
): Promise<void> {
    switch (message.type) {
        case "ready": {
            d.lastPanel = "";
            refresh(d);
            return;
        }
        case "save": {
            if (typeof message.id !== "string") return;
            const body = typeof message.body === "string" ? message.body : "";
            const links = Array.isArray(message.links) ? message.links : [];
            await saveNote(d, message.id, body, links);
            return;
        }
        case "remove": {
            if (typeof message.id !== "string") return;
            await saveNote(d, message.id, "", []);
            return;
        }
        case "focus": {
            if (typeof message.id !== "string") return;
            await focus(d, message.id);
            return;
        }
        default: {
            return;
        }
    }
}

export const activate: DriverModule["activate"] = async ({
    manifest,
    issueCommand,
    styling,
}) => {
    const ctx = { driverId: manifest.driverId, issueCommand, nextRequestId };
    const d: Driver = {
        manifest,
        issueCommand,
        styling,
        actionButtonId: `${manifest.driverId}:action-button`,
        webviewId: `${manifest.driverId}:webview`,
        webviewHtml: null,
        notes: new Map(),
        selection: [],
        target: null,
        open: null,
        dragging: new Set(),
        hovered: null,
        zoom: 1,
        overlay: new Overlay(
            ctx,
            () => ({
                notes: [...d.notes.values()],
                open: d.open,
                dragging: d.dragging,
                hovered: d.hovered,
                zoom: d.zoom,
                styling: d.styling,
            }),
            (elementId) => {
                // The card's own area only has to be hit-testable, to keep
                // the selection; presses there do nothing.
                if (elementId === CARD_HIT) return;
                const req = { elementIds: [elementId] };
                void issueCommand({
                    type: "subscription:scene:click",
                    ...stamp(d),
                    req,
                });
                void issueCommand({
                    type: "subscription:scene:pointer",
                    ...stamp(d),
                    req,
                });
            }
        ),
        lastPanel: "",
    };

    const created = await issueCommand({
        type: "command:dom:create-action-button",
        ...stamp(d),
        req: { domElementId: d.actionButtonId, svg: ACTION_BUTTON_SVG },
    });
    if (!created.res.value?.created) return;
    driver = d;

    const camera = await issueCommand({
        type: "command:camera:get-info",
        ...stamp(d),
    });
    if (camera.res.error === undefined) d.zoom = camera.res.value.zoom;

    await issueCommand({
        type: "subscription:dom:element-clicked",
        ...stamp(d),
        req: { domElementId: d.actionButtonId },
    });
    await issueCommand({
        type: "subscription:dom:theme-changed",
        ...stamp(d),
    });
    await issueCommand({
        type: "subscription:webview:message",
        ...stamp(d),
        req: { webviewDomId: d.webviewId },
    });
    for (const type of [
        "subscription:scene:elements-added",
        "subscription:scene:elements-removed",
        "subscription:scene:elements-updated",
        "subscription:scene:elements-replaced",
    ] as const) {
        await issueCommand({
            type,
            ...stamp(d),
            req: { properties: PROPERTIES },
        });
    }
    await issueCommand({
        type: "subscription:scene:drawdy-element-selection",
        ...stamp(d),
    });
    await issueCommand({
        type: "subscription:scene:drawdy-elements-dragged",
        ...stamp(d),
    });
    await issueCommand({
        type: "subscription:camera:moved-rapid",
        ...stamp(d),
    });

    absorb(d, await fetchElements(d));
    const selected = await issueCommand({
        type: "command:scene:get-current-selected-drawdy-elements",
        ...stamp(d),
    });
    if (selected.res.error === undefined)
        await onSelection(d, selected.res.value.drawdyElementIds);
    else refresh(d);
};

export const onEvent: DriverModule["onEvent"] = async (e) => {
    const d = driver;
    if (!d) return;
    switch (e.type) {
        case "subscription:dom:theme-changed": {
            d.styling = e.body.styling;
            post({ type: "theme", cssVars: stylingCssVars(d.styling) });
            d.overlay.request();
            return;
        }
        case "subscription:dom:element-clicked": {
            if (e.body.domElementId === d.actionButtonId) await openPanel(d);
            return;
        }
        case "subscription:scene:click": {
            await onHit(d, e.body.drawdyElementIds);
            return;
        }
        case "subscription:scene:pointer": {
            onHover(d, e.body);
            return;
        }
        case "subscription:webview:message": {
            if (e.body.webviewDomId !== d.webviewId) return;
            const message = e.body.message;
            if (typeof message !== "object" || message === null) return;
            await handleWebviewMessage(d, message as WebviewToDriver);
            return;
        }
        case "subscription:scene:elements-added":
        case "subscription:scene:elements-updated": {
            absorb(d, e.body.drawdyElements);
            refresh(d);
            return;
        }
        case "subscription:scene:elements-removed": {
            forget(
                d,
                e.body.drawdyElements.map((el) => el.id)
            );
            refresh(d);
            return;
        }
        case "subscription:scene:elements-replaced": {
            d.notes.clear();
            d.open = null;
            d.dragging = new Set();
            absorb(d, e.body.drawdyElements);
            refresh(d);
            return;
        }
        case "subscription:scene:drawdy-element-selection": {
            await onSelection(d, e.body.drawdyElementIds);
            return;
        }
        case "subscription:scene:drawdy-elements-dragged": {
            d.dragging =
                e.body.type === "dragEnd"
                    ? new Set()
                    : new Set(e.body.drawdyElementIds);
            d.overlay.request();
            return;
        }
        case "subscription:camera:moved-rapid": {
            if (e.body.zoom === d.zoom) return;
            d.zoom = e.body.zoom;
            d.overlay.request();
            return;
        }
        default: {
            return;
        }
    }
};
