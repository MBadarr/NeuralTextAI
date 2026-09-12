"use client";

import { useEffect, useState } from "react";

import { Icon, type IconName } from "@/components/Icon";
import { TextAnalyzer } from "@/components/TextAnalyzer";
import { TextTool, type ToolName } from "@/components/TextTool";
import {
  deleteDocument,
  getDocuments,
  getInsights,
  getModels,
} from "@/lib/api";
import type { AnalysisResult, Insights, ModelInfo } from "@/types/analysis";

const copy: Record<string, string> = {
  Settings: "Update workspace preferences, appearance, and analysis defaults.",
  "Help center":
    "Find quick guidance for analyzing documents and understanding NLP results.",
};
const icons: Record<string, IconName> = {
  Documents: "file",
  "Entity explorer": "users",
  Analytics: "chart",
  "Semantic search": "search",
  "Models & pipelines": "layers",
  Settings: "settings",
  "Help center": "help",
};

function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="rounded-lg bg-red-50 p-3 text-xs text-red-600">{message}</p>
  );
}

export function FeaturePage({ active }: { active: string }) {
  const [documents, setDocuments] = useState<AnalysisResult[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError("");
    setLoading(true);
    if (
      ["Documents", "Entity explorer", "Analytics", "Semantic search"].includes(
        active,
      )
    ) {
      getDocuments()
        .then(setDocuments)
        .catch((reason) =>
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load documents.",
          ),
        )
        .finally(() => setLoading(false));
    }
    if (active === "Analytics" || active === "Entity explorer") {
      getInsights()
        .then(setInsights)
        .catch((reason) =>
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load insights.",
          ),
        );
    }
    if (active === "Models & pipelines") {
      getModels()
        .then(setModels)
        .catch((reason) =>
          setError(
            reason instanceof Error ? reason.message : "Could not load models.",
          ),
        )
        .finally(() => setLoading(false));
    }
    if (
      ![
        "Documents",
        "Entity explorer",
        "Analytics",
        "Semantic search",
      ].includes(active) &&
      active !== "Models & pipelines"
    )
      setLoading(false);
  }, [active]);

  if (
    [
      "Text analyzer",
      "Named entity recognition",
      "Writing assistant",
      "Predictive text",
    ].includes(active)
  )
    return <TextAnalyzer />;
  if (
    active === "Sentiment analysis" ||
    active === "Text summary" ||
    active === "Plagiarism check"
  )
    return <TextTool name={active as ToolName} />;

  if (active === "Documents") {
    return (
      <section className="rounded-[11px] border border-[#ededf3] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold">Your documents</h2>
        <p className="mb-5 mt-1 text-[11px] text-[#aaa9b8]">
          Documents created through the analyzer.
        </p>
        {loading && (
          <p className="py-8 text-center text-xs text-[#aaa9b8]">
            Loading documents...
          </p>
        )}
        {error && <ErrorMessage message={error} />}
        {documents.length ? (
          documents.map((document) => (
            <div
              className="flex items-center justify-between border-b border-[#f0eff4] py-4"
              key={document.id}
            >
              <div>
                <strong className="block text-xs">{document.title}</strong>
                <span className="text-[10px] text-[#888797]">
                  {document.word_count} words · {document.entities.length}{" "}
                  entities
                </span>
              </div>
              <button
                type="button"
                className="text-xs text-red-500"
                onClick={() =>
                  deleteDocument(document.id)
                    .then(() =>
                      setDocuments((items) =>
                        items.filter((item) => item.id !== document.id),
                      ),
                    )
                    .catch(() => setError("Could not delete document."))
                }
              >
                Delete
              </button>
            </div>
          ))
        ) : (
          <p className="py-12 text-center text-xs text-[#aaa9b8]">
            No documents yet. Analyze some text first.
          </p>
        )}
      </section>
    );
  }

  if (active === "Semantic search") {
    const results = documents.filter((document) =>
      `${document.title} ${document.text}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
    return (
      <section className="rounded-[11px] border border-[#ededf3] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold">Search documents</h2>
        <input
          className="my-5 w-full rounded-lg border border-[#e6e5ee] p-3 text-xs outline-none focus:border-[#7357ef]"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search titles and text..."
        />
        {loading && (
          <p className="py-8 text-center text-xs text-[#aaa9b8]">
            Loading documents...
          </p>
        )}
        {error && <ErrorMessage message={error} />}
        {results.map((document) => (
          <div className="border-b border-[#f0eff4] py-3" key={document.id}>
            <strong className="text-xs">{document.title}</strong>
            <p className="mt-1 line-clamp-2 text-[11px] text-[#888797]">
              {document.text}
            </p>
          </div>
        ))}
        {!results.length && (
          <p className="py-8 text-center text-xs text-[#aaa9b8]">
            No matching documents.
          </p>
        )}
      </section>
    );
  }

  if (active === "Models & pipelines") {
    return (
      <section className="rounded-[11px] border border-[#ededf3] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold">Models & pipelines</h2>
        {error && <ErrorMessage message={error} />}
        {loading && (
          <p className="py-8 text-center text-xs text-[#aaa9b8]">
            Loading models...
          </p>
        )}
        {models.map((model) => (
          <div className="mt-5 rounded-lg bg-[#f8f7fd] p-4" key={model.name}>
            <strong className="text-xs">{model.name}</strong>
            <p className="mt-2 text-[11px] text-[#888797]">
              {model.language} · {model.components.join(", ") || "sentencizer"}
            </p>
          </div>
        ))}
        {!loading && !models.length && !error && (
          <p className="py-8 text-center text-xs text-[#aaa9b8]">
            No models are available.
          </p>
        )}
      </section>
    );
  }

  if (active === "Analytics" || active === "Entity explorer") {
    return (
      <section className="rounded-[11px] border border-[#ededf3] bg-white p-5 shadow-sm">
        <div className="flex h-[58px] w-[58px] items-center justify-center rounded-xl bg-[#f0edff] text-[#7357ef]">
          <Icon name={icons[active]} size={28} />
        </div>
        <h2 className="mt-5 text-xl font-bold">{active}</h2>
        {error && <ErrorMessage message={error} />}
        {loading && (
          <p className="mt-6 text-xs text-[#aaa9b8]">Loading insights...</p>
        )}
        {insights && (
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              ["Documents", insights.total_documents],
              ["Words", insights.total_words],
              ["Entities", insights.total_entities],
            ].map(([label, value]) => (
              <div
                className="rounded-lg bg-[#f8f7fd] p-4 text-center"
                key={label}
              >
                <strong className="block text-xl text-[#7357ef]">
                  {value}
                </strong>
                <span className="text-[10px] text-[#888797]">{label}</span>
              </div>
            ))}
          </div>
        )}
        {active === "Entity explorer" && documents.length > 0 && (
          <div className="mt-6 space-y-2">
            {documents
              .flatMap((document) => document.entities)
              .map((entity, index) => (
                <div
                  className="flex justify-between rounded-lg bg-[#f8f7fd] p-3 text-xs"
                  key={`${entity.text}-${index}`}
                >
                  <strong>{entity.text}</strong>
                  <span className="text-[#7357ef]">{entity.label}</span>
                </div>
              ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="min-h-75 max-w-190 rounded-[11px] border border-[#ededf3] bg-white p-8 shadow-sm lg:p-10.5">
      <div className="flex h-14.5 w-14.5 items-center justify-center rounded-xl bg-[#f0edff] text-[#7357ef]">
        <Icon name={icons[active] ?? "layers"} size={28} />
      </div>
      <h2 className="mt-5.5 text-xl font-bold">{active}</h2>
      <p className="mb-6 max-w-140 text-[13px] leading-7 text-[#85859b]">
        {copy[active]}
      </p>
      <button
        type="button"
        className="flex items-center gap-2 rounded-lg bg-[#7357ef] px-3 py-2.5 text-xs font-bold text-white"
      >
        Get started <Icon name="arrow" size={15} />
      </button>
    </section>
  );
}
