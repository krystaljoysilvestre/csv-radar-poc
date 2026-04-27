import * as cheerio from "cheerio";
import type {
  Blocker,
  DashboardState,
  PolicyDocument,
  SourceHealth,
} from "../../shared/types.js";
import { policyKeywords, policySources } from "../config/sources.js";
import { readDataJson, writeDataJson } from "../lib/files.js";
import { timedFetchWithRetry } from "../lib/http.js";
import { createId, summarizeText, uniqueBy } from "../lib/utils.js";

interface CandidateLink {
  text: string;
  url: string;
  score: number;
}

type PolicyLinkCache = Record<string, string[]>;

interface PageFetchResult {
  html: string;
  statusCode?: number;
  durationMs: number;
  usedPlaywright: boolean;
  note: string;
}

async function loadPlaywrightRuntime(): Promise<any | null> {
  try {
    const dynamicImporter = new Function(
      "moduleName",
      "return import(moduleName);",
    ) as (moduleName: string) => Promise<any>;
    return await dynamicImporter("playwright");
  } catch {
    return null;
  }
}

function absoluteUrl(baseUrl: string, href: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function inferDocType(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("circular")) return "Circular";
  if (lower.includes("resolution")) return "Resolution";
  if (lower.includes("order")) return "Order";
  if (lower.includes("memorandum")) return "Memorandum";
  if (lower.includes("advisory")) return "Advisory";
  if (lower.includes("policy")) return "Policy";
  if (lower.includes("guideline")) return "Guideline";
  return "Document";
}

function detectRequiresJs(html: string) {
  const text = html.toLowerCase();
  const appShellSignals = [
    "__next_data__",
    'id="app"',
    "ng-version",
    "react-root",
    "window.__nuxt",
  ];
  const bodyText = text
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "");
  return (
    appShellSignals.some((signal) => text.includes(signal)) ||
    bodyText.length < 900
  );
}

function extractCandidateLinks(html: string, baseUrl: string) {
  const $ = cheerio.load(html);
  const candidates = $("a[href]")
    .toArray()
    .map((element) => {
      const href = $(element).attr("href") ?? "";
      const text = $(element).text().replace(/\s+/g, " ").trim();
      const url = absoluteUrl(baseUrl, href);
      const haystack = `${text} ${url}`.toLowerCase();
      const score = policyKeywords.reduce(
        (total, keyword) => total + (haystack.includes(keyword) ? 1 : 0),
        0,
      );
      return { text, url, score };
    })
    .filter(
      (candidate) => candidate.url.startsWith("http") && candidate.score > 0,
    )
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));

  return uniqueBy(candidates, (candidate) => candidate.url).slice(0, 18);
}

function toSeedCandidates(urls: string[]): CandidateLink[] {
  return uniqueBy(
    urls.map((url) => ({ text: "Seed URL", url, score: 1 })),
    (item) => item.url,
  );
}

async function fetchWithOptionalPlaywright(
  url: string,
  allowPlaywright: boolean,
): Promise<PageFetchResult> {
  const fetched = await timedFetchWithRetry(url, undefined, {
    retries: 2,
    baseDelayMs: 450,
  });
  const statusCode = fetched.response.status;
  const html = await fetched.response.text();
  const looksBlocked =
    statusCode >= 400 || /access denied|forbidden|captcha/i.test(html);
  const looksJsHeavy = detectRequiresJs(html);

  if ((!looksBlocked && !looksJsHeavy) || !allowPlaywright) {
    return {
      html,
      statusCode,
      durationMs: fetched.durationMs,
      usedPlaywright: false,
      note: `HTTP fetch (${fetched.attempts} attempt${fetched.attempts > 1 ? "s" : ""})`,
    };
  }

  try {
    const started = performance.now();
    const playwright = await loadPlaywrightRuntime();
    if (!playwright?.chromium) {
      return {
        html,
        statusCode,
        durationMs: fetched.durationMs,
        usedPlaywright: false,
        note: "Playwright unavailable; used HTTP fallback only",
      };
    }
    const browser = await playwright.chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
      await page.waitForTimeout(1200);
      const rendered = await page.content();
      return {
        html: rendered,
        statusCode: response?.status(),
        durationMs: Math.round(performance.now() - started),
        usedPlaywright: true,
        note: "Playwright-rendered fallback used",
      };
    } finally {
      await browser.close();
    }
  } catch {
    return {
      html,
      statusCode,
      durationMs: fetched.durationMs,
      usedPlaywright: false,
      note: "Playwright unavailable; used HTTP fallback only",
    };
  }
}

