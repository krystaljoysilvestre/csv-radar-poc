import type {
  Blocker,
  DashboardState,
  SourceHealth,
} from "../../shared/types.js";
import { newsFeeds, policySources } from "../config/sources.js";
import { timedFetchWithRetry } from "../lib/http.js";

function sourceFromUrl(name: string, url: string) {
  try {
    const parsed = new URL(url);
    return { name, baseUrl: `${parsed.protocol}//${parsed.host}` };
  } catch {
    return { name, baseUrl: url };
  }
}

async function inspectBaseSource(
  name: string,
  baseUrl: string,
): Promise<SourceHealth> {
  try {
    const page = await timedFetchWithRetry(baseUrl, undefined, {
      retries: 1,
      baseDelayMs: 350,
    });
    const html = await page.response.text();
    const robotsUrl = `${baseUrl.replace(/\/$/, "")}/robots.txt`;

    let robotsNote = "robots.txt unavailable";
    try {
      const robots = await timedFetchWithRetry(robotsUrl, undefined, {
        retries: 0,
      });
      const robotsText = await robots.response.text();
      const mentionsCrawler = /crawl-delay|disallow/i.test(robotsText);
      robotsNote = mentionsCrawler
        ? "robots.txt has crawl constraints"
        : "robots.txt fetched";
    } catch {
      robotsNote = "robots.txt unavailable";
    }

    const maybeBlocked =
      page.response.status >= 400 ||
      /access denied|forbidden|captcha/i.test(html);

    return {
      name,
      url: baseUrl,
      ok: page.response.ok,
      statusCode: page.response.status,
      durationMs: page.durationMs,
      notes: [
        `HTTP attempts: ${page.attempts}`,
        robotsNote,
        maybeBlocked
          ? "Possible anti-bot response detected"
          : "Basic HTML request worked",
      ],
    };
  } catch (error) {
    return {
      name,
      url: baseUrl,
      ok: false,
      durationMs: 0,
      notes: [
        error instanceof Error ? error.message : "Unknown analysis error",
      ],
    };
  }
}

function buildAnalysisMarkdown(
  results: SourceHealth[],
  blockers: Blocker[],
  durationMs: number,
) {
  const rows = results
    .map(
      (item) =>
        `| ${item.name} | ${item.ok ? "OK" : "Failed"} | ${item.statusCode ?? "n/a"} | ${item.durationMs}ms | ${item.notes.join("; ")} |`,
    )
    .join("\n");

  const blockerSection = blockers.length
    ? blockers
        .map(
          (blocker) =>
            `### ${blocker.title}\n- Severity: ${blocker.severity}\n- Impact: ${blocker.impact}\n- Mitigation: ${blocker.mitigation}`,
        )
        .join("\n\n")
    : "No critical blockers were detected during phase 1 site inspection.";

  return `# Phase 1: Site Inspection Report\n\n## Summary\n- Sources inspected: ${results.length}\n- Failing checks: ${results.filter((item) => !item.ok).length}\n- Run duration: ${durationMs}ms\n\n## Source Health\n| Source | Status | HTTP | Duration | Notes |\n| --- | --- | --- | --- | --- |\n${rows || "| None | n/a | n/a | n/a | n/a |"}\n\n## Blockers\n${blockerSection}\n`;
}

export async function runAnalysisPhase(state: DashboardState) {
  const startedAt = new Date().toISOString();
  const policySites = policySources.map((source) => ({
    name: `${source.name} site`,
    baseUrl: source.baseUrl,
  }));
  const newsSites = newsFeeds.map((feed) =>
    sourceFromUrl(`${feed.name} host`, feed.url),
  );
  const uniqueSites = [...policySites, ...newsSites].filter(
    (site, index, all) =>
      index ===
      all.findIndex((candidate) => candidate.baseUrl === site.baseUrl),
  );

  const checks = await Promise.all(
    uniqueSites.map((site) => inspectBaseSource(site.name, site.baseUrl)),
  );
  const blockers: Blocker[] = [];
  const failed = checks.filter((item) => !item.ok);

  if (failed.length > 0) {
    blockers.push({
      title: "Some sources are inaccessible via direct HTTP",
      severity:
        failed.length >= Math.ceil(checks.length / 2) ? "high" : "medium",
      summary: `${failed.length} out of ${checks.length} base sources failed during Phase 1 probing.`,
      impact:
        "Later phases may need fallback feeds, retries, or browser automation for blocked sources.",
      mitigation:
        "Keep redundant source lists and treat JS/captcha targets as optional in beta scope.",
    });
  }

  if (
    checks.some((item) =>
      item.notes.some((note) => note.includes("crawl constraints")),
    )
  ) {
    blockers.push({
      title: "robots.txt indicates crawl constraints",
      severity: "medium",
      summary:
        "At least one source declared crawler constraints in robots.txt.",
      impact:
        "Aggressive polling can cause bans or unstable collection quality.",
      mitigation:
        "Keep low request rates, retry with backoff, and cache prior successful links.",
    });
  }

  const durationMs = checks.reduce((total, item) => total + item.durationMs, 0);
  const markdown = buildAnalysisMarkdown(checks, blockers, durationMs);

  state.artifacts.analysis = markdown;
  state.phaseSummaries.analysis = {
    name: "Phase 1 — Site Analysis",
    status: "completed",
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs,
    itemCount: checks.length,
    summary: `Inspected ${checks.length} base sources with ${failed.length} failures and ${blockers.length} blocker signals.`,
    blockers,
  };
  state.sourceHealth = [
    ...state.sourceHealth.filter(
      (item) => !uniqueSites.some((site) => item.url === site.baseUrl),
    ),
    ...checks,
  ];

  return state;
}
