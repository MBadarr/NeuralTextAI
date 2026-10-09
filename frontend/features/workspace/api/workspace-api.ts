import type {
  AnalysisResult,
  HealthResult,
  Insights,
  ModelInfo,
  SearchResult,
} from "@/features/analysis/types/analysis";
import { post, request } from "@/lib/http";

export function getHealth(signal?: AbortSignal) {
  return request<HealthResult>("/health", { signal });
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
