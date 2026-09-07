"use client";

import { useEffect, useRef, useState } from "react";

import { analyzeText, getAutocomplete, getWritingFeedback } from "@/lib/api";
import type { AnalysisResult } from "@/types/analysis";

export function TextAnalyzer() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<
    Array<{ type: string; message: string }>
  >([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [apiReady, setApiReady] = useState(true);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!text.trim()) {
      setFeedback([]);
      setSuggestions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      Promise.all([getWritingFeedback(text), getAutocomplete(text)])
        .then(([writing, completion]) => {
          setApiReady(true);
          setFeedback(writing.issues);
          setSuggestions(completion.suggestions);
        })
        .catch(() => {
          setApiReady(false);
          setFeedback([]);
          setSuggestions([]);
        });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [text]);

  function applySuggestion(suggestion: string) {
    const textarea = textRef.current;
    const cursor = textarea?.selectionStart ?? text.length;
    const before = text.slice(0, cursor);
    const after = text.slice(cursor);
    setText(
      `${before}${before && !before.endsWith(" ") ? " " : ""}${suggestion} ${after}`,
    );
    window.requestAnimationFrame(() => textarea?.focus());
  }

  async function submit() {
    if (!text.trim()) {
      setError("Enter some text before starting the analysis.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setResult(await analyzeText(text, title));
      setApiReady(true);
    } catch (requestError) {
      setApiReady(false);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Analysis failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
      <section className="rounded-[11px] border border-[#ededf3] bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-bold">Analyze text</h2>
            <p className="mt-1 text-[11px] text-[#aaa9b8]">
              Connected to the FastAPI and spaCy analysis service.
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-1 text-[10px] ${apiReady ? "bg-[#e9f8f0] text-[#39b778]" : "bg-red-50 text-red-600"}`}
          >
            {apiReady ? "API ready" : "API offline"}
          </span>
        </div>
        <label
          className="mt-5 block text-[11px] font-bold text-[#77768b]"
          htmlFor="analysis-title"
        >
          Title
        </label>
        <input
          className="mt-2 w-full rounded-lg border border-[#e6e5ee] p-3 text-xs outline-none focus:border-[#7357ef]"
          id="analysis-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Product feedback"
        />
        <label
          className="mt-5 block text-[11px] font-bold text-[#77768b]"
          htmlFor="analysis-text"
        >
          Text
        </label>
        <textarea
          ref={textRef}
          className="mt-2 min-h-[210px] w-full resize-y rounded-lg border border-[#e6e5ee] p-3 text-xs outline-none focus:border-[#7357ef]"
          id="analysis-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste a paragraph to discover words, sentences, and entities..."
        />
        {!text.trim() && (
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              ["NER", "Entities", "Names, dates, places, and organizations"],
              ["Grammar", "Writing feedback", "Typos, structure, and style"],
              ["Autocomplete", "Predictive text", "Context-aware completions"],
            ].map(([shortName, title, description]) => (
              <div className="rounded-lg bg-[#f8f7fd] p-3" key={shortName}>
                <span className="text-[9px] font-bold uppercase tracking-wide text-[#7357ef]">
                  {shortName}
                </span>
                <strong className="mt-1 block text-[11px]">{title}</strong>
                <p className="mt-1 text-[10px] leading-4 text-[#9998aa]">
                  {description}
                </p>
              </div>
            ))}
          </div>
        )}
        {text.trim() && (
          <div className="mt-4 rounded-lg border border-[#eeeafc] bg-[#fbfaff] p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-[#7357ef]">
                Writing assistant
              </p>
              <span className="text-[10px] text-[#9998aa]">
                {feedback.length
                  ? `${feedback.length} suggestion${feedback.length === 1 ? "" : "s"}`
                  : "No issues found"}
              </span>
            </div>
            {feedback.length > 0 && (
              <div className="mt-2 space-y-1">
                {feedback.map((issue, index) => (
                  <p
                    className="text-[11px] text-[#77768b]"
                    key={`${issue.message}-${index}`}
                  >
                    <span className="mr-1 rounded bg-[#fff1df] px-1 text-[9px] uppercase text-[#b87920]">
                      {issue.type}
                    </span>
                    {issue.message}
                  </p>
                ))}
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    type="button"
                    className="rounded-full border border-[#ddd7ff] bg-white px-2.5 py-1.5 text-[10px] text-[#7357ef] hover:bg-[#f0edff]"
                    key={suggestion}
                    onClick={() => applySuggestion(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {error && <p className="text-[11px] text-[#d95757]">{error}</p>}
        <button
          type="button"
          className="mt-5 rounded-lg bg-[#7357ef] px-4 py-3 text-xs font-bold text-white disabled:opacity-60"
          onClick={submit}
          disabled={loading}
        >
          {loading ? "Analyzing..." : "Analyze text"}
        </button>
      </section>
      <section className="rounded-[11px] border border-[#ededf3] bg-white p-5 shadow-sm">
        <h2 className="mb-6 text-sm font-bold">Analysis results</h2>
        {!result ? (
          <div className="p-11 text-center text-xs leading-7 text-[#aaa9b8]">
            Your word count, sentence count, tokens, and entities will appear
            here.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Words", result.word_count],
                ["Sentences", result.sentence_count],
                ["Entities", result.entities.length],
              ].map(([label, value]) => (
                <div
                  className="rounded-lg bg-[#f8f7fd] p-3 text-center"
                  key={label}
                >
                  <strong className="block text-xl text-[#7357ef]">
                    {value}
                  </strong>
                  <span className="text-[10px] text-[#9998aa]">{label}</span>
                </div>
              ))}
            </div>
            <h3 className="my-4 text-xs font-bold">
              Named Entity Recognition (NER)
            </h3>
            {result.entities.length ? (
              result.entities.map((entity) => (
                <div
                  className="flex items-center justify-between border-b border-[#f0eff4] py-3 text-xs"
                  key={`${entity.start}-${entity.end}`}
                >
                  <strong>{entity.text}</strong>
                  <span className="text-[10px] text-[#7357ef]">
                    {entity.label}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-5 text-center text-xs text-[#aaa9b8]">
                No named entities found.
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
