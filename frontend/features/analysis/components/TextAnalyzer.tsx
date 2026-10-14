"use client";

import { useEffect, useRef, useState } from "react";
import {
  analyzeText,
  getAutocomplete,
  getEntities,
  getWritingFeedback,
} from "@/features/analysis/api/analysis-api";
import { AnalysisResults } from "@/features/analysis/components/AnalysisResults";
import { EntityResults } from "@/features/analysis/components/EntityResults";
import { WritingResults } from "@/features/analysis/components/WritingResults";
import type {
  AnalysisResult,
  EntityResult,
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
  "Named entity recognition": "Find entities",
  "Keyword extraction": "Extract keywords and save",
  Readability: "Assess readability and save",
};
const featureMessages: Record<string, string> = {
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
  const checksWriting = feature === "Writing assistant";
  const completesText = feature === "Predictive text";
  const isLiveTool = checksWriting || completesText;
  const isEntityTool = feature === "Named entity recognition";
  const resultTab =
    feature === "Keyword extraction"
      ? "Keywords"
      : feature === "Readability"
        ? "Readability"
        : "Tokens";
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [cursor, setCursor] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [entityResult, setEntityResult] = useState<EntityResult | null>(null);
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
  const completionContext = completesText ? text.slice(0, cursor) : "";

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
    setSource("");
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
        completesText && completionContext.trim()
          ? getAutocomplete(completionContext, controller.signal)
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
  }, [text, completionContext, loading, checksWriting, completesText]);

  function changeText(value: string, position = value.length) {
    setText(value);
    setCursor(position);
    setResult(null);
    setEntityResult(null);
    setFeedback([]);
    setSuggestions([]);
    setFeedbackStatus("checking");
    setError("");
  }
  function applyCorrection(issue: WritingIssue) {
    if (issue.replacement === null) return;
    const characters = Array.from(text);
    const corrected =
      characters.slice(0, issue.start).join("") +
      issue.replacement +
      characters.slice(issue.end).join("");
    if (corrected.length > 100000) {
      setError("This correction would exceed the 100,000-character limit.");
      return;
    }
    changeText(corrected);
    textRef.current?.focus();
  }
  function applySuggestion(suggestion: string) {
    const cursor = textRef.current?.selectionStart ?? text.length;
    let before = text.slice(0, cursor);
    if (source.endsWith("prefix")) before = before.replace(/[\w']+$/, "");
    const separator =
      before && !/\s$/.test(before) && !source.endsWith("prefix") ? " " : "";
    const after = source.endsWith("prefix")
      ? text.slice(cursor).replace(/^[\w']+/, "")
      : text.slice(cursor);
    const insertion = `${before}${separator}${suggestion}${/^[\s.,;:!?]/.test(after) ? "" : " "}`;
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
    setEntityResult(null);
    try {
      if (isEntityTool) {
        const entities = await getEntities(text, controller.signal);
        if (!controller.signal.aborted) setEntityResult(entities);
        return;
      }
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
        {!isLiveTool && !isEntityTool && (
          <>
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
          </>
        )}
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
                checksWriting
                  ? "this is teh draft. She are writing writing a report ."
                  : completesText
                    ? "We build language tools. We build "
                    : "Microsoft announced a new research office in London. The team builds helpful language tools. I love the excellent results, but the setup was difficult.",
              )
            }
            className="text-workspace-accent"
          >
            Try example
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-xs text-workspace-danger">
            {error}
          </p>
        )}
        {!isLiveTool && (
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
        )}
      </section>
      <section className="rounded-xl border border-workspace-border bg-workspace-surface p-5 shadow-sm">
        {isLiveTool ? (
          <WritingResults
            text={text}
            predictive={completesText}
            status={feedbackStatus}
            issues={feedback}
            suggestions={suggestions}
            source={source}
            warnings={warnings}
            applyCorrection={applyCorrection}
            applySuggestion={applySuggestion}
          />
        ) : entityResult ? (
          <EntityResults key={entityResult.text} result={entityResult} />
        ) : result ? (
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
