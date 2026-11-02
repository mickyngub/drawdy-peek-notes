export type NoteDraft = {
    body: string;
    links: string[];
};

export type Target = {
    id: string;
    label: string;
    note: NoteDraft | null;
};

export type NoteRow = {
    id: string;
    label: string;
    preview: string;
};

export type PanelState = {
    selected: number;
    target: Target | null;
    notes: NoteRow[];
};

export type WebviewToDriver =
    | { type: "ready" }
    | { type: "save"; id: string; body: string; links: string[] }
    | { type: "remove"; id: string }
    | { type: "focus"; id: string };

export type DriverToWebview =
    | ({ type: "state" } & PanelState)
    | { type: "saved"; id: string; ok: boolean; removed: boolean }
    | { type: "theme"; cssVars: string };
