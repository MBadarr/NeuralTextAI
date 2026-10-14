"use client";

import { useEffect, useRef, useState } from "react";
import { runTextTool } from "@/features/analysis/api/analysis-api";
import { ClassificationResults } from "@/features/analysis/components/ClassificationResults";
import type {
  ClassificationResult,
  PlagiarismResult,
  SentimentResult,
  SummaryResult,
} from "@/features/analysis/types/analysis";
import { Button } from "@/ui/Button";
import { Select } from "@/ui/Select";
import { Textarea } from "@/ui/Textarea";

const tools = {
  "Intent analysis": [
    "intent",
    "Identify sentence-level questions, requests, complaints, appreciation, and statements.",
    "Paste a message to identify questions, requests, complaints, or appreciation…",
  ],
  "Emotion analysis": [
    "emotions",
    "Find English emotion evidence for joy, anger, sadness, fear, surprise, and disgust.",
    "Paste text to look for joy, anger, sadness, fear, surprise, or disgust…",
  ],
  "Sentiment analysis": [
    "sentiment",
    "Analyze English sentiment, including negation and emphasis.",
    "Paste a review, comment, or message to analyze its positive, negative, or neutral tone…",
  ],
  "Text summary": [
    "summary",
    "Rank sentences by relevance and preserve their original order.",
    "Paste an article or longer passage to create a shorter summary…",
  ],
  "Plagiarism check": [
    "plagiarism",
    "Compare wording with saved workspace documents. Similarity alone does not prove plagiarism.",
    "Paste text to compare its wording with your saved workspace documents…",
  ],
} as const;
export type ToolName = keyof typeof tools;

export function TextTool({ name }: { name: ToolName }) {
  const [text, setText] = useState("");
  const [sentenceLimit, setSentenceLimit] = useState(3);
  const [result, setResult] = useState<
    | SentimentResult
    | ClassificationResult
    | SummaryResult
    | PlagiarismResult
    | null
  >(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const [path, description, placeholder] = tools[name];
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
      <section className="rounded-xl border border-workspace-border bg-workspace-surface p-5 shadow-sm">
        <h2 className="text-sm font-bold">{name}</h2>
        <p className="mt-2 text-xs leading-6 text-workspace-muted">
          {description}
        </p>
        <label htmlFor="tool-text" className="mt-4 block text-xs font-bold">
          Text
        </label>
        <Textarea
          id="tool-text"
          maxLength={100000}
          disabled={loading}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setResult(null);
            setError("");
          }}
          className="mt-2 min-h-64 w-full rounded-lg border border-workspace-border p-3 text-sm"
          placeholder={placeholder}
        />
        {path === "summary" && (
          <label
            className="mt-3 flex items-center gap-3 text-xs"
            htmlFor="summary-limit"
          >
            Summary sentences
            <Select
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
            </Select>
          </label>
        )}
        {error && (
          <p role="alert" className="mt-3 text-xs text-workspace-danger">
            {error}
          </p>
        )}
        <Button
          type="button"
          disabled={loading || !text.trim()}
          onClick={submit}
          className="mt-4 rounded-lg bg-workspace-primary px-4 py-3 text-sm font-bold text-workspace-on-primary disabled:opacity-50"
        >
          {loading ? "Processing..." : `Run ${name.toLowerCase()}`}
        </Button>
      </section>
      <section className="space-y-4 rounded-xl border border-workspace-border bg-workspace-surface p-5 shadow-sm">
        <h2 className="text-sm font-bold">Result</h2>
        {!result ? (
          <p className="py-12 text-center text-sm text-workspace-muted">
            Your result will appear here.
          </p>
        ) : (
          <>
            <p className="text-xs text-workspace-muted">{result.method}</p>
            {"sentences" in result && (
              <ClassificationResults
                result={result}
                kind={path === "intent" ? "Intent" : "Emotion"}
              />
            )}
            {"positive" in result && (
              <>
                <strong className="block text-3xl text-workspace-accent">
                  {result.label}
                </strong>
                {result.label === "Uncertain" && (
                  <p className="text-sm text-workspace-warning">
                    The text contains conflicting cues. The lexical score below
                    does not establish its overall tone.
                  </p>
                )}
                {result.label !== "Unsupported" && (
                  <>
                    <p className="text-sm">
                      Lexical compound score: {result.score} (-1 to +1)
                    </p>
                    <p className="text-xs text-workspace-muted">
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
                  </>
                )}
                {result.warnings.map((warning) => (
                  <p key={warning} className="text-xs text-workspace-warning">
                    {warning}
                  </p>
                ))}
                {result.emotions && (
                  <ClassificationResults
                    result={result.emotions}
                    kind="Emotion"
                  />
                )}
              </>
            )}
            {"summary" in result && (
              <>
                <p className="text-xs text-workspace-muted">
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
                <strong className="block text-3xl text-workspace-accent">
                  {result.match_percentage}%
                </strong>
                <p className="text-xs text-workspace-muted">
                  Highest similarity across {result.compared_documents} saved
                  documents
                </p>
                <p className="text-xs text-workspace-muted">
                  The list shows documents with at least 20% lexical similarity.
                  The highest score includes lower similarities.
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
                    className="flex justify-between rounded-lg bg-workspace-accent-soft p-3 text-sm"
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
