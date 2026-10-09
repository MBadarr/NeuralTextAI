import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalysisResults } from "@/features/analysis/components/AnalysisResults";
import { ClassificationResults } from "@/features/analysis/components/ClassificationResults";
import { TextTool } from "@/features/analysis/components/TextTool";
import type {
  AnalysisResult,
  ClassificationResult,
} from "@/features/analysis/types/analysis";

const { runTextTool } = vi.hoisted(() => ({ runTextTool: vi.fn() }));
vi.mock("@/features/analysis/api/analysis-api", () => ({ runTextTool }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const emotion: ClassificationResult = {
  label: "Joy",
  method: "English emotion lexicon",
  scores: { Joy: 1, Sadness: 0 },
  warnings: ["Scores are evidence, not probabilities."],
  sentences: [
    {
      text: "I am not sad, but happy.",
      start: 0,
      end: 24,
      label: "Joy",
      scores: { Joy: 1 },
      evidence: [
        {
          text: "sad",
          label: "Sadness",
          negated: true,
          weight: 0,
          start: 9,
          end: 12,
        },
      ],
    },
  ],
};
const intent: ClassificationResult = {
  label: "Request",
  method: "English speech-act rules",
  scores: { Request: 1 },
  warnings: [],
  sentences: [
    {
      text: "Please help.",
      start: 0,
      end: 12,
      label: "Request",
      scores: {},
      evidence: "Request phrasing",
    },
  ],
};

describe("new analysis results", () => {
  it("shows emotion evidence and explicitly excludes negated evidence", () => {
    render(<ClassificationResults kind="Emotion" result={emotion} />);
    expect(screen.getByText(/sad · Sadness.*negated, excluded/)).toBeTruthy();
    expect(
      screen.getByText("Scores are evidence, not probabilities."),
    ).toBeTruthy();
  });

  it("handles older documents without claiming new results", () => {
    render(<ClassificationResults kind="Intent" />);
    expect(screen.getByText(/Run a new analysis/)).toBeTruthy();
  });

  it("exposes intent, emotion, and separate stem/lemma values in analyzer tabs", () => {
    const result = {
      id: "test",
      title: "Test analysis",
      text: "running",
      warnings: [],
      entities: [],
      tokens: [
        {
          text: "running",
          lemma: "run",
          stem: "run",
          part_of_speech: "VERB",
          dependency: "ROOT",
          head: "running",
          is_stop: false,
          start: 0,
          end: 7,
        },
      ],
      language: "en",
      keywords: [],
      noun_phrases: [],
      word_frequencies: [],
      sentiment: { label: "Neutral", score: 0 },
      intent,
      emotions: emotion,
    } as unknown as AnalysisResult;
    render(<AnalysisResults result={result} />);
    fireEvent.click(screen.getByRole("tab", { name: "Tokens" }));
    expect(screen.getByRole("columnheader", { name: "Lemma" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Stem" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Intent" }));
    expect(screen.getByRole("region", { name: "Intent results" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Emotions" }));
    expect(
      screen.getByRole("region", { name: "Emotion results" }),
    ).toBeTruthy();
  });

  it("runs the standalone intent tool and displays its returned classification", async () => {
    runTextTool.mockResolvedValue(intent);
    render(<TextTool name="Intent analysis" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Text" }), {
      target: { value: "Please help." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Run intent analysis" }),
    );
    await screen.findByRole("region", { name: "Intent results" });
    expect(runTextTool.mock.calls[0][0]).toBe("intent");
    expect(screen.getByText("Request phrasing")).toBeTruthy();
  });
});
