import type { ClassificationResult } from "@/types/analysis";

export function ClassificationResults({
  result,
  kind,
}: {
  result?: ClassificationResult | null;
  kind: "Intent" | "Emotion";
}) {
  if (!result)
    return (
      <p className="text-sm text-workspace-muted">
        Run a new analysis to see {kind.toLowerCase()} results for this
        document.
      </p>
    );
  return (
    <section className="space-y-4" aria-label={`${kind} results`}>
      <h3 className="text-sm font-bold">
        {kind}: <span className="text-workspace-accent">{result.label}</span>
      </h3>
      <p className="text-xs text-workspace-muted">{result.method}</p>
      <p className="text-xs text-workspace-muted">
        {kind === "Intent"
          ? "Counts show how many sentences express each intent."
          : "Scores show weighted emotion evidence in the text."}
      </p>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Object.entries(result.scores).map(([label, score]) => (
          <div key={label} className="rounded-lg bg-workspace-subtle p-3">
            <dt className="text-xs text-workspace-muted">{label}</dt>
            <dd className="font-bold text-workspace-accent">{score}</dd>
          </div>
        ))}
      </dl>
      {result.warnings.map((warning) => (
        <p key={warning} className="text-xs leading-6 text-workspace-muted">
          {warning}
        </p>
      ))}
      <div className="max-h-96 space-y-3 overflow-auto">
        {result.sentences.map((sentence) => (
          <div
            key={`${sentence.start}-${sentence.end}`}
            className="rounded-lg border border-workspace-border p-3"
          >
            <strong className="text-xs text-workspace-accent">
              {sentence.label}
            </strong>
            <p className="mt-1 whitespace-pre-wrap text-sm">{sentence.text}</p>
            {typeof sentence.evidence === "string" ? (
              <p className="mt-2 text-xs text-workspace-muted">
                {sentence.evidence}
              </p>
            ) : (
              sentence.evidence?.map((item) => (
                <span
                  key={`${item.start}-${item.end}`}
                  className="mr-2 mt-2 inline-block rounded bg-workspace-subtle px-2 py-1 text-xs"
                >
                  {item.text} · {item.label}
                  {item.negated ? " (negated, excluded)" : ""}
                </span>
              ))
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
