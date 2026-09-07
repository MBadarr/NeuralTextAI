"use client";

import { useEffect, useMemo, useState } from "react";

import { Icon, type IconName } from "@/components/Icon";
import { getDocuments, getInsights } from "@/lib/api";
import type { AnalysisResult, Insights } from "@/types/analysis";

const cards: Array<[string, string, IconName, string]> = [
  ["Documents analyzed", "violet", "file", "0"],
  ["Words processed", "blue", "scan", "0"],
  ["Entities discovered", "orange", "users", "0"],
  ["Avg. processing time", "green", "chart", "—"],
];

export function Overview({
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
    Promise.all([getDocuments(), getInsights()])
      .then(([loadedDocuments, loadedInsights]) => {
        setDocuments(loadedDocuments);
        setInsights(loadedInsights);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load overview data.",
        ),
      );
  }, []);

  const filteredDocuments = useMemo(
    () =>
      documents.filter((document) =>
        document.title.toLowerCase().includes(query.toLowerCase()),
      ),
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
    "—",
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-[18px] sm:p-7 lg:p-[42px]">
      <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[.08em] text-[#7357ef]">
            ● Workspace overview
          </p>
          <h1 className="text-2xl font-bold tracking-tight lg:text-[29px]">
            Good morning, Badar <span className="text-[#f3b649]">✦</span>
          </h1>
          <p className="mt-2 text-[13px] text-[#85859b]">
            Here&apos;s what&apos;s happening across your NLP workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("Text analyzer")}
          className="flex items-center gap-2 rounded-lg bg-[#7357ef] px-4 py-3 text-xs font-bold text-white shadow-lg shadow-[#7357ef2e]"
        >
          <Icon name="scan" size={16} /> New analysis{" "}
          <span className="border-l border-white/30 pl-2 text-base">+</span>
        </button>
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, tone, icon, fallback], index) => (
          <div
            className="rounded-[11px] border border-[#ededf3] bg-white p-[18px] shadow-sm"
            key={label}
          >
            <div
              className={`mb-4 flex h-[30px] w-[30px] items-center justify-center rounded-lg ${tone === "violet" ? "bg-[#efecff] text-[#7357ef]" : tone === "blue" ? "bg-[#e7f3ff] text-[#3c9eea]" : tone === "orange" ? "bg-[#fff2df] text-[#f2a63d]" : "bg-[#e7f8ef] text-[#35b979]"}`}
            >
              <Icon name={icon} />
            </div>
            <p className="text-[11px] text-[#8f8e9e]">{label}</p>
            <strong className="my-1 block text-[25px] tracking-tight">
              {values[index] || fallback}
            </strong>
            <span className="text-[10px] text-[#aaa9b8]">
              Live workspace data
            </span>
          </div>
        ))}
      </div>
      <section className="rounded-[11px] border border-[#ded8ff] bg-gradient-to-r from-[#f5f2ff] to-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-bold">Writing intelligence tools</h2>
          <p className="mt-1 text-[11px] text-[#85859b]">
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
            <button
              type="button"
              key={label}
              onClick={() => onNavigate(label)}
              className="flex items-start gap-3 rounded-lg border border-[#e8e3ff] bg-white p-3 text-left hover:border-[#7357ef]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eeeaff] text-[#7357ef]">
                <Icon name={icon as IconName} size={16} />
              </span>
              <span>
                <strong className="block text-xs">{label}</strong>
                <span className="mt-1 block text-[10px] leading-4 text-[#85859b]">
                  {description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <section className="rounded-[11px] border border-[#ededf3] bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <h2 className="text-sm font-bold">Recent documents</h2>
              <p className="mt-1 text-[11px] text-[#aaa9b8]">
                Your latest analyzed documents
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("Documents")}
              className="text-[11px] font-bold text-[#7357ef]"
            >
              View all →
            </button>
          </div>
          <div className="mt-5 divide-y divide-[#f0eff4]">
            {filteredDocuments.slice(0, 5).map((document) => (
              <div
                className="flex min-h-[61px] items-center justify-between gap-3"
                key={document.id}
              >
                <div className="min-w-0">
                  <strong className="block truncate text-xs">
                    {document.title}
                  </strong>
                  <small className="mt-1 block text-[10px] text-[#aaa9b8]">
                    {document.word_count} words · {document.entities.length}{" "}
                    entities
                  </small>
                </div>
                <span className="text-[10px] text-[#39b778]">● Analyzed</span>
              </div>
            ))}
            {!filteredDocuments.length && (
              <p className="py-12 text-center text-xs text-[#aaa9b8]">
                No analyzed documents yet. Start with Text Analyzer.
              </p>
            )}
          </div>
        </section>
        <section className="rounded-[11px] border border-[#ededf3] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold">Entity breakdown</h2>
          <p className="mt-1 text-[11px] text-[#aaa9b8]">
            Entities found in analyzed text
          </p>
          <div className="mt-6 space-y-4">
            {entityCounts.length ? (
              entityCounts.map(([label, count]) => (
                <div
                  className="flex items-center justify-between rounded-lg bg-[#f8f7fd] p-3 text-xs"
                  key={label}
                >
                  <span>{label}</span>
                  <strong className="text-[#7357ef]">{count}</strong>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-xs text-[#aaa9b8]">
                No entities found yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
