"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/types/analysis";

export function AnalysisResults({ result }: { result: AnalysisResult }) {
  const [tab, setTab] = useState("Entities");
  const characters = Array.from(result.text);
  function exportResult() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `analysis-${result.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  const segments: Array<{ text: string; label?: string; key: string }> = [];
  let cursor = 0;
  for (const entity of [...result.entities].sort((a, b) => a.start - b.start)) {
    if (entity.start < cursor) continue;
    if (entity.start > cursor)
      segments.push({
        text: characters.slice(cursor, entity.start).join(""),
        key: `text-${cursor}`,
      });
    segments.push({
      text: characters.slice(entity.start, entity.end).join(""),
      label: entity.label,
      key: `entity-${entity.start}`,
    });
    cursor = entity.end;
  }
  segments.push({
    text: characters.slice(cursor).join(""),
    key: `text-${cursor}`,
  });
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">{result.title}</h2>
        <button
          type="button"
          onClick={exportResult}
          className="text-xs font-bold text-[#7357ef]"
        >
          Export JSON
        </button>
      </div>
      {result.warnings.map((warning) => (
        <p
          key={warning}
          className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800"
        >
          {warning}
        </p>
      ))}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          ["Words", result.word_count],
          ["Sentences", result.sentence_count],
          ["Entities", result.entities.length],
          ["Unique words", result.unique_word_count],
          ["Reading (min)", result.reading_time_minutes],
          ["Characters", result.character_count],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-[#f8f7fd] p-3 text-center">
            <strong className="block text-lg text-[#7357ef]">{value}</strong>
            <span className="text-xs text-[#77768b]">{label}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-[#77768b]">
        Language:{" "}
        {result.language === "und"
          ? "Not enough text to detect"
          : result.language.toUpperCase()}{" "}
        · {result.processing_time_ms} ms
      </p>
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Analysis details"
      >
        {["Entities", "Tokens", "Keywords", "Readability", "Summary"].map(
          (name) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === name}
              key={name}
              onClick={() => setTab(name)}
              className={`rounded-lg px-3 py-2 text-xs ${tab === name ? "bg-[#7357ef] text-white" : "bg-[#f8f7fd] text-[#77768b]"}`}
            >
              {name}
            </button>
          ),
        )}
      </div>
      <div role="tabpanel">
        {tab === "Entities" && (
          <div className="space-y-4">
            <p className="max-h-80 overflow-auto whitespace-pre-wrap text-sm leading-8">
              {segments.map((segment) =>
                segment.label ? (
                  <mark
                    key={segment.key}
                    title={segment.label}
                    className="rounded bg-violet-100 px-1"
                  >
                    {segment.text}
                    <small className="ml-1 text-violet-700">
                      {segment.label}
                    </small>
                  </mark>
                ) : (
                  <span key={segment.key}>{segment.text}</span>
                ),
              )}
            </p>
            {!result.entities.length && (
              <p className="text-xs text-[#77768b]">No entities detected.</p>
            )}
          </div>
        )}
        {tab === "Tokens" && (
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  {[
                    "Token",
                    "Lemma",
                    "POS",
                    "Dependency",
                    "Head",
                    "Stop word",
                  ].map((label) => (
                    <th key={label} className="p-2">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.tokens.map((token) => (
                  <tr
                    key={`${token.start}-${token.end}`}
                    className="border-t border-[#ededf3]"
                  >
                    <td className="p-2">{token.text}</td>
                    <td className="p-2">{token.lemma}</td>
                    <td className="p-2">{token.part_of_speech}</td>
                    <td className="p-2">{token.dependency}</td>
                    <td className="p-2">{token.head}</td>
                    <td className="p-2">{token.is_stop ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === "Keywords" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold">Key terms</h3>
            <div className="flex flex-wrap gap-2">
              {result.keywords.map((keyword) => (
                <span
                  key={keyword.text}
                  className="rounded-full bg-violet-50 px-3 py-2 text-xs text-violet-700"
                >
                  {keyword.text}
                </span>
              ))}
            </div>
            <h3 className="text-sm font-bold">Noun phrases</h3>
            <p className="text-xs leading-6">
              {result.noun_phrases.join(" · ") || "No noun phrases available."}
            </p>
            <h3 className="text-sm font-bold">Word frequencies</h3>
            {result.word_frequencies.map((item) => (
              <div key={item.word} className="flex justify-between text-xs">
                <span>{item.word}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        )}
        {tab === "Readability" && (
          <div className="space-y-3">
            {result.readability ? (
              <>
                {Object.entries(result.readability).map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between gap-3 text-sm"
                  >
                    <span>{label.replaceAll("_", " ")}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
                <p className="text-xs text-[#77768b]">
                  English readability estimates use syllable patterns. Higher
                  Flesch ease means easier reading; grade approximates a US
                  school grade.
                </p>
              </>
            ) : (
              <p className="text-xs">
                Readability is available for English text.
              </p>
            )}
            <p className="text-sm">
              Sentiment: <strong>{result.sentiment.label}</strong> · Compound
              score {result.sentiment.score}
            </p>
          </div>
        )}
        {tab === "Summary" && (
          <p className="text-sm leading-7">
            {result.summary || "No summary available."}
          </p>
        )}
      </div>
    </div>
  );
}
