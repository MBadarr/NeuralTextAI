"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AnalysisResult,
  Insights,
} from "@/features/analysis/types/analysis";
import {
  getDocuments,
  getInsights,
} from "@/features/workspace/api/workspace-api";
import { Button } from "@/ui/Button";
import { Icon, type IconName } from "@/ui/Icon";

const cards: Array<[string, string, IconName, string]> = [
  ["Documents analyzed", "violet", "file", "0"],
  ["Words processed", "blue", "scan", "0"],
  ["Entities discovered", "orange", "users", "0"],
  ["Avg. processing time", "green", "chart", "—"],
];

export function OverviewScreen({
  query,
  onNavigate,
}: {
  query: string;
  onNavigate: (page: string) => void;
}) {
  const [documents, setDocuments] = useState<AnalysisResult[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getDocuments(controller.signal),
      getInsights(controller.signal),
    ])
      .then(([loadedDocuments, loadedInsights]) => {
        if (controller.signal.aborted) return;
        setDocuments(loadedDocuments);
        setInsights(loadedInsights);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load overview data.",
          );
      });
    return () => controller.abort();
  }, []);

  const filteredDocuments = useMemo(
    () =>
      documents.filter((document) => {
        const content = `${document.title} ${document.text}`.toLowerCase();
        return query
          .toLowerCase()
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .every((term) => content.includes(term));
      }),
    [documents, query],
  );
  const entityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    documents
      .flatMap((document) => document.entities)
      .forEach((entity) => {
        counts.set(entity.label, (counts.get(entity.label) ?? 0) + 1);
      });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [documents]);
  const values = [
    insights?.total_documents ?? 0,
    insights?.total_words ?? 0,
    insights?.total_entities ?? 0,
    `${insights?.average_processing_time_ms ?? 0} ms`,
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-[18px] sm:p-7 lg:p-[42px]">
      <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[.08em] text-workspace-accent">
            ● Workspace overview
          </p>
          <h1 className="text-2xl font-bold tracking-tight lg:text-[29px]">
            Your language workspace <span className="text-[#f3b649]">✦</span>
          </h1>
          <p className="mt-2 text-[13px] text-workspace-muted">
            Here&apos;s what&apos;s happening across your NLP workspace.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => onNavigate("Text analyzer")}
          className="flex items-center gap-2 rounded-lg bg-workspace-primary px-4 py-3 text-xs font-bold text-workspace-on-primary shadow-lg shadow-[#7357ef2e]"
        >
          <Icon name="scan" size={16} /> New analysis{" "}
          <span className="border-l border-white/30 pl-2 text-base">+</span>
        </Button>
      </div>
      {error && (
        <p className="rounded-lg bg-workspace-danger-soft p-3 text-xs text-workspace-danger">
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, tone, icon, fallback], index) => (
          <div
            className="rounded-[11px] border border-workspace-border bg-workspace-surface p-[18px] shadow-sm"
            key={label}
          >
            <div
              className={`mb-4 flex h-[30px] w-[30px] items-center justify-center rounded-lg ${tone === "violet" ? "bg-workspace-accent-soft text-workspace-accent" : tone === "blue" ? "bg-workspace-info-soft text-workspace-info" : tone === "orange" ? "bg-workspace-warning-soft text-workspace-warning" : "bg-workspace-success-soft text-workspace-success"}`}
            >
              <Icon name={icon} />
            </div>
            <p className="text-[11px] text-workspace-muted">{label}</p>
            <strong className="my-1 block text-[25px] tracking-tight">
              {values[index] || fallback}
            </strong>
            <span className="text-[10px] text-workspace-muted">
              Live workspace data
            </span>
          </div>
        ))}
      </div>
      <section className="rounded-[11px] border border-workspace-accent-border bg-gradient-to-r from-workspace-accent-soft to-workspace-surface p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-bold">Writing intelligence tools</h2>
          <p className="mt-1 text-[11px] text-workspace-muted">
            Paste text in the analyzer to use all three live writing features.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            [
              "Named entity recognition",
              "Find people, dates, locations, and organizations.",
              "users",
            ],
            [
              "Writing assistant",
              "Catch typos, grammar, structure, and style issues.",
              "file",
            ],
            [
              "Predictive text",
              "Get context-aware words and sentence completions.",
              "spark",
            ],
          ].map(([label, description, icon]) => (
            <Button
              type="button"
              key={label}
              onClick={() => onNavigate(label)}
              className="flex items-start gap-3 rounded-lg border border-workspace-accent-border bg-workspace-surface p-3 text-left hover:border-workspace-accent"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-workspace-accent-soft text-workspace-accent">
                <Icon name={icon as IconName} size={16} />
              </span>
              <span>
                <strong className="block text-xs">{label}</strong>
                <span className="mt-1 block text-[10px] leading-4 text-workspace-muted">
                  {description}
                </span>
              </span>
            </Button>
          ))}
        </div>
      </section>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <section className="rounded-[11px] border border-workspace-border bg-workspace-surface p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <h2 className="text-sm font-bold">Recent documents</h2>
              <p className="mt-1 text-[11px] text-workspace-muted">
                Your latest analyzed documents
              </p>
            </div>
            <Button
              type="button"
              onClick={() => onNavigate("Documents")}
              className="text-[11px] font-bold text-workspace-accent"
            >
              View all →
            </Button>
          </div>
          <div className="mt-5 divide-y divide-workspace-border">
            {filteredDocuments.slice(0, 5).map((document) => (
              <div
                className="flex min-h-[61px] items-center justify-between gap-3"
                key={document.id}
              >
                <div className="min-w-0">
                  <strong className="block truncate text-xs">
                    {document.title}
                  </strong>
                  <small className="mt-1 block text-[10px] text-workspace-muted">
                    {document.word_count} words · {document.entities.length}{" "}
                    entities
                  </small>
                </div>
                <span className="text-[10px] text-workspace-success">
                  ● Analyzed
                </span>
              </div>
            ))}
            {!filteredDocuments.length && (
              <p className="py-12 text-center text-xs text-workspace-muted">
                No analyzed documents yet. Start with Text Analyzer.
              </p>
            )}
          </div>
        </section>
        <section className="rounded-[11px] border border-workspace-border bg-workspace-surface p-5 shadow-sm">
          <h2 className="text-sm font-bold">Entity breakdown</h2>
          <p className="mt-1 text-[11px] text-workspace-muted">
            Entities found in analyzed text
          </p>
          <div className="mt-6 space-y-4">
            {entityCounts.length ? (
              entityCounts.map(([label, count]) => (
                <div
                  className="flex items-center justify-between rounded-lg bg-workspace-subtle p-3 text-xs"
                  key={label}
                >
                  <span>{label}</span>
                  <strong className="text-workspace-accent">{count}</strong>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-xs text-workspace-muted">
                No entities found yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
