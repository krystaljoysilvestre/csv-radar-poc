import Parser from "rss-parser";
import type {
  Blocker,
  DashboardState,
  NewsArticle,
  SourceHealth,
} from "../../shared/types.js";
import { newsFeeds } from "../config/sources.js";
import { createId, summarizeText, uniqueBy } from "../lib/utils.js";

const parser = new Parser();

function buildNewsFindingsMarkdown(
  articles: NewsArticle[],
  sourceHealth: SourceHealth[],
  blockers: Blocker[],
  durationMs: number,
  totalFetched: number,
) {
  const statusRows = sourceHealth
    .map(
      (source) =>
        `| ${source.name} | ${source.ok ? "OK" : "Failed"} | ${source.statusCode ?? "n/a"} | ${source.durationMs}ms | ${source.notes.join("; ") || "None"} |`,
    )
    .join("\n");

  const blockerSection = blockers.length
    ? blockers
        .map(
          (blocker) =>
            `### ${blocker.title}\n- Severity: ${blocker.severity}\n- Impact: ${blocker.impact}\n- Mitigation: ${blocker.mitigation}`,
        )
        .join("\n\n")
    : "No critical blockers found in the feed ingestion step.";

  return `# Phase 2: News Fetcher Findings\n\n## Summary\n- Sources tested: ${sourceHealth.length}\n- Raw items fetched: ${totalFetched}\n- Unique items stored: ${articles.length}\n- Run duration: ${durationMs}ms\n\n## Source Health\n| Source | Status | HTTP | Duration | Notes |\n| --- | --- | --- | --- | --- |\n${statusRows || "| None | n/a | n/a | n/a | n/a |"}\n\n## Sample Articles\n${
    articles
      .slice(0, 8)
      .map((article) => `- ${article.title} (${article.source})`)
      .join("\n") || "- No articles captured yet."
  }\n\n## Blockers\n${blockerSection}\n`;
}

export async function runNewsPhase(state: DashboardState) {
  const startedAt = new Date().toISOString();
  const phaseHealth: SourceHealth[] = [];
  const rawArticles: NewsArticle[] = [];
  const blockers: Blocker[] = [];
  let totalFetched = 0;

  for (const feed of newsFeeds) {
    const sourceStarted = performance.now();
    try {
      const parsed = await parser.parseURL(feed.url);
      const items = parsed.items.slice(0, 12);
      totalFetched += items.length;

      phaseHealth.push({
        name: feed.name,
        url: feed.url,
        ok: true,
        durationMs: Math.round(performance.now() - sourceStarted),
        notes: [`${items.length} items parsed from RSS feed`],
      });

      for (const item of items) {
        const url = item.link?.trim();
        const title = item.title?.trim();
        if (!url || !title) continue;

        const summary = summarizeText(
          item.contentSnippet ?? item.content ?? item.summary ?? title,
          240,
        );
        const dedupeKey = `${url}::${title.toLowerCase()}`;

        rawArticles.push({
          id: createId("news", dedupeKey),
          title,
          source: feed.name,
          url,
          publishedAt: item.isoDate ?? item.pubDate ?? null,
          summary,
          tags: (item.categories ?? []).slice(0, 4),
          fetchedAt: new Date().toISOString(),
          dedupeKey,
        });
      }
    } catch (error) {
      phaseHealth.push({
        name: feed.name,
        url: feed.url,
        ok: false,
        durationMs: Math.round(performance.now() - sourceStarted),
        notes: [
          error instanceof Error ? error.message : "Unknown feed failure",
        ],
      });
    }
  }

  const articles = uniqueBy(rawArticles, (article) => article.dedupeKey);

  const failedSources = phaseHealth.filter((source) => !source.ok).length;
  if (failedSources > 0) {
    blockers.push({
      title: "Feed accessibility is inconsistent",
      severity: failedSources === phaseHealth.length ? "high" : "medium",
      summary: `${failedSources} out of ${phaseHealth.length} feed sources failed during the run.`,
      impact: "The production poller will need fallback feeds or retry logic.",
      mitigation:
        "Keep at least 3 RSS or site sources per topic cluster and add retries with cached last-good payloads.",
    });
  }

  if (articles.length < 10) {
    blockers.push({
      title: "Low article volume from seed feeds",
      severity: "medium",
      summary:
        "The current feed list does not yet provide enough volume for a strong beta dataset.",
      impact:
        "The newsletter and insights layers will feel thin unless more sources are added.",
      mitigation:
        "Add more targeted feeds or HTML scrapers for sector-specific publications.",
    });
  }

  const durationMs = phaseHealth.reduce(
    (total, item) => total + item.durationMs,
    0,
  );
  const markdown = buildNewsFindingsMarkdown(
    articles,
    phaseHealth,
    blockers,
    durationMs,
    totalFetched,
  );

  state.newsArticles = articles;
  state.sourceHealth = [
    ...state.sourceHealth.filter(
      (item) => !newsFeeds.some((feed) => feed.url === item.url),
    ),
    ...phaseHealth,
  ];
  state.artifacts.newsFindings = markdown;
  state.phaseSummaries.news = {
    name: "Phase 2 — News Fetcher",
    status: "completed",
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs,
    itemCount: articles.length,
    summary: `Fetched ${totalFetched} feed items and stored ${articles.length} unique articles across ${phaseHealth.length} sources.`,
    blockers,
  };

  return state;
}
