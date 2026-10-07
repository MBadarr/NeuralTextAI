"use client";

import { useEffect, useRef, useState } from "react";
import { AnalysisResults } from "@/components/AnalysisResults";
import {
  analyzeText,
  getAutocomplete,
  getHealth,
  getWritingFeedback,
} from "@/lib/api";
import type { AnalysisResult, WritingIssue } from "@/types/analysis";

export function TextAnalyzer() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
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
    if (!text.trim()) {
      setFeedbackStatus("idle");
      return () => controller.abort();
    }
    setFeedbackStatus("checking");
    const timer = window.setTimeout(() => {
      Promise.all([
        getWritingFeedback(text, controller.signal),
        getAutocomplete(text, controller.signal),
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
  }, [text]);

  function changeText(value: string) {
    setText(value);
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
    changeText(`${before}${separator}${suggestion} ${text.slice(cursor)}`);
    window.requestAnimationFrame(() => textRef.current?.focus());
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
      <section className="rounded-xl border border-[#ededf3] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold">Analyze and improve text</h2>
          <span className="rounded-full bg-[#f0edff] px-2 py-1 text-xs text-[#7357ef]">
            {apiStatus}
          </span>
        </div>
        <label
          htmlFor="analysis-title"
          className="mt-5 block text-xs font-bold"
        >
          Title
        </label>
        <input
          id="analysis-title"
          maxLength={120}
          disabled={loading}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-2 w-full rounded-lg border border-[#e6e5ee] p-3 text-sm"
          placeholder="Product feedback"
        />
        <label htmlFor="analysis-text" className="mt-5 block text-xs font-bold">
          Text
        </label>
        <textarea
          ref={textRef}
          id="analysis-text"
          maxLength={100000}
          disabled={loading}
          value={text}
          onChange={(event) => changeText(event.target.value)}
          className="mt-2 min-h-72 w-full rounded-lg border border-[#e6e5ee] p-3 text-sm leading-6"
          placeholder="Paste text to explore entities, grammar, sentiment, keywords and more…"
        />
        <div className="mt-2 flex justify-between text-xs text-[#77768b]">
          <span>{text.length.toLocaleString()} / 100,000 characters</span>
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              changeText(
                "Microsoft announced a new research office in London. The team builds helpful language tools. I love the excellent results, but the setup was difficult.",
              )
            }
            className="text-[#7357ef]"
          >
            Try example
          </button>
        </div>
        {text.trim() && (
          <div className="mt-4 space-y-3 rounded-lg bg-[#fbfaff] p-3">
            <div className="flex justify-between text-xs">
              <strong>Writing feedback</strong>
              <span>
                {feedbackStatus === "checking"
                  ? "Checking…"
                  : feedbackStatus === "unavailable"
                    ? "Unavailable"
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
                  <span className="mr-1 text-violet-700">{issue.type}</span>
                  {issue.message}
                </p>
                {issue.replacement !== null && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => applyCorrection(issue)}
                    className="shrink-0 font-bold text-[#7357ef]"
                  >
                    Apply
                  </button>
                )}
              </div>
            ))}
            {warnings.map((warning) => (
              <p key={warning} className="text-xs text-amber-800">
                {warning}
              </p>
            ))}
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  disabled={loading}
                  onClick={() => applySuggestion(suggestion)}
                  className="rounded-full border border-violet-200 px-3 py-2 text-xs text-violet-700"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            {!suggestions.length && feedbackStatus === "ready" && (
              <p className="text-xs text-[#77768b]">
                Analyze documents to build a workspace vocabulary for completion
                suggestions.
              </p>
            )}
          </div>
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
          className="mt-5 rounded-lg bg-[#7357ef] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {loading ? "Analyzing…" : "Analyze and save"}
        </button>
      </section>
      <section className="rounded-xl border border-[#ededf3] bg-white p-5 shadow-sm">
        {result ? (
          <AnalysisResults key={result.id} result={result} />
        ) : (
          <p className="py-16 text-center text-sm text-[#77768b]">
            Analyze text to view entities, tokens, keywords, readability,
            sentiment and a summary.
          </p>
        )}
      </section>
    </div>
  );
}
