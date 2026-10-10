"use client";

import { useEffect, useRef, useState } from "react";
import {
  analyzeText,
  getAutocomplete,
  getWritingFeedback,
} from "@/features/analysis/api/analysis-api";
import { AnalysisResults } from "@/features/analysis/components/AnalysisResults";
import type {
  AnalysisResult,
  WritingIssue,
} from "@/features/analysis/types/analysis";
import { getHealth } from "@/features/workspace/api/workspace-api";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { Textarea } from "@/ui/Textarea";

const textPlaceholders: Record<string, string> = {
  "Text analyzer":
    "Paste text to analyze language, entities, sentiment, keywords, and readability…",
  "Named entity recognition":
    "Paste text to identify people, organizations, places, dates, and other entities…",
  "Writing assistant":
    "Paste your draft to check spelling, grammar, and writing style…",
  "Predictive text":
    "Start typing to see word and phrase suggestions as you write…",
  "Keyword extraction":
    "Paste text to extract keywords and frequently used terms…",
  Readability:
    "Paste your draft to assess reading difficulty and sentence length…",
};

const featureActions: Record<string, string> = {
  "Writing assistant": "Save draft and analysis",
  "Predictive text": "Save draft and analysis",
  "Named entity recognition": "Find entities and save",
  "Keyword extraction": "Extract keywords and save",
  Readability: "Assess readability and save",
};
const featureMessages: Record<string, string> = {
  "Writing assistant":
    "Start writing to receive spelling and style feedback. Save your draft to keep its analysis.",
  "Predictive text":
    "Start typing to receive completion suggestions. Select a suggestion to insert it into your text.",
  "Keyword extraction":
    "Extract keywords to view key terms, noun phrases, and word frequencies.",
  Readability:
    "Assess your text to view reading difficulty and sentence statistics.",
  "Named entity recognition":
    "Find entities to highlight people, organizations, places, and dates.",
  "Text analyzer":
    "Analyze text to view entities, tokens, keywords, readability, sentiment, and a summary.",
};

