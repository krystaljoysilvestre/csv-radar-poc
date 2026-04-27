# Scraping Improvements — Next Steps

## Current State

| Area | What works | Known limitation |
|---|---|---|
| News | RSS feeds via Google News parse reliably | Limited to 2 search queries; no native DOE/ERC RSS feeds |
| Policy | Cheerio-based link extraction from DOE and ERC | Most entry pages return access failures before discovery begins |
| Retry logic | Configurable retry count (0–6) via dashboard | Retries hit the same blocked endpoint repeatedly |
| JS detection | Heuristic check for app-shell patterns | Playwright is wired but disabled by default; no per-URL targeting |
| Deduplication | Hash-based deduplication on articles and policy links | No cross-run diffing to detect removed or updated documents |

---

## Priority 1 — Fix Policy Source Access

**Problem:** DOE and ERC entry pages return 403s or redirect to CAPTCHA pages before any document links are found.

**Options:**
- Add a curated `seedUrls` list of known working document index pages and skip entry-page discovery entirely when `policySeedOnly` is enabled.
- Implement request header rotation (randomised `User-Agent`, `Referer`, `Accept-Language`) to reduce fingerprinting.
- Add a jitter delay (e.g. 1–3s random pause) between requests to avoid rate-limit triggers.
- Cache successful response bodies to `data/policy-cache/` so blocked pages fall back to the last good snapshot.

---

## Priority 2 — Targeted Playwright for JS-Dependent Pages

**Problem:** Some discovered policy pages are Angular/React app shells with no meaningful HTML. Playwright is available but runs on all pages or none.

**Options:**
- Enable Playwright only for URLs where `requiresJs` was detected on a previous run.
- Store a `requiresJs` flag per URL in `data/policy-links.json` and use it as a routing signal.
- Use Playwright's `page.waitForSelector` on a known document link pattern rather than waiting for full page load.
- Limit concurrent Playwright sessions to 1–2 to avoid memory pressure.

---

## Priority 3 — Expand News Coverage

**Problem:** Both current news sources are Google News RSS aggregations of the same topic. Original source feeds are not used.

**Options:**
- Add direct RSS/Atom feeds from Philippine energy news outlets (e.g. BusinessWorld, Manila Bulletin energy section, Rappler Business).
- Add DOE and ERC announcements pages as monitored URLs (polled on a schedule, not just on-demand).
- Implement keyword scoring on article titles to filter noise from off-topic energy articles.
- Store article body text (not just title and summary) for richer downstream analysis.

---

## Priority 4 — Structured Policy Document Extraction

**Problem:** Policy documents are discovered as URLs but content is not extracted. PDF and HTML documents are treated the same way.

**Options:**
- Use `pdf-parse` or a similar library to extract text from PDF links into a searchable field.
- For HTML policy pages, extract the main content block using Cheerio and store a cleaned text summary.
- Add a `contentHash` field so each run can detect when a previously seen document has been updated.
- Tag documents with detected effective dates parsed from filenames or page text.

---

## Priority 5 — Scheduling and Freshness

**Problem:** All collection runs are manual and on-demand. There is no indication of how stale the data is.

**Options:**
- Add a cron-style runner (e.g. `node-cron`) to trigger news collection every 6 hours and policy collection daily.
- Surface a "last collected" timestamp per source in the dashboard alongside the article/document count.
- Add a staleness warning to the dashboard when data is older than a configurable threshold.
- Write incremental updates to state rather than full overwrites so partial run failures do not lose existing data.

---

## Low Priority / Later

- **Pagination support** — some DOE/ERC index pages have multi-page listings that are not currently traversed.
- **Attachment discovery** — policy pages often link to `.docx` or `.zip` files in addition to PDFs.
- **Source health monitoring** — persist source health results across runs to detect degradation trends over time.
- **Alert on new documents** — emit a webhook or write a diff file when a new policy document is detected that was not in the previous run.
