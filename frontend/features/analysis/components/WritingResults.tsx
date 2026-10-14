"use client";

import type { WritingIssue } from "@/features/analysis/types/analysis";
import { Button } from "@/ui/Button";

export function WritingResults({
  text,
  predictive,
  status,
  issues,
  suggestions,
  source,
  warnings,
  applyCorrection,
  applySuggestion,
}: {
  text: string;
  predictive: boolean;
  status: string;
  issues: WritingIssue[];
  suggestions: string[];
  source: string;
  warnings: string[];
  applyCorrection: (issue: WritingIssue) => void;
  applySuggestion: (suggestion: string) => void;
}) {
  return (
    <div className="space-y-4" aria-live="polite">
      <h2 className="text-sm font-bold">
        {predictive ? "Completion suggestions" : "Writing review"}
      </h2>
      <p className="text-xs leading-6 text-workspace-muted">
        {predictive
          ? "Place the cursor where you want to continue. Choose a word or phrase to insert it into your draft."
          : "Review spelling, grammar, punctuation, and style. Apply each correction to update your draft."}
      </p>
      <p className="text-xs text-workspace-muted">
        {!text.trim()
          ? "Start typing to begin."
          : status === "checking"
            ? "Checking…"
            : status === "unavailable"
              ? "Service unavailable"
              : status === "ready"
                ? predictive
                  ? `${suggestions.length} suggestions · ${source}`
                  : `${issues.length} issues found`
                : "Waiting for text…"}
      </p>
      {warnings.map((warning) => (
        <p key={warning} className="text-xs text-workspace-warning">
          {warning}
        </p>
      ))}
      {!predictive &&
        issues.map((issue) => (
          <div
            key={`${issue.start}-${issue.end}-${issue.message}`}
            className="space-y-2 rounded-lg bg-workspace-subtle p-4"
          >
            <span className="text-xs font-bold text-workspace-accent">
              {issue.type}
            </span>
            <p className="text-sm">{issue.message}</p>
            <p className="text-xs text-workspace-muted">
              <q>
                {Array.from(text).slice(issue.start, issue.end).join("") ||
                  "End of text"}
              </q>
              {issue.replacement !== null && (
                <>
                  {" "}
                  → <q>{issue.replacement}</q>
                </>
              )}
            </p>
            {issue.replacement !== null && (
              <Button
                type="button"
                onClick={() => applyCorrection(issue)}
                className="text-xs font-bold text-workspace-accent"
              >
                Apply
              </Button>
            )}
          </div>
        ))}
      {predictive && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <Button
              type="button"
              key={suggestion}
              onClick={() => applySuggestion(suggestion)}
              className="rounded-lg border border-workspace-accent-border px-4 py-3 text-sm text-workspace-accent"
            >
              {suggestion}
            </Button>
          ))}
        </div>
      )}
      {status === "ready" &&
        (predictive ? !suggestions.length : !issues.length) && (
          <p className="text-sm text-workspace-muted">
            {predictive
              ? "No continuation found for this context. Try a partial word, or analyze documents to teach the workspace your phrases."
              : "No issues detected by the available checks."}
          </p>
        )}
      {predictive && (
        <p className="text-xs leading-6 text-workspace-muted">
          Suggestions use phrases from your draft and saved documents, plus
          dictionary word completion. They do not generate arbitrary sentences.
        </p>
      )}
    </div>
  );
}
