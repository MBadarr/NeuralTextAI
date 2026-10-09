export function LoadingIndicator({
  label = "Loading",
  fullScreen = false,
  compact = false,
}: {
  label?: string;
  fullScreen?: boolean;
  compact?: boolean;
}) {
  const indicator = (
    <output
      className={`flex items-center justify-center ${compact ? "p-0" : "p-3"}`}
      aria-label={label}
    >
      <span
        className={`block animate-spin rounded-full border-[3px] motion-reduce:animate-none ${compact ? "size-5 border-current border-r-transparent" : "size-9 border-workspace-border border-t-workspace-accent"}`}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </output>
  );
  return fullScreen ? (
    <main className="flex min-h-svh items-center justify-center bg-workspace-bg p-7.5 text-workspace-text">
      {indicator}
    </main>
  ) : (
    indicator
  );
}
