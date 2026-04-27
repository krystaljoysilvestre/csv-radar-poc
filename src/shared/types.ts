export type PhaseStatus = "idle" | "running" | "completed" | "failed";

export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string | null;
  summary: string;
  tags: string[];
  fetchedAt: string;
  dedupeKey: string;
}

export interface PolicyDocument {
  id: string;
  title: string;
  source: "DOE" | "ERC";
  url: string;
  publishedAt: string | null;
  docType: string;
  contentType: string;
  isPdf: boolean;
  requiresJs: boolean;
  blocked: boolean;
  notes: string[];
  fetchedAt: string;
}

export interface Blocker {
  title: string;
  severity: "low" | "medium" | "high";
  summary: string;
  impact: string;
  mitigation: string;
}

export interface SourceHealth {
  name: string;
  url: string;
  ok: boolean;
  statusCode?: number;
  durationMs: number;
  notes: string[];
}

export interface PhaseSummary {
  name: string;
  status: PhaseStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number;
  itemCount: number;
  summary: string;
  blockers: Blocker[];
}

export interface PhaseArtifacts {
  analysis: string;
  newsFindings: string;
  policyFindings: string;
  performance: string;
  finalReport: string;
}

export interface RuntimeConfig {
  policyUsePlaywright: boolean;
  policyRetryCount: number;
  policySeedOnly: boolean;
}

export interface DashboardState {
  generatedAt: string | null;
  phaseSummaries: Record<
    "analysis" | "news" | "policy" | "performance" | "finalReport",
    PhaseSummary
  >;
  newsArticles: NewsArticle[];
  policyDocuments: PolicyDocument[];
  sourceHealth: SourceHealth[];
  artifacts: PhaseArtifacts;
  config: RuntimeConfig;
}
