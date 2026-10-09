import type {
  AnalysisResult,
  AutocompleteResult,
  ClassificationResult,
  HealthResult,
  Insights,
  ModelInfo,
  PlagiarismResult,
  SearchResult,
  SentimentResult,
  SummaryResult,
  WritingFeedbackResult,
} from "@/types/analysis";

const API_URL = "/api/backend";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error("Cannot reach the service. Please try again in a moment.");
  }
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.location.replace("/auth/sign-in");
    }
    let message = `Backend request failed (${response.status}).`;
    try {
      const body = (await response.json()) as {
        detail?: string | Array<{ msg: string; loc: Array<string | number> }>;
      };
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail))
        message = body.detail
          .map((item) => `${item.loc.slice(1).join(".")}: ${item.msg}`)
          .join("; ");
    } catch {
      /* Keep the HTTP status if no JSON error is available. */
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
function post<T>(path: string, payload: object, signal?: AbortSignal) {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
}
export function getHealth(signal?: AbortSignal) {
  return request<HealthResult>("/health", { signal });
}
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
export function getAutocomplete(text: string, signal?: AbortSignal) {
  return post<AutocompleteResult>("/autocomplete", { text }, signal);
}
export function getDocuments(signal?: AbortSignal) {
  return request<AnalysisResult[]>("/documents", { signal });
}
export function getInsights(signal?: AbortSignal) {
  return request<Insights>("/insights", { signal });
}
export function getModels(signal?: AbortSignal) {
  return request<ModelInfo[]>("/models", { signal });
}
export function searchDocuments(query: string, signal?: AbortSignal) {
  return post<SearchResult>("/search", { query }, signal);
}
export function deleteDocument(id: string) {
  return request<void>(`/documents/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
