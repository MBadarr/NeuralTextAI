"use client";

import { useEffect, useState } from "react";
import { AnalysisResults } from "@/features/analysis/components/AnalysisResults";
import { TextAnalyzer } from "@/features/analysis/components/TextAnalyzer";
import {
  TextTool,
  type ToolName,
} from "@/features/analysis/components/TextTool";
import type {
  AnalysisResult,
  Insights,
  ModelInfo,
  SearchResult,
} from "@/features/analysis/types/analysis";
import {
  deleteDocument,
  getDocuments,
  getInsights,
  getModels,
  searchDocuments,
} from "@/features/workspace/api/workspace-api";
import { useWorkspaceStore } from "@/features/workspace/store/workspace-store";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { LoadingIndicator } from "@/ui/LoadingIndicator";

const analyzerPages = [
  "Text analyzer",
  "Named entity recognition",
  "Writing assistant",
  "Predictive text",
  "Keyword extraction",
  "Readability",
];
const toolPages = [
  "Sentiment analysis",
  "Intent analysis",
  "Emotion analysis",
  "Text summary",
  "Plagiarism check",
];

function Breakdown({
  title,
  counts,
}: {
  title: string;
  counts: Record<string, number>;
}) {
  const max = Math.max(1, ...Object.values(counts));
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold">{title}</h3>
      {Object.entries(counts).map(([label, value]) => (
        <div key={label}>
          <div className="mb-1 flex justify-between text-xs">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
          <progress
            value={value}
            max={max}
            aria-label={`${title}: ${label}`}
            className="block h-2 w-full overflow-hidden rounded bg-workspace-accent-soft [&::-webkit-progress-bar]:bg-workspace-accent-soft [&::-webkit-progress-value]:bg-workspace-accent [&::-moz-progress-bar]:bg-workspace-accent"
          />
        </div>
      ))}
      {!Object.keys(counts).length && (
        <p className="text-xs text-workspace-muted">
          Analyze text to see this breakdown.
        </p>
      )}
    </div>
  );
}