function buildPolicyMarkdown(
  documents: PolicyDocument[],
  sourceHealth: SourceHealth[],
  blockers: Blocker[],
  durationMs: number,
) {
  const rows = sourceHealth
    .map(
      (item) =>
        `| ${item.name} | ${item.ok ? "OK" : "Failed"} | ${item.statusCode ?? "n/a"} | ${item.durationMs}ms | ${item.notes.join("; ") || "None"} |`,
    )
    .join("\n");

  const blockerSection = blockers.length
    ? blockers
        .map(
          (blocker) =>
            `### ${blocker.title}\n- Severity: ${blocker.severity}\n- Impact: ${blocker.impact}\n- Mitigation: ${blocker.mitigation}`,
        )
        .join("\n\n")
    : "No critical blockers found in the policy discovery run.";

  return `# Phase 3: Policy Crawler Findings\n\n## Summary\n- Sources tested: ${policySources.length}\n- Candidate documents stored: ${documents.length}\n- Run duration: ${durationMs}ms\n- PDFs detected: ${documents.filter((doc) => doc.isPdf).length}\n- JS-dependent pages detected: ${documents.filter((doc) => doc.requiresJs).length}\n\n## Source Health\n| Source | Status | HTTP | Duration | Notes |\n| --- | --- | --- | --- | --- |\n${rows || "| None | n/a | n/a | n/a | n/a |"}\n\n## Sample Documents\n${
    documents
      .slice(0, 10)
      .map(
        (doc) =>
          `- ${doc.title} (${doc.source}, ${doc.docType}, ${doc.isPdf ? "PDF" : doc.contentType})`,
      )
      .join("\n") || "- No policy documents captured yet."
  }\n\n## Blockers\n${blockerSection}\n`;
}