export function TextAnalyzer({
  feature = "Text analyzer",
}: {
  feature?: string;
}) {
  const checksWriting =
    feature === "Text analyzer" || feature === "Writing assistant";
  const completesText =
    feature === "Text analyzer" || feature === "Predictive text";
  const resultTab =
    feature === "Keyword extraction"
      ? "Keywords"
      : feature === "Readability"
        ? "Readability"
        : "Entities";
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [cursor, setCursor] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<WritingIssue[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [source, setSource] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [feedbackStatus, setFeedbackStatus] = useState("idle");
  const [apiStatus, setApiStatus] = useState("Checking API");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const analysisController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then((health) =>
        setApiStatus(health.trained ? "API ready" : "Limited NLP model"),
      )
      .catch((reason) => {
        if (reason.name !== "AbortError") setApiStatus("API offline");
      });
    return () => {
      controller.abort();
      analysisController.current?.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setFeedback([]);
    setSuggestions([]);
    setWarnings([]);
    if (!text.trim() || loading || (!checksWriting && !completesText)) {
      setFeedbackStatus("idle");
      return () => controller.abort();
    }
    setFeedbackStatus("checking");
    const timer = window.setTimeout(() => {
      Promise.all([
        checksWriting
          ? getWritingFeedback(text, controller.signal)
          : Promise.resolve({ issues: [], warnings: [] }),
        completesText
          ? getAutocomplete(text.slice(0, cursor), controller.signal)
          : Promise.resolve({ suggestions: [], source: "" }),
      ])
        .then(([writing, completion]) => {
          if (controller.signal.aborted) return;
          setFeedback(writing.issues);
          setSuggestions(completion.suggestions);
          setSource(completion.source);
          setWarnings(writing.warnings);
          setFeedbackStatus("ready");
        })
        .catch((reason) => {
          if (!controller.signal.aborted) {
            setFeedbackStatus("unavailable");
            setWarnings([reason.message]);
          }
        });
    }, 450);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [text, cursor, loading, checksWriting, completesText]);

  function changeText(value: string, position = value.length) {
    setText(value);
    setCursor(position);
    setResult(null);
    setError("");
  }
  function applyCorrection(issue: WritingIssue) {
    if (issue.replacement === null) return;
    const characters = Array.from(text);
    changeText(
      characters.slice(0, issue.start).join("") +
        issue.replacement +
        characters.slice(issue.end).join(""),
    );
    textRef.current?.focus();
  }
  function applySuggestion(suggestion: string) {
    const cursor = textRef.current?.selectionStart ?? text.length;
    let before = text.slice(0, cursor);
    if (source === "dictionary prefix") before = before.replace(/[\w']+$/, "");
    const separator =
      before && !/\s$/.test(before) && source !== "dictionary prefix"
        ? " "
        : "";
    const after =
      source === "dictionary prefix"
        ? text.slice(cursor).replace(/^[\w']+/, "")
        : text.slice(cursor);
    const insertion = `${before}${separator}${suggestion}${/^\s/.test(after) ? "" : " "}`;
    if (insertion.length + after.length > 100000) {
      setError("This suggestion would exceed the 100,000-character limit.");
      return;
    }
    changeText(`${insertion}${after}`, insertion.length);
    window.requestAnimationFrame(() => {
      textRef.current?.focus();
      textRef.current?.setSelectionRange(insertion.length, insertion.length);
    });
  }
  async function submit() {
    if (!text.trim()) {
      setError("Enter text before analyzing.");
      return;
    }
    const controller = new AbortController();
    analysisController.current = controller;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const analysis = await analyzeText(text, title, controller.signal);
      if (!controller.signal.aborted) {
        setResult(analysis);
        setApiStatus(
          analysis.model === "en_blank" ? "Limited NLP model" : "API ready",
        );
      }
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(reason instanceof Error ? reason.message : "Analysis failed.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <section className="rounded-xl border border-workspace-border bg-workspace-surface p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold">{feature}</h2>
          <span className="rounded-full bg-workspace-accent-soft px-2 py-1 text-xs text-workspace-accent">
            {apiStatus}
          </span>
        </div>
        <label
          htmlFor="analysis-title"
          className="mt-5 block text-xs font-bold"
        >
          Title
        </label>
        <Input
          id="analysis-title"
          maxLength={120}
          disabled={loading}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-2 w-full rounded-lg border border-workspace-border p-3 text-sm"
          placeholder="Add an optional document title…"
        />
        <label htmlFor="analysis-text" className="mt-5 block text-xs font-bold">
          Text
        </label>
        <Textarea
          ref={textRef}
          id="analysis-text"
          maxLength={100000}
          disabled={loading}
          value={text}
          onChange={(event) =>
            changeText(event.target.value, event.target.selectionStart)
          }
          onSelect={(event) => setCursor(event.currentTarget.selectionStart)}
          className="mt-2 min-h-72 w-full rounded-lg border border-workspace-border p-3 text-sm leading-6"
          placeholder={
            textPlaceholders[feature] ?? textPlaceholders["Text analyzer"]
          }
        />
        <div className="mt-2 flex justify-between text-xs text-workspace-muted">
          <span>{text.length.toLocaleString()} / 100,000 characters</span>
          <Button
            type="button"
            disabled={loading}
            onClick={() =>
              changeText(
                "Microsoft announced a new research office in London. The team builds helpful language tools. I love the excellent results, but the setup was difficult.",
              )
            }
            className="text-workspace-accent"
          >
            Try example
          </Button>
        </div>
        {text.trim() && (checksWriting || completesText) && (
          <div className="mt-4 space-y-3 rounded-lg bg-workspace-subtle p-3">
            <div className="flex justify-between text-xs">
              <strong>
                {checksWriting ? "Writing feedback" : "Completion suggestions"}
              </strong>
              <span>
                {feedbackStatus === "checking"
                  ? "Checking…"
                  : feedbackStatus === "unavailable"
                    ? "Unavailable"
                    : !checksWriting
                      ? `${suggestions.length} suggestions`
                      : feedback.length
                        ? `${feedback.length} suggestions`
                        : "No issues detected"}
              </span>
            </div>
            {feedback.map((issue) => (
              <div
                key={`${issue.start}-${issue.end}-${issue.message}`}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <p>
                  <span className="mr-1 text-workspace-accent">
                    {issue.type}
                  </span>
                  {issue.message}
                </p>
                {issue.replacement !== null && (
                  <Button
                    type="button"
                    disabled={loading}
                    onClick={() => applyCorrection(issue)}
                    className="shrink-0 font-bold text-workspace-accent"
                  >
                    Apply
                  </Button>
                )}
              </div>
            ))}
            {warnings.map((warning) => (
              <p key={warning} className="text-xs text-workspace-warning">
                {warning}
              </p>
            ))}
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <Button
                  type="button"
                  key={suggestion}
                  disabled={loading}
                  onClick={() => applySuggestion(suggestion)}
                  className="rounded-full border border-workspace-accent-border px-3 py-2 text-xs text-workspace-accent"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
            {completesText &&
              !suggestions.length &&
              feedbackStatus === "ready" && (
                <p className="text-xs text-workspace-muted">
                  Analyze documents to build a workspace vocabulary for
                  completion suggestions.
                </p>
              )}
          </div>
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
          className="mt-5 rounded-lg bg-workspace-primary px-4 py-3 text-sm font-bold text-workspace-on-primary disabled:opacity-50"
        >
          {loading
            ? "Analyzing…"
            : (featureActions[feature] ?? "Analyze and save")}
        </Button>
      </section>
      <section className="rounded-xl border border-workspace-border bg-workspace-surface p-5 shadow-sm">
        {result ? (
          <AnalysisResults
            key={result.id}
            result={result}
            initialTab={resultTab}
          />
        ) : (
          <p className="py-16 text-center text-sm text-workspace-muted">
            {featureMessages[feature] ?? featureMessages["Text analyzer"]}
          </p>
        )}
      </section>
    </div>
  );
}
