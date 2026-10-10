import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TextAnalyzer } from "@/features/analysis/components/TextAnalyzer";
import type { AnalysisResult } from "@/features/analysis/types/analysis";

const api = vi.hoisted(() => ({
  analyzeText: vi.fn(),
  getWritingFeedback: vi.fn(),
  getAutocomplete: vi.fn(),
}));
vi.mock("@/features/analysis/api/analysis-api", () => api);
vi.mock("@/features/workspace/api/workspace-api", () => ({
  getHealth: vi.fn(async () => ({ trained: true })),
}));

const analysis = {
  id: "example",
  title: "Example",
  text: "Microsoft builds useful tools.",
  entities: [{ text: "Microsoft", label: "ORG", start: 0, end: 9 }],
  warnings: [],
  tokens: [],
  keywords: [{ text: "tools", score: 1 }],
  noun_phrases: [],
  word_frequencies: [],
  language: "en",
  sentiment: { label: "Positive", score: 0.5 },
  readability: {
    flesch_reading_ease: 80,
    flesch_kincaid_grade: 3,
    average_sentence_length: 4,
    lexical_diversity: 1,
  },
} as unknown as AnalysisResult;

beforeEach(() => {
  api.analyzeText.mockResolvedValue(analysis);
  api.getWritingFeedback.mockResolvedValue({ issues: [], warnings: [] });
  api.getAutocomplete.mockResolvedValue({
    suggestions: ["language"],
    source: "dictionary prefix",
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("feature-specific editors", () => {
  it.each([
    ["Named entity recognition", "Find entities and save", "Entities"],
    ["Keyword extraction", "Extract keywords and save", "Keywords"],
    ["Readability", "Assess readability and save", "Readability"],
  ])("opens the appropriate output for %s without background writing requests", async (feature, action, tab) => {
    render(<TextAnalyzer feature={feature} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Text" }), {
      target: { value: analysis.text },
    });
    fireEvent.click(screen.getByRole("button", { name: action }));
    await screen.findByRole("tab", { name: tab });
    expect(
      screen.getByRole("tab", { name: tab }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(api.getWritingFeedback).not.toHaveBeenCalled();
    expect(api.getAutocomplete).not.toHaveBeenCalled();
  });

  it("checks writing and applies a correction without calling autocomplete", async () => {
    api.getWritingFeedback.mockResolvedValue({
      issues: [
        {
          type: "typo",
          message: "Use the",
          start: 1,
          end: 4,
          replacement: "the",
        },
      ],
      warnings: [],
    });
    render(<TextAnalyzer feature="Writing assistant" />);
    const input = screen.getByRole("textbox", {
      name: "Text",
    }) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "😀teh test" } });
    fireEvent.click(await screen.findByRole("button", { name: "Apply" }));
    expect(input.value).toBe("😀the test");
    expect(api.getAutocomplete).not.toHaveBeenCalled();
  });

  it("completes the word at the cursor and retains the rest of the draft", async () => {
    render(<TextAnalyzer feature="Predictive text" />);
    const input = screen.getByRole("textbox", {
      name: "Text",
    }) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "lang tools" } });
    input.setSelectionRange(4, 4);
    fireEvent.select(input);
    await screen.findByRole("button", { name: "language" });
    await waitFor(() =>
      expect(api.getAutocomplete.mock.calls.at(-1)?.[0]).toBe("lang"),
    );
    fireEvent.click(screen.getByRole("button", { name: "language" }));
    expect(input.value).toBe("language tools");
    expect(api.getWritingFeedback).not.toHaveBeenCalled();
  });
});
