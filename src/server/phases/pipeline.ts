import type { DashboardState } from "../../shared/types.js";
import { writeTextFile } from "../lib/files.js";
import { runAnalysisPhase } from "./analysis.js";
import { runNewsPhase } from "./news.js";
import { runPolicyPhase } from "./policy.js";
import {
  buildFinalReportMarkdown,
  buildPerformanceMarkdown,
} from "./reports.js";

async function persistArtifacts(state: DashboardState) {
  await Promise.all([
    writeTextFile("ANALYSIS.md", state.artifacts.analysis),
    writeTextFile("NEWS_FINDINGS.md", state.artifacts.newsFindings),
    writeTextFile("POLICY_FINDINGS.md", state.artifacts.policyFindings),
    writeTextFile("PERFORMANCE.md", state.artifacts.performance),
    writeTextFile("FINDINGS_REPORT.md", state.artifacts.finalReport),
  ]);
}

export async function runPerformancePhase(state: DashboardState) {
  const startedAt = new Date().toISOString();
  const markdown = buildPerformanceMarkdown(state);
  state.artifacts.performance = markdown;
  state.phaseSummaries.performance = {
    name: "Phase 4 — Integration & Performance",
    status: "completed",
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: state.sourceHealth.reduce(
      (total, item) => total + item.durationMs,
      0,
    ),
    itemCount: state.newsArticles.length + state.policyDocuments.length,
    summary: `Integrated ${state.newsArticles.length} news items and ${state.policyDocuments.length} policy items into one runtime store.`,
    blockers: [
      ...state.phaseSummaries.news.blockers,
      ...state.phaseSummaries.policy.blockers,
    ],
  };
  return state;
}

export async function runFinalReportPhase(state: DashboardState) {
  const startedAt = new Date().toISOString();
  const markdown = buildFinalReportMarkdown(state);
  state.artifacts.finalReport = markdown;
  state.phaseSummaries.finalReport = {
    name: "Phase 5 — Findings Report",
    status: "completed",
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: 50,
    itemCount: [
      ...state.phaseSummaries.news.blockers,
      ...state.phaseSummaries.policy.blockers,
    ].length,
    summary:
      "Generated a negotiation-ready report from the current runtime evidence.",
    blockers: [
      ...state.phaseSummaries.news.blockers,
      ...state.phaseSummaries.policy.blockers,
    ],
  };
  return state;
}

export async function runAllPhases(state: DashboardState) {
  let next = await runAnalysisPhase(state);
  next = await runNewsPhase(next);
  next = await runPolicyPhase(next);
  next = await runPerformancePhase(next);
  next = await runFinalReportPhase(next);
  await persistArtifacts(next);
  return next;
}

export async function persistCurrentArtifacts(state: DashboardState) {
  await persistArtifacts(state);
}
