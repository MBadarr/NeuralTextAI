import type {
  AnalysisResult,
  AutocompleteResult,
  HealthResult,
  Insights,
  ModelInfo,
  PlagiarismResult,
  SentimentResult,
  SummaryResult,
  WritingFeedbackResult,
} from "@/types/analysis";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const BACKEND_START_COMMAND = "uv run uvicorn app.main:app --reload";

function backendUnavailableError() {
  return new Error(`Backend is not running.`);
}

async function getJson<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`);
  } catch {
    throw backendUnavailableError();
  }
  if (!response.ok) throw new Error(await getErrorMessage(response));
  return (await response.json()) as T;
}

async function getErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { detail?: string };
    if (body.detail) return body.detail;
  } catch {
    // Use the status when the API response is not JSON.
  }
  return `Backend request failed (${response.status}).`;
}

async function postJson<T>(path: string, text: string, title?: string) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, ...(title ? { title } : {}) }),
    });
  } catch {
    throw backendUnavailableError();
  }
  if (!response.ok) throw new Error(await getErrorMessage(response));
  return (await response.json()) as T;
}

export function getHealth() {
  return getJson<HealthResult>("/health");
}

export async function analyzeText(text: string, title: string) {
  return postJson<AnalysisResult>("/analysis", text, title || undefined);
}

export async function runTextTool(
  path: "sentiment" | "summary" | "plagiarism",
  text: string,
) {
  if (path === "sentiment")
    return postJson<SentimentResult>("/sentiment", text);
  if (path === "summary") return postJson<SummaryResult>("/summary", text);
  return postJson<PlagiarismResult>("/plagiarism", text);
}

export async function getWritingFeedback(text: string) {
  return postJson<WritingFeedbackResult>("/writing-feedback", text);
}

export async function getAutocomplete(text: string) {
  return postJson<AutocompleteResult>("/autocomplete", text);
}

export function getDocuments() {
  return getJson<AnalysisResult[]>("/documents");
}

export function getInsights() {
  return getJson<Insights>("/insights");
}

export function getModels() {
  return getJson<ModelInfo[]>("/models");
}

export async function deleteDocument(id: string) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/documents/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  } catch {
    throw backendUnavailableError();
  }
  if (!response.ok) throw new Error(await getErrorMessage(response));
}
