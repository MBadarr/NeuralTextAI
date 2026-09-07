export type AnalysisResult = {
  id: string;
  title: string;
  text: string;
  language: string;
  word_count: number;
  sentence_count: number;
  reading_time_minutes: number;
  tokens: Array<{
    text: string;
    lemma: string;
    part_of_speech: string;
    is_stop: boolean;
  }>;
  entities: Array<{
    text: string;
    label: string;
    start: number;
    end: number;
  }>;
};

export type Insights = {
  total_documents: number;
  total_words: number;
  total_entities: number;
};

export type ModelInfo = {
  name: string;
  language: string;
  components: string[];
};

export type SentimentResult = {
  label: string;
  score: number;
  confidence: number;
};

export type SummaryResult = {
  summary: string;
  sentence_count: number;
};

export type PlagiarismMatch = {
  document_id: string;
  title: string;
  overlap: number;
};

export type PlagiarismResult = {
  match_percentage: number;
  matches: PlagiarismMatch[];
};

export type WritingFeedbackResult = {
  issues: Array<{
    type: "typo" | "style" | "structure" | string;
    message: string;
    start: number;
    end: number;
  }>;
  issue_count: number;
};

export type AutocompleteResult = {
  suggestions: string[];
};

export type HealthResult = {
  status: string;
  service: string;
  model: string;
};