export function FeatureContent({ active }: { active: string }) {
  const { query, setQuery } = useWorkspaceStore();
  const [documents, setDocuments] = useState<AnalysisResult[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [search, setSearch] = useState<SearchResult | null>(null);
  const [selected, setSelected] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (analyzerPages.includes(active) || toolPages.includes(active)) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setSelected(null);
    Promise.all([
      getDocuments(controller.signal),
      getInsights(controller.signal),
      getModels(controller.signal),
    ])
      .then(([docs, stats, pipelines]) => {
        if (!controller.signal.aborted) {
          setDocuments(docs);
          setInsights(stats);
          setModels(pipelines);
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [active]);

  useEffect(() => {
    if (active !== "Semantic search") return;
    const controller = new AbortController();
    setSearch(null);
    setError("");
    if (!query.trim()) {
      setSearching(false);
      return () => controller.abort();
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchDocuments(query, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setSearch(result);
        })
        .catch((reason) => {
          if (!controller.signal.aborted) setError(reason.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [active, query]);

  async function remove(id: string) {
    setDeleting(id);
    setError("");
    try {
      await deleteDocument(id);
      setDocuments((items) => items.filter((item) => item.id !== id));
      if (selected?.id === id) setSelected(null);
      setInsights(await getInsights());
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not delete document.",
      );
    } finally {
      setDeleting(null);
    }
  }

  if (analyzerPages.includes(active))
    return <TextAnalyzer key={active} feature={active} />;
  if (toolPages.includes(active))
    return <TextTool key={active} name={active as ToolName} />;
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const filtered = documents.filter((document) => {
    const content = `${document.title} ${document.text}`.toLowerCase();
    return terms.every((term) => content.includes(term));
  });
  const entities = filtered.flatMap((document) =>
    document.entities.map((entity) => ({
      ...entity,
      documentId: document.id,
      title: document.title,
    })),
  );

  return (
    <section className="space-y-5 rounded-xl border border-workspace-border bg-workspace-surface p-5 shadow-sm">
      <h2 className="text-sm font-bold">{active}</h2>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-workspace-danger-soft p-3 text-xs text-workspace-danger"
        >
          {error}
        </p>
      )}
      {loading && <LoadingIndicator label="Loading workspace" />}
      {active === "Documents" && (
        <>
          <p className="text-xs text-workspace-muted">
            Saved analyses, newest first. Select a document to inspect or export
            its results.
          </p>
          {filtered.map((document) => (
            <div
              key={document.id}
              className="flex items-center justify-between gap-3 border-b border-workspace-border py-3"
            >
              <Button
                type="button"
                onClick={() => setSelected(document)}
                className="min-w-0 text-left"
              >
                <strong className="block text-sm">{document.title}</strong>
                <span className="text-xs text-workspace-muted">
                  {document.word_count} words · {document.entities.length}{" "}
                  entities · {new Date(document.created_at).toLocaleString()}
                </span>
              </Button>
              <Button
                type="button"
                disabled={deleting !== null}
                onClick={() => remove(document.id)}
                className="text-xs text-workspace-danger disabled:opacity-50"
              >
                {deleting === document.id ? "Deleting…" : "Delete"}
              </Button>
            </div>
          ))}
          {!loading && !error && !filtered.length && (
            <p className="text-sm text-workspace-muted">
              No documents found. Analyze some text first.
            </p>
          )}
        </>
      )}
      {active === "Semantic search" && (
        <>
          <label htmlFor="semantic-query" className="block text-xs">
            Find documents by topic or meaning
          </label>
          <Input
            id="semantic-query"
            maxLength={1000}
            className="w-full rounded-lg border border-workspace-border p-3 text-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Enter a topic or keywords, e.g. language research…"
          />
          {searching && <p className="text-xs">Searching…</p>}
          {search && (
            <>
              <p className="text-xs text-workspace-muted">
                {search.results.length} results · {search.method}
              </p>
              {search.warnings.map((warning) => (
                <p key={warning} className="text-xs text-workspace-warning">
                  {warning}
                </p>
              ))}
              {search.results.map(({ document, score }) => (
                <Button
                  type="button"
                  key={document.id}
                  onClick={() => setSelected(document)}
                  className="block w-full rounded-lg bg-workspace-subtle p-4 text-left"
                >
                  <div className="flex justify-between gap-3">
                    <strong className="text-sm">{document.title}</strong>
                    <span className="text-xs text-workspace-accent">
                      Similarity {Math.round(score * 100)}%
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs leading-6 text-workspace-muted">
                    {document.text}
                  </p>
                </Button>
              ))}
              {!search.results.length && (
                <p className="text-sm">No matching documents.</p>
              )}
            </>
          )}
          {!query.trim() && (
            <p className="text-sm text-workspace-muted">
              Enter a query to search your analyzed documents.
            </p>
          )}
        </>
      )}
      {active === "Models & pipelines" &&
        models.map((model) => (
          <div
            key={model.name}
            className="space-y-3 rounded-lg bg-workspace-subtle p-4"
          >
            <strong className="text-sm">{model.name}</strong>
            <p className="text-xs">
              {model.trained
                ? "Trained pipeline ready"
                : "Limited fallback pipeline"}{" "}
              · {model.vectors} vector dimensions
            </p>
            <p className="text-xs text-workspace-muted">
              Pipeline: {model.components.join(", ")}
            </p>
            <div className="flex flex-wrap gap-2">
              {model.capabilities.map((capability) => (
                <span
                  key={capability}
                  className="rounded-full bg-workspace-surface px-3 py-2 text-xs"
                >
                  {capability}
                </span>
              ))}
            </div>
          </div>
        ))}
      {(active === "Analytics" || active === "Entity explorer") && insights && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Documents", insights.total_documents],
              ["Words", insights.total_words],
              ["Entities", insights.total_entities],
              ["Avg. milliseconds", insights.average_processing_time_ms],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg bg-workspace-subtle p-4 text-center"
              >
                <strong className="block text-xl text-workspace-accent">
                  {value}
                </strong>
                <span className="text-xs text-workspace-muted">{label}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <Breakdown title="Entity types" counts={insights.entity_counts} />
            <Breakdown title="Languages" counts={insights.language_counts} />
            <Breakdown title="Sentiment" counts={insights.sentiment_counts} />
          </div>
        </>
      )}
      {active === "Entity explorer" && (
        <div className="space-y-2">
          {entities.map((entity) => (
            <div
              key={`${entity.documentId}-${entity.start}-${entity.end}`}
              className="flex justify-between gap-3 rounded-lg bg-workspace-subtle p-3 text-xs"
            >
              <span>
                <strong>{entity.text}</strong>
                <span className="ml-2 text-workspace-muted">
                  {entity.title}
                </span>
              </span>
              <span className="text-workspace-accent">{entity.label}</span>
            </div>
          ))}
          {!loading && !entities.length && (
            <p className="text-sm text-workspace-muted">No entities found.</p>
          )}
        </div>
      )}
      {selected && (
        <div className="border-t border-workspace-border pt-5">
          <Button
            type="button"
            onClick={() => setSelected(null)}
            className="mb-4 text-xs text-workspace-accent"
          >
            Close document
          </Button>
          <AnalysisResults key={selected.id} result={selected} />
        </div>
      )}
    </section>
  );
}