export async function runPolicyPhase(state: DashboardState) {
  const startedAt = new Date().toISOString();
  const sourceHealth: SourceHealth[] = [];
  const rawDocuments: PolicyDocument[] = [];
  const blockers: Blocker[] = [];
  const allowPlaywright = state.config.policyUsePlaywright;
  const retryCount = Math.max(0, Math.min(6, state.config.policyRetryCount));
  const seedOnlyMode = state.config.policySeedOnly;
  const linkCache = await readDataJson<PolicyLinkCache>(
    "policy-link-cache.json",
    {},
  );
  const nextLinkCache: PolicyLinkCache = { ...linkCache };
  let usedSeedFallback = false;
  let usedPlaywrightCount = 0;
  let playwrightUnavailableDetected = false;

  for (const source of policySources) {
    const sourceKey = source.name;
    const cachedUrls = linkCache[sourceKey] ?? [];

    for (const entryPath of source.entryPaths) {
      const url = absoluteUrl(source.baseUrl, entryPath);
      const started = performance.now();

      try {
        const page = seedOnlyMode
          ? {
              html: "",
              statusCode: 0,
              durationMs: 0,
              usedPlaywright: false,
              note: "Seed-only mode enabled",
            }
          : await fetchWithOptionalPlaywright(url, allowPlaywright);
        const statusCode = page.statusCode;
        const requiresJs = detectRequiresJs(page.html);
        let candidates = seedOnlyMode
          ? []
          : extractCandidateLinks(page.html, source.baseUrl);

        if (
          !candidates.length ||
          (statusCode !== undefined && statusCode >= 400)
        ) {
          usedSeedFallback = true;
          const fallbackCandidates = toSeedCandidates([
            ...(source.seedUrls ?? []),
            ...cachedUrls,
          ]);
          candidates = uniqueBy(
            [...candidates, ...fallbackCandidates],
            (candidate) => candidate.url,
          ).slice(0, 18);
        }

        if (page.usedPlaywright) {
          usedPlaywrightCount += 1;
        }

        if (
          !page.usedPlaywright &&
          page.note.includes("Playwright unavailable")
        ) {
          playwrightUnavailableDetected = true;
        }

        sourceHealth.push({
          name: `${source.name} ${entryPath}`,
          url,
          ok:
            statusCode !== undefined
              ? statusCode >= 200 && statusCode < 400
              : false,
          statusCode,
          durationMs: page.durationMs,
          notes: [
            `${candidates.length} candidate links`,
            requiresJs ? "Potential JS-heavy shell" : "HTML readable",
            page.note,
          ],
        });

        for (const candidate of candidates.slice(0, 10)) {
          try {
            const child = await timedFetchWithRetry(candidate.url, undefined, {
              retries: retryCount,
              baseDelayMs: 400,
            });
            const contentType =
              child.response.headers.get("content-type") ?? "unknown";
            const isPdf =
              candidate.url.toLowerCase().endsWith(".pdf") ||
              contentType.includes("pdf");
            const plainBody = isPdf ? "" : await child.response.text();
            const shouldRenderChild =
              !isPdf &&
              allowPlaywright &&
              (detectRequiresJs(plainBody) || child.response.status >= 400);

            let body = plainBody;
            let pageUsedPlaywright = false;
            if (shouldRenderChild) {
              const rendered = await fetchWithOptionalPlaywright(
                candidate.url,
                true,
              );
              body = rendered.html;
              pageUsedPlaywright = rendered.usedPlaywright;
              if (pageUsedPlaywright) {
                usedPlaywrightCount += 1;
              }
              if (
                !pageUsedPlaywright &&
                rendered.note.includes("Playwright unavailable")
              ) {
                playwrightUnavailableDetected = true;
              }
            }

            const $ = isPdf ? null : cheerio.load(body);
            const pageTitle = $ ? $("title").text().trim() : "";
            const title = candidate.text || pageTitle || candidate.url;
            const pageRequiresJs = !isPdf && detectRequiresJs(body);
            const blocked =
              child.response.status >= 400 ||
              /access denied|forbidden|captcha/i.test(body);
            const notes = [
              isPdf ? "PDF document" : summarizeText(body, 120),
              pageRequiresJs
                ? "Likely needs Playwright for reliable extraction"
                : "Direct HTML fetch looked parseable",
              `HTTP retries: ${child.attempts}`,
              pageUsedPlaywright
                ? "Rendered with Playwright fallback"
                : "No Playwright render used",
            ].filter(Boolean) as string[];

            nextLinkCache[sourceKey] = uniqueBy(
              [...(nextLinkCache[sourceKey] ?? []), candidate.url],
              (item) => item,
            ).slice(0, 120);

            rawDocuments.push({
              id: createId("policy", `${source.name}:${candidate.url}`),
              title,
              source: source.name,
              url: candidate.url,
              publishedAt: null,
              docType: inferDocType(`${title} ${candidate.url}`),
              contentType,
              isPdf,
              requiresJs: pageRequiresJs,
              blocked,
              notes,
              fetchedAt: new Date().toISOString(),
            });
          } catch {
            rawDocuments.push({
              id: createId("policy", `${source.name}:${candidate.url}`),
              title: candidate.text || candidate.url,
              source: source.name,
              url: candidate.url,
              publishedAt: null,
              docType: inferDocType(`${candidate.text} ${candidate.url}`),
              contentType: "unreachable",
              isPdf: candidate.url.toLowerCase().endsWith(".pdf"),
              requiresJs: false,
              blocked: true,
              notes: [
                "The linked document failed to load during the POC run, even after retries.",
              ],
              fetchedAt: new Date().toISOString(),
            });
          }
        }
      } catch (error) {
        sourceHealth.push({
          name: `${source.name} ${entryPath}`,
          url,
          ok: false,
          durationMs: Math.round(performance.now() - started),
          notes: [
            error instanceof Error ? error.message : "Unknown crawler failure",
          ],
        });
      }
    }
  }

  const documents = uniqueBy(rawDocuments, (doc) => doc.url);
  const failedEntryCount = sourceHealth.filter((item) => !item.ok).length;
  const pdfRatio = documents.length
    ? documents.filter((doc) => doc.isPdf).length / documents.length
    : 0;
  const jsCount = documents.filter((doc) => doc.requiresJs).length;
  const blockedCount = documents.filter((doc) => doc.blocked).length;

  if (failedEntryCount > 0) {
    blockers.push({
      title: "Government entry pages are blocking direct fetches",
      severity:
        failedEntryCount >= policySources.length * 2 ? "high" : "medium",
      summary: `${failedEntryCount} DOE/ERC entry pages returned failures before document discovery could even begin.`,
      impact:
        "A plain server-side fetch approach is unlikely to be enough for the policy slice as-is.",
      mitigation:
        "Expect a second pass with browser automation, alternate public endpoints, or a manually curated seed list.",
    });
  }

  if (usedSeedFallback) {
    blockers.push({
      title: "Seed URL fallback was required",
      severity: documents.length > 0 ? "medium" : "high",
      summary:
        "The crawler had to rely on curated/cached links for at least one source page.",
      impact:
        "Entry-page discovery is still brittle and may break whenever government site structure changes.",
      mitigation:
        "Keep a maintained seed list and continue persisting successful URLs as crawl cache.",
    });
  }

  if (seedOnlyMode) {
    blockers.push({
      title: "Seed-only crawler mode is enabled",
      severity: "low",
      summary:
        "Phase 3 skipped entry-page discovery and used only curated/cached links.",
      impact:
        "This improves reliability but may miss newly published documents not covered by seeds.",
      mitigation:
        "Disable seed-only mode periodically for discovery checks when targets are reachable.",
    });
  }

  if (documents.length === 0) {
    blockers.push({
      title: "Policy discovery returned zero usable documents",
      severity: "high",
      summary:
        "The current crawler did not retrieve any DOE or ERC policy documents from the tested entry points.",
      impact:
        "Phase 3 is still the dominant delivery risk and should not be treated as solved.",
      mitigation:
        "Treat policy crawling as a scoped spike first, then renegotiate timeline or deliver metadata-only coverage.",
    });
  }

  if (pdfRatio >= 0.4) {
    blockers.push({
      title: "PDF-heavy policy corpus",
      severity: "high",
      summary:
        "A large share of discovered documents are PDFs, which limits quick metadata extraction.",
      impact:
        "You may need OCR or at least a PDF text extraction pass to support search and newsletter drafting.",
      mitigation:
        "Scope beta to metadata-first plus manual review, or budget extra time for PDF parsing.",
    });
  }

  if (jsCount > 0) {
    blockers.push({
      title: "Some policy pages appear JavaScript-dependent",
      severity: jsCount > 4 ? "high" : "medium",
      summary: `${jsCount} discovered policy pages look like app shells or very low-content HTML.`,
      impact: "Plain fetch plus cheerio will not be reliable for those pages.",
      mitigation:
        "Add Playwright only for flagged pages instead of for the entire crawler.",
    });
  }

  if (allowPlaywright && usedPlaywrightCount > 0) {
    blockers.push({
      title: "Playwright fallback was used for blocked or JS-heavy pages",
      severity: usedPlaywrightCount > 5 ? "medium" : "low",
      summary: `${usedPlaywrightCount} pages required browser rendering fallback in this run.`,
      impact:
        "Policy ingestion will be slower and heavier if this trend continues.",
      mitigation:
        "Use Playwright selectively only for flagged URLs and keep plain HTTP for the rest.",
    });
  }

  if (allowPlaywright && playwrightUnavailableDetected) {
    blockers.push({
      title: "Playwright mode enabled but runtime package is unavailable",
      severity: "medium",
      summary:
        "The crawler attempted Playwright fallback, but the package was not available in this environment.",
      impact:
        "JS-heavy pages may remain inaccessible without browser rendering support.",
      mitigation:
        "Install Playwright and browser binaries before relying on rendered fallback mode.",
    });
  }

  if (blockedCount > 0) {
    blockers.push({
      title: "Some policy links failed or looked blocked",
      severity: blockedCount > 4 ? "high" : "medium",
      summary: `${blockedCount} discovered links returned failures or suspicious access responses.`,
      impact:
        "Crawler stability will depend on retries, caching, and tighter selectors.",
      mitigation:
        "Keep a curated list-page strategy and persist successful URLs locally.",
    });
  }

  const durationMs = sourceHealth.reduce(
    (sum, item) => sum + item.durationMs,
    0,
  );
  const markdown = buildPolicyMarkdown(
    documents,
    sourceHealth,
    blockers,
    durationMs,
  );

  await writeDataJson("policy-link-cache.json", nextLinkCache);

  state.policyDocuments = documents;
  state.sourceHealth = [
    ...state.sourceHealth.filter(
      (item) =>
        !policySources.some((source) => item.url.startsWith(source.baseUrl)),
    ),
    ...sourceHealth,
  ];
  state.artifacts.policyFindings = markdown;
  state.phaseSummaries.policy = {
    name: "Phase 3 — Policy Crawler",
    status: "completed",
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs,
    itemCount: documents.length,
    summary: `Discovered ${documents.length} policy candidates with ${documents.filter((doc) => doc.isPdf).length} PDFs, ${jsCount} JS-risk pages, cache-backed fallback ${usedSeedFallback ? "enabled" : "not needed"}, retry=${retryCount}, seedOnly=${seedOnlyMode}.`,
    blockers,
  };

  return state;
}
