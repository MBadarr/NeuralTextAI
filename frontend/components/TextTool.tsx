"use client";

import { useState } from "react";

import { runTextTool } from "@/lib/api";
import type {
  PlagiarismResult,
  SentimentResult,
  SummaryResult,
} from "@/types/analysis";

const settings = {
  "Sentiment analysis": [
    "sentiment",
    "Understand whether text is positive, neutral, or negative.",
  ],
  "Text summary": [
    "summary",
    "Create a short extractive summary from pasted text.",
  ],
  "Plagiarism check": [
    "plagiarism",
    "Compare pasted text against documents already analyzed in this workspace.",
  ],
} as const;
export type ToolName = keyof typeof settings;

export function TextTool({ name }: { name: ToolName }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<
    SentimentResult | SummaryResult | PlagiarismResult | null
  >(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [path, description] = settings[name];

  async function submit() {
    if (!text.trim()) return setError("Paste text before running this tool.");
    setLoading(true);
    setError("");
    try {
      setResult(await runTextTool(path, text));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The request failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-[#ededf3] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold">{name}</h2>
        <p className="mt-1 text-[11px] text-[#aaa9b8]">{description}</p>
        <textarea
          className="mt-5 min-h-64 w-full rounded-lg border border-[#e6e5ee] p-3 text-xs outline-none focus:border-[#7357ef]"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste text here..."
        />
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="mt-4 rounded-lg bg-[#7357ef] px-4 py-3 text-xs font-bold text-white disabled:opacity-60"
        >
          {loading ? "Processing..." : `Run ${name.toLowerCase()}`}
        </button>
      </section>
      <section className="rounded-xl border border-[#ededf3] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold">Result</h2>
        {!result ? (
          <p className="py-12 text-center text-xs text-[#aaa9b8]">
            Your result will appear here.
          </p>
        ) : name === "Sentiment analysis" && "label" in result ? (
          <div className="mt-8 text-center">
            <strong className="text-3xl text-[#7357ef]">{result.label}</strong>
            <p className="mt-3 text-xs text-[#888797]">
              Score {result.score} · Confidence{" "}
              {Math.round(result.confidence * 100)}%
            </p>
          </div>
        ) : name === "Text summary" && "summary" in result ? (
          <p className="mt-6 text-sm leading-7 text-[#55546b]">
            {result.summary || "No summary could be generated."}
          </p>
        ) : "match_percentage" in result ? (
          <div className="mt-8 text-center">
            <strong className="text-3xl text-[#7357ef]">
              {result.match_percentage}%
            </strong>
            <p className="mt-3 text-xs text-[#888797]">
              Similarity with analyzed documents
            </p>
            {result.matches.length > 0 && (
              <div className="mt-6 space-y-2 text-left">
                {result.matches.map((match) => (
                  <div
                    className="flex justify-between rounded-lg bg-[#f8f7fd] p-3 text-xs"
                    key={match.document_id}
                  >
                    <span>{match.title}</span>
                    <strong className="text-[#7357ef]">{match.overlap}%</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="py-12 text-center text-xs text-[#aaa9b8]">
            The API returned an unsupported result.
          </p>
        )}
      </section>
    </div>
  );
}
