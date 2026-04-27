import type { DashboardState } from "../../shared/types.js";
import { median } from "../lib/utils.js";

export function buildPerformanceMarkdown(state: DashboardState) {
  const healthDurations = state.sourceHealth.map((item) => item.durationMs);
  const failures = state.sourceHealth.filter((item) => !item.ok).length;
  const newsCount = state.newsArticles.length;
  const policyCount = state.policyDocuments.length;

  return `# Phase 4: Performance & Integration Report\n\n## Summary\n- News articles stored: ${newsCount}\n- Policy documents stored: ${policyCount}\n- Source checks executed: ${state.sourceHealth.length}\n- Failing checks: ${failures}\n- Median fetch duration: ${median(healthDurations)}ms\n\n## Integration Notes\n- The dashboard now reads a single runtime state file and can trigger all phases from the browser.\n- Phase outputs write back into the repo markdown files so your negotiation artifacts stay current.\n- The backend keeps the POC logic in TypeScript, so you can maintain it from a frontend-heavy stack.\n\n## Risks Still Open\n${
    [
      ...state.phaseSummaries.news.blockers,
      ...state.phaseSummaries.policy.blockers,
    ]
      .map((blocker) => `- ${blocker.title}: ${blocker.impact}`)
      .join("\n") || "- No unresolved blockers captured yet."
  }\n`;
}

export function buildFinalReportMarkdown(state: DashboardState) {
  const allBlockers = [
    ...state.phaseSummaries.news.blockers,
    ...state.phaseSummaries.policy.blockers,
  ];
  const highBlockers = allBlockers.filter(
    (blocker) => blocker.severity === "high",
  );
  const confidence = Math.max(
    35,
    85 -
      highBlockers.length * 15 -
      (allBlockers.length - highBlockers.length) * 7,
  );
  const verdict =
    confidence >= 70
      ? "GO with scope discipline"
      : confidence >= 55
        ? "GO with negotiation"
        : "Do not commit without scope changes";

  return `# CSV Radar POC — Final Findings Report\n\n## Verdict\n- Recommendation: ${verdict}\n- Confidence score: ${confidence}%\n- News pipeline: ${state.phaseSummaries.news.summary}\n- Policy pipeline: ${state.phaseSummaries.policy.summary}\n\n## Stack Overview\n- The POC is TypeScript-first, with a React dashboard and a small Node backend.\n- Both the UI and the crawler logic can be iterated independently.\n- Reports are generated from the same runtime data the UI displays, keeping presentation and evidence aligned.\n\n## Negotiation Notes\n${
    allBlockers
      .map(
        (blocker) =>
          `- ${blocker.title}: ${blocker.summary} Mitigation: ${blocker.mitigation}`,
      )
      .join("\n") || "- No blockers were captured yet."
  }\n\n## Next Steps\n- Keep the beta narrow: ingest news reliably, capture policy metadata reliably, and defer expensive OCR or browser automation unless required by the POC evidence.\n- Tie milestone acceptance to observable outputs: item counts, report freshness, and dashboard visibility.\n- Keep a contingency on policy extraction because government sites can change structure without warning.\n`;
}
