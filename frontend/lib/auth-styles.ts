// Shared Tailwind utility strings; no component CSS selectors are needed.
export const authSubmitClass =
  "mt-6 flex min-h-11.75 w-full cursor-pointer items-center justify-center gap-4 rounded-[10px] bg-[#6744df] px-4.5 py-2.5 text-xs font-semibold text-white shadow-[0_5px_14px_#6744df25] transition hover:-translate-y-px hover:bg-[#5734cb] disabled:transform-none disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none";
export const authFieldClass =
  "[&>label]:mb-2 [&>label]:block [&>label]:text-xs [&>label]:font-semibold [&>small]:mt-2 [&>small]:block [&>small]:text-[11px] [&>small]:leading-normal [&>small]:text-workspace-muted";
export const authFallbackClass =
  "flex min-h-svh flex-col items-center justify-center gap-4.5 bg-workspace-bg p-7.5 text-center text-workspace-text [&>h1]:text-[25px] [&>h1]:font-semibold [&>p]:max-w-100 [&>p]:text-sm [&>p]:text-workspace-muted [&>button]:max-w-60";
export const authMessageClass =
  "mt-4 block rounded-[9px] border border-workspace-border bg-workspace-accent-soft p-3 text-xs leading-relaxed text-workspace-text";
export const authErrorClass =
  "mt-4 rounded-[9px] border border-workspace-danger bg-workspace-danger-soft p-3 text-xs leading-relaxed text-workspace-danger";
