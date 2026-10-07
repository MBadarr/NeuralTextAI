"use client";

import { useEffect, useRef, useState } from "react";
import { runTextTool } from "@/lib/api";
import type {
  PlagiarismResult,
  SentimentResult,
  SummaryResult,
} from "@/types/analysis";

const tools = {
  "Sentiment analysis": [
    "sentiment",
    "Analyze English sentiment, including negation and emphasis.",
  ],
  "Text summary": [
    "summary",
    "Rank sentences by relevance and preserve their original order.",
  ],
  "Plagiarism check": [
    "plagiarism",
    "Compare wording with saved workspace documents. Similarity alone does not prove plagiarism.",
  ],
} as const;
export type ToolName = keyof typeof tools;

export function TextTool({ name }: { name: ToolName }) {
  const [text, setText] = useState("");
  const [sentenceLimit, setSentenceLimit] = useState(3);
  const [result, setResult] = useState<
    SentimentResult | SummaryResult | PlagiarismResult | null
  >(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const [path, description] = tools[name];
  useEffect(() => () => controllerRef.current?.abort(), []);
  async function submit() {
    if (!text.trim()) {
      setError("Paste text before running this tool.");
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const value = await runTextTool(
        path,
        text,
        sentenceLimit,
        controller.signal,
      );
      if (!controller.signal.aborted) setResult(value);
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(reason instanceof Error ? reason.message : "Request failed.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-[#ededf3] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold">{name}</h2>
        <p className="mt-2 text-xs leading-6 text-[#77768b]">{description}</p>
        <label htmlFor="tool-text" className="mt-4 block text-xs font-bold">
          Text
        </label>
        <textarea
          id="tool-text"
          maxLength={100000}
          disabled={loading}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setResult(null);
            setError("");
          }}
          className="mt-2 min-h-64 w-full rounded-lg border border-[#e6e5ee] p-3 text-sm"
          placeholder="Paste text here..."
        />
        {path === "summary" && (
          <label
            className="mt-3 flex items-center gap-3 text-xs"
            htmlFor="summary-limit"
          >
            Summary sentences
            <select
              id="summary-limit"
              value={sentenceLimit}
              disabled={loading}
              onChange={(event) => {
                setSentenceLimit(Number(event.target.value));
                setResult(null);
              }}
              className="rounded border p-2"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={loading || !text.trim()}
          onClick={submit}
          className="mt-4 rounded-lg bg-[#7357ef] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {loading ? "Processing..." : `Run ${name.toLowerCase()}`}
        </button>
      </section>
      <section className="space-y-4 rounded-xl border border-[#ededf3] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold">Result</h2>
        {!result ? (
          <p className="py-12 text-center text-sm text-[#77768b]">
            Your result will appear here.
          </p>
        ) : (
          <>
            <p className="text-xs text-[#77768b]">{result.method}</p>
            {"label" in result && (
              <>
                <strong className="block text-3xl text-violet-700">
                  {result.label}
                </strong>
                <p className="text-sm">
                  Compound score: {result.score} (-1 to +1)
                </p>
                <p className="text-xs text-[#77768b]">
                  This score measures sentiment intensity, not prediction
                  confidence.
                </p>
                {[
                  ["Positive", result.positive],
                  ["Neutral", result.neutral],
                  ["Negative", result.negative],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span>{label}</span>
                    <strong>{Math.round(Number(value) * 100)}%</strong>
                  </div>
                ))}
                {result.warnings.map((warning) => (
                  <p key={warning} className="text-xs text-amber-800">
                    {warning}
                  </p>
                ))}
              </>
            )}
            {"summary" in result && (
              <>
                <p className="text-xs text-[#77768b]">
                  Selected {result.selected_sentence_count} of{" "}
                  {result.sentence_count} sentences
                </p>
                <p className="whitespace-pre-wrap text-sm leading-7">
                  {result.summary}
                </p>
              </>
            )}
            {"match_percentage" in result && (
              <>
                <strong className="block text-3xl text-violet-700">
                  {result.match_percentage}%
                </strong>
                <p className="text-xs text-[#77768b]">
                  Highest similarity across {result.compared_documents} saved
                  documents
                </p>
                {!result.compared_documents && (
                  <p className="text-sm">
                    Analyze and save documents first to build a comparison
                    collection.
                  </p>
                )}
                {result.matches.map((match) => (
                  <div
                    key={match.document_id}
                    className="flex justify-between rounded-lg bg-violet-50 p-3 text-sm"
                  >
                    <span>{match.title}</span>
                    <strong>{match.overlap}%</strong>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
