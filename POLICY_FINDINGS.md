# Phase 3: Policy Crawler Findings

## Summary

- Sources tested: 2
- Candidate documents stored: 6
- Run duration: 0ms
- PDFs detected: 0
- JS-dependent pages detected: 3

## Source Health

| Source                            | Status | HTTP | Duration | Notes                                                               |
| --------------------------------- | ------ | ---- | -------- | ------------------------------------------------------------------- |
| DOE /                             | Failed | 0    | 0ms      | 3 candidate links; Potential JS-heavy shell; Seed-only mode enabled |
| DOE /laws-and-issuances           | Failed | 0    | 0ms      | 3 candidate links; Potential JS-heavy shell; Seed-only mode enabled |
| DOE /energy-virtual-one-stop-shop | Failed | 0    | 0ms      | 3 candidate links; Potential JS-heavy shell; Seed-only mode enabled |
| ERC /                             | Failed | 0    | 0ms      | 3 candidate links; Potential JS-heavy shell; Seed-only mode enabled |
| ERC /Pages/Issuances.aspx         | Failed | 0    | 0ms      | 3 candidate links; Potential JS-heavy shell; Seed-only mode enabled |
| ERC /ContentPage/47               | Failed | 0    | 0ms      | 3 candidate links; Potential JS-heavy shell; Seed-only mode enabled |

## Sample Documents

- Seed URL (DOE, Document, text/html; charset=UTF-8)
- Seed URL (DOE, Document, text/html; charset=UTF-8)
- Seed URL (DOE, Document, text/html; charset=UTF-8)
- Seed URL (ERC, Document, text/plain)
- Seed URL (ERC, Document, text/plain)
- Seed URL (ERC, Document, text/plain)

## Blockers

### Government entry pages are blocking direct fetches

- Severity: high
- Impact: A plain server-side fetch approach is unlikely to be enough for the policy slice as-is.
- Mitigation: Expect a second pass with browser automation, alternate public endpoints, or a manually curated seed list.

### Seed URL fallback was required

- Severity: medium
- Impact: Entry-page discovery is still brittle and may break whenever government site structure changes.
- Mitigation: Keep a maintained seed list and continue persisting successful URLs as crawl cache.

### Seed-only crawler mode is enabled

- Severity: low
- Impact: This improves reliability but may miss newly published documents not covered by seeds.
- Mitigation: Disable seed-only mode periodically for discovery checks when targets are reachable.

### Some policy pages appear JavaScript-dependent

- Severity: medium
- Impact: Plain fetch plus cheerio will not be reliable for those pages.
- Mitigation: Add Playwright only for flagged pages instead of for the entire crawler.

### Some policy links failed or looked blocked

- Severity: high
- Impact: Crawler stability will depend on retries, caching, and tighter selectors.
- Mitigation: Keep a curated list-page strategy and persist successful URLs locally.
