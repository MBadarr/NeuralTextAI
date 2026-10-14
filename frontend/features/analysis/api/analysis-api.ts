import type {
  AnalysisResult,
  AutocompleteResult,
  ClassificationResult,
  EntityResult,
  PlagiarismResult,
  SentimentResult,
  SummaryResult,
  WritingFeedbackResult,
} from "@/features/analysis/types/analysis";
import { post } from "@/lib/http";

export function analyzeText(text: string, title: string, signal?: AbortSignal) {
  return post<AnalysisResult>(
    "/analysis",
    { text, title: title || undefined },
    signal,
  );
}
export function runTextTool(
  path: "sentiment" | "intent" | "emotions" | "summary" | "plagiarism",
  text: string,
  sentenceLimit = 3,
  signal?: AbortSignal,
) {
  if (path === "intent" || path === "emotions")
    return post<ClassificationResult>(`/${path}`, { text }, signal);
  if (path === "sentiment")
    return post<SentimentResult>("/sentiment", { text }, signal);
  if (path === "summary")
    return post<SummaryResult>(
      "/summary",
      { text, sentence_limit: sentenceLimit },
      signal,
    );
  return post<PlagiarismResult>("/plagiarism", { text }, signal);
}
export function getWritingFeedback(text: string, signal?: AbortSignal) {
  return post<WritingFeedbackResult>("/writing-feedback", { text }, signal);
}
export function getEntities(text: string, signal?: AbortSignal) {
  return post<EntityResult>("/entities", { text }, signal);
}
export function getAutocomplete(text: string, signal?: AbortSignal) {
  return post<AutocompleteResult>("/autocomplete", { text }, signal);
}
