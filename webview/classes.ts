export const FOCUS =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
export const FIELD = `w-full resize-none rounded-xl border border-line bg-subtle px-3 py-2 text-[13px] leading-5 text-fg placeholder:text-fg-disabled transition-colors hover:bg-hover focus:border-line-strong focus:bg-active focus:outline-none focus:ring-1 focus:ring-ring`;
export const SECTION_LABEL =
    "flex items-center justify-between gap-3 text-label text-fg-muted";
export const PRIMARY = `inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-accent px-3 text-label-md text-on-accent transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:cursor-not-allowed disabled:bg-disabled disabled:text-fg-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel`;
export const SECONDARY = `inline-flex h-9 cursor-pointer items-center justify-center gap-1 rounded-xl border border-line bg-subtle px-3 text-label-md text-fg-muted transition-colors hover:bg-hover hover:text-fg active:bg-pressed disabled:cursor-not-allowed disabled:text-fg-disabled disabled:hover:bg-subtle ${FOCUS}`;
export const ROW = `flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-hover active:bg-pressed aria-[current=true]:bg-control-subtle ${FOCUS}`;
