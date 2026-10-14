export type WritingIssue = {
  type: string;
  message: string;
  start: number;
  end: number;
  replacement: string | null;
};
export type SentimentResult = {
  label: string;
  score: number;
  confidence: number;
  positive: number;
  negative: number;
  neutral: number;
  method: string;
  warnings: string[];
  emotions?: ClassificationResult;
};
export type ClassificationResult = {
  label: string;
  method: string;
  scores: Record<string, number>;
  warnings: string[];
  sentences: Array<{
    text: string;
    start: number;
    end: number;
    label: string;
    scores: Record<string, number>;
    evidence?:
      | string
      | Array<{
          text: string;
          label: string;
          negated: boolean;
          weight: number;
          start: number;
          end: number;
        }>;
  }>;
};
export type Readability = {
  flesch_reading_ease: number;
  flesch_kincaid_grade: number;
  average_sentence_length: number;
  lexical_diversity: number;
};
export type AnalysisResult = {
  id: string;
  title: string;
  text: string;
  created_at: string;
  language: string;
  language_confidence: number;
  word_count: number;
  sentence_count: number;
  reading_time_minutes: number;
  character_count: number;
  unique_word_count: number;
  processing_time_ms: number;
  model: string;
  warnings: string[];
  tokens: Array<{
    text: string;
    lemma: string;
    stem?: string;
    part_of_speech: string;
    is_stop: boolean;
    dependency: string;
    head: string;
    start: number;
    end: number;
  }>;
  entities: Array<{ text: string; label: string; start: number; end: number }>;
  keywords: Array<{ text: string; score: number }>;
  noun_phrases: string[];
  word_frequencies: Array<{ word: string; count: number }>;
  readability: Readability | null;
  sentiment: SentimentResult;
  intent?: ClassificationResult | null;
  emotions?: ClassificationResult | null;
  summary: string;
};
export type Insights = {
  total_documents: number;
  total_words: number;
  total_entities: number;
  average_processing_time_ms: number;
  entity_counts: Record<string, number>;
  language_counts: Record<string, number>;
  sentiment_counts: Record<string, number>;
};
export type ModelInfo = {
  name: string;
  language: string;
  components: string[];
  vectors: number;
  trained: boolean;
  capabilities: string[];
};
export type SummaryResult = {
  summary: string;
  sentence_count: number;
  selected_sentence_count: number;
  method: string;
};
export type PlagiarismMatch = {
  document_id: string;
  title: string;
  overlap: number;
};
export type PlagiarismResult = {
  match_percentage: number;
  matches: PlagiarismMatch[];
  method: string;
  compared_documents: number;
};
export type WritingFeedbackResult = {
  issues: WritingIssue[];
  issue_count: number;
  warnings: string[];
};
export type AutocompleteResult = { suggestions: string[]; source: string };
export type EntityResult = {
  text: string;
  entities: AnalysisResult["entities"];
  counts: Record<string, number>;
  model: string;
  language: string;
  warnings: string[];
};
export type HealthResult = {
  status: string;
  service: string;
  model: string;
  trained: boolean;
  storage: string;
};
export type SearchResult = {
  results: Array<{ document: AnalysisResult; score: number }>;
  method: string;
  warnings: string[];
};
