"use client";

import { useState } from "react";
import type { EntityResult } from "@/features/analysis/types/analysis";
import { Button } from "@/ui/Button";

export function EntityResults({ result }: { result: EntityResult }) {
  const [filter, setFilter] = useState("All");
  const characters = Array.from(result.text);
  const segments = [];
  let cursor = 0;
  for (const entity of result.entities) {
    segments.push(
      <span key={`text-${cursor}`}>
        {characters.slice(cursor, entity.start).join("")}
      </span>,
    );
    segments.push(
      <mark
        key={`entity-${entity.start}`}
        title={entity.label}
        className={
          filter === "All" || filter === entity.label
            ? "rounded bg-workspace-highlight px-1"
            : "bg-transparent text-workspace-muted"
        }
      >
        {entity.text}
        <small className="ml-1 text-workspace-accent">{entity.label}</small>
      </mark>,
    );
    cursor = entity.end;
  }
  segments.push(
    <span key={`text-${cursor}`}>{characters.slice(cursor).join("")}</span>,
  );
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold">Recognized entities</h2>
      <p className="text-xs text-workspace-muted">
        {result.entities.length} mentions · {Object.keys(result.counts).length}{" "}
        types · {result.model}
      </p>
      {result.warnings.map((warning) => (
        <p key={warning} className="text-xs text-workspace-warning">
          {warning}
        </p>
      ))}
      <fieldset
        className="flex flex-wrap gap-2"
        aria-label="Filter entity types"
      >
        {["All", ...Object.keys(result.counts)].map((label) => (
          <Button
            type="button"
            key={label}
            aria-pressed={filter === label}
            onClick={() => setFilter(label)}
            className="rounded-lg bg-workspace-accent-soft px-3 py-2 text-xs text-workspace-accent"
          >
            {label}
            {label !== "All" && ` (${result.counts[label]})`}
          </Button>
        ))}
      </fieldset>
      <p className="max-h-80 overflow-auto whitespace-pre-wrap text-sm leading-8">
        {segments}
      </p>
      {!result.entities.length && (
        <p className="text-xs text-workspace-muted">
          No entities detected. Try a passage containing people, organizations,
          places, or dates.
        </p>
      )}
      {!!result.entities.length && (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                <th className="p-2">Mention</th>
                <th className="p-2">Type</th>
                <th className="p-2">Character span</th>
              </tr>
            </thead>
            <tbody>
              {result.entities
                .filter((entity) => filter === "All" || entity.label === filter)
                .map((entity) => (
                  <tr
                    key={`${entity.start}-${entity.end}`}
                    className="border-t border-workspace-border"
                  >
                    <td className="p-2">{entity.text}</td>
                    <td className="p-2">{entity.label}</td>
                    <td className="p-2">
                      {entity.start}–{entity.end}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
