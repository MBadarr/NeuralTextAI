"use client";

import { useState } from "react";
import { ClassificationResults } from "@/features/analysis/components/ClassificationResults";
import type { AnalysisResult } from "@/features/analysis/types/analysis";
import { Button } from "@/ui/Button";

export function AnalysisResults({
  result,
  initialTab = "Entities",
}: {
  result: AnalysisResult;
  initialTab?: "Entities" | "Tokens" | "Keywords" | "Readability";
}) {
  const [tab, setTab] = useState<string>(initialTab);
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
        <Button
          type="button"
          onClick={exportResult}
          className="text-xs font-bold text-workspace-accent"
        >
          Export JSON
        </Button>
      </div>
      {result.warnings.map((warning) => (
        <p
          key={warning}
          className="rounded-lg bg-workspace-warning-soft p-3 text-xs text-workspace-warning"
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
          <div
            key={label}
            className="rounded-lg bg-workspace-subtle p-3 text-center"
          >
            <strong className="block text-lg text-workspace-accent">
              {value}
            </strong>
            <span className="text-xs text-workspace-muted">{label}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-workspace-muted">
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
        {[
          "Entities",
          "Tokens",
          "Intent",
          "Emotions",
          "Keywords",
          "Readability",
          "Summary",
        ].map((name) => (
          <Button
            type="button"
            role="tab"
            aria-selected={tab === name}
            key={name}
            onClick={() => setTab(name)}
            className={`rounded-lg px-3 py-2 text-xs ${tab === name ? "bg-workspace-primary text-workspace-on-primary" : "bg-workspace-subtle text-workspace-muted"}`}
          >
            {name}
          </Button>
        ))}
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
                    className="rounded bg-workspace-highlight px-1"
                  >
                    {segment.text}
                    <small className="ml-1 text-workspace-accent">
                      {segment.label}
                    </small>
                  </mark>
                ) : (
                  <span key={segment.key}>{segment.text}</span>
                ),
              )}
            </p>
            {!result.entities.length && (
              <p className="text-xs text-workspace-muted">
                No entities detected.
              </p>
            )}
          </div>
        )}
        {tab === "Tokens" && (
          <div className="max-h-96 overflow-auto">
            <p className="mb-3 text-xs text-workspace-muted">
              Lemmas are dictionary base forms. Snowball stems group word
              variants and may not be dictionary words.
            </p>
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  {[
                    "Token",
                    "Lemma",
                    "Stem",
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
                    className="border-t border-workspace-border"
                  >
                    <td className="p-2">{token.text}</td>
                    <td className="p-2">{token.lemma || "Unavailable"}</td>
                    <td className="p-2">{token.stem || "—"}</td>
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
                  className="rounded-full bg-workspace-accent-soft px-3 py-2 text-xs text-workspace-accent"
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
        {tab === "Intent" && (
          <ClassificationResults result={result.intent} kind="Intent" />
        )}
        {tab === "Emotions" && (
          <ClassificationResults result={result.emotions} kind="Emotion" />
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
                <p className="text-xs text-workspace-muted">
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
              Sentiment: <strong>{result.sentiment.label}</strong>
              {result.sentiment.label !== "Unsupported" && (
                <> · Lexical compound score {result.sentiment.score}</>
              )}
            </p>
            {result.sentiment.label === "Uncertain" && (
              <p className="text-xs text-workspace-warning">
                Conflicting cues prevent a reliable polarity assignment.
              </p>
            )}
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
