# CSV Radar POC

TypeScript proof-of-concept for validating news and policy data collection, surfacing blockers, and generating stakeholder-facing summaries in a single dashboard.

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Express + TypeScript
- Parsers: rss-parser, cheerio
- Optional browser fallback: Playwright (runtime-loaded)
- Storage: local JSON state in `data/runtime.json`

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+

### Install and run

```bash
cd csv-radar-poc
npm install
npm run dev
```

Open `http://localhost:5173` for the Vite client (API proxied to the backend).

## Build and production run

```bash
npm run lint
npm run build
npm start
```

Production server runs on `http://localhost:8787` and serves both API + built client.

## Current Workflow

Data is fetched on-demand from the dashboard controls:

- `Run analysis`
- `Run news collection`
- `Run policy collection`
- `Run system health`
- `Generate final recommendation`
- `Run all steps`

There is no scheduler yet. Freshness is tied to the latest manual run.

## Fresh Data and Date Range

### News collection

- Pulls up to 12 items per configured RSS source per run.
- Uses source-provided publish fields (`isoDate` or `pubDate`) when available.
- No explicit date filter is applied in code; recency depends on what each feed returns.
- In practice this is usually recent items, often around 1 to 7 days, but source-dependent.

### Policy collection

- Crawls configured DOE/ERC entry paths and seed URLs.
- Discovers current links visible at crawl time; no global date-range filter exists.
- `publishedAt` is often missing unless present in extractable source metadata.
- Seed-only mode can constrain discovery to curated URLs for safer repeated runs.

## Dashboard Highlights

- Summary cards and decision badge (`Go` / `Conditional Go` / `Hold`)
- Coverage scorecards (news, policy, confidence)
- Collection views:
	- News articles list (title, source, publish date, tags)
	- Policy documents list (source, doc type, status badges)
- Blockers panel (severity, impact, mitigation)
- Advanced controls:
	- Retry count
	- Seed-only mode
	- Optional phase-by-phase execution

## API Endpoints

- `GET /api/state` - fetch full dashboard state
- `POST /api/config` - update runtime options
- `POST /api/run/analysis`
- `POST /api/run/news`
- `POST /api/run/policy`
- `POST /api/run/performance`
- `POST /api/run/report`
- `POST /api/run/all`

## Key Files

- `src/client/App.tsx` - main dashboard UI
- `src/client/styles.css` - dashboard styles
- `src/server/index.ts` - API server and static hosting
- `src/server/phases/news.ts` - RSS ingest phase
- `src/server/phases/policy.ts` - policy crawl phase
- `src/server/phases/reports.ts` - report generation
- `src/server/phases/pipeline.ts` - run orchestration
- `src/server/lib/storage.ts` - state persistence
- `data/runtime.json` - persisted runtime state

## Documentation

- `ARCHITECTURE.md`
- `ANALYSIS.md`
- `NEWS_FINDINGS.md`
- `POLICY_FINDINGS.md`
- `PERFORMANCE.md`
- `FINDINGS_REPORT.md`
- `SCRAPING_IMPROVEMENTS.md`
