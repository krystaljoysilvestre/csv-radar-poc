# CSV Radar POC — Final Findings Report

## Verdict

- Recommendation: Do not commit without scope changes
- Confidence score: 35%
- News pipeline: Fetched 24 feed items and stored 24 unique articles across 2 sources.
- Policy pipeline: Discovered 6 policy candidates with 0 PDFs, 3 JS-risk pages, cache-backed fallback enabled, retry=4, seedOnly=true.

## Why This Stack Fits You Better

- The POC is now TypeScript-first, with a React dashboard and a small Node backend.
- You can iterate on both the UI and the crawler logic without switching languages.
- The reports are generated from the same runtime data the UI shows, so presentation and evidence stay aligned.

## Negotiation Notes

- Government entry pages are blocking direct fetches: 6 DOE/ERC entry pages returned failures before document discovery could even begin. Mitigation: Expect a second pass with browser automation, alternate public endpoints, or a manually curated seed list.
- Seed URL fallback was required: The crawler had to rely on curated/cached links for at least one source page. Mitigation: Keep a maintained seed list and continue persisting successful URLs as crawl cache.
- Seed-only crawler mode is enabled: Phase 3 skipped entry-page discovery and used only curated/cached links. Mitigation: Disable seed-only mode periodically for discovery checks when targets are reachable.
- Some policy pages appear JavaScript-dependent: 3 discovered policy pages look like app shells or very low-content HTML. Mitigation: Add Playwright only for flagged pages instead of for the entire crawler.
- Some policy links failed or looked blocked: 6 discovered links returned failures or suspicious access responses. Mitigation: Keep a curated list-page strategy and persist successful URLs locally.

## Recommendation to Martin

- Keep the beta narrow: ingest news reliably, capture policy metadata reliably, and defer expensive OCR or browser automation unless required by the POC evidence.
- Tie milestone acceptance to observable outputs: item counts, report freshness, and dashboard visibility.
- Keep a contingency on policy extraction because government sites can change structure without warning.
