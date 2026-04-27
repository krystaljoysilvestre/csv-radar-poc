# CSV Radar POC — Architecture & Design Decisions

## Overview

CSV Radar POC is a validation project to assess the technical feasibility of building an automated news and policy document ingestion pipeline for energy and policy intelligence. The project runs in 5 phases over ~1 week, ending with a findings report to inform the ₱80,000 engagement proposal.

## Architecture Goals

1. **Modular Design**: News scrapers and policy crawlers are independently testable
2. **Database-Backed**: PostgreSQL for durability and queryability; SQLAlchemy ORM for flexibility
3. **Observability**: Structured logging and execution tracking via `ScraperLog` table
4. **Defensive**: Rate limiting, retry logic, and error recovery built in
5. **Testable**: Mock fixtures for reproducible testing without hitting live sites
6. **Scalable Template**: Code structure is production-ready (extensible to Phase 2 real implementation)

## Data Model

### news_articles

```
id               | UUID (PK)
title            | String(500)
source           | String(255)    # 'rappler', 'manilatimes', etc.
url              | Text (UNIQUE)
published_at     | DateTime (TZ)
content          | Text
content_hash     | String(64)     # SHA256 for deduplication
tags             | String[]       # Optional tagging
fetched_at       | DateTime (TZ, auto)
updated_at       | DateTime (TZ, auto)
status           | String(50)     # 'active', 'archived', etc.
```

**Indexes**: source, published_at DESC, fetched_at DESC, content_hash, (url + content_hash) UNIQUE

**Strategy**: URL is primary dedup key; content_hash is secondary for detecting reposts.

---

### policy_documents

```
id               | UUID (PK)
title            | String(500)
source           | String(100)    # 'DOE', 'ERC'
doc_type         | String(100)    # 'Circular', 'Executive Order', 'PPA', etc.
url              | Text (UNIQUE)
published_at     | DateTime (TZ)
document_text    | Text           # Full text (if HTML) or NULL (if PDF)
metadata         | JSONB          # Flexible: format, pages, doc_number, etc.
fetched_at       | DateTime (TZ, auto)
updated_at       | DateTime (TZ, auto)
status           | String(50)
```

**Indexes**: source, doc_type, published_at DESC, fetched_at DESC, (source + doc_type)

**Strategy**: URL is primary dedup key. JSONB metadata allows flexible storage of format (PDF/HTML), page count, document number, etc. without schema changes.

---

### scraper_logs

```
id                | UUID (PK)
scraper_name      | String(100)   # E.g., 'rappler_scraper', 'doe_crawler_v1'
scraper_type      | String(50)    # 'news_scraper' or 'policy_crawler'
run_at            | DateTime (TZ, auto)
status            | String(50)    # 'success', 'error', 'partial'
items_fetched     | Int
items_stored      | Int
items_deduplicated| Int
errors            | Text          # Error messages
performance_ms    | Int           # Execution time
notes             | Text          # Arbitrary notes
```

**Purpose**: Track scraper/crawler health, performance trends, and debug failures.

---

## Code Structure

### Scrapers (`scrapers/`)

**Base Class**: `BaseNewsSource(ABC)`

- Abstract methods: `fetch()`, `parse()`
- Concrete methods: `deduplicate()`, `normalize()`, `run()`
- Pattern: Each news source (Rappler, Manilatimes, etc.) extends this class

**Flow**:

```
BaseNewsSource
├─ fetch()       → Retrieve raw data (RSS feed or HTML)
├─ parse()       → Extract: title, url, content, published_at
├─ deduplicate() → Add content_hash for dedup
├─ normalize()   → Standardize schema
└─ run()         → Orchestrate all steps
    → returns (articles, items_fetched, errors)
```

**Examples** (Phase 2):

- `RSSFetcher` — Parse RSS feeds (if available)
- `HTMLNewsSource` — Scrape HTML articles (requests + BeautifulSoup4)

### Crawlers (`crawlers/`)

**Base Class**: `BaseCrawler(ABC)`

- Abstract methods: `fetch_list()`, `fetch_document()`, `parse_document()`
- Concrete methods: `normalize()`, `run()`, `_rate_limit()`
- Pattern: Each government source (DOE, ERC) extends this class
- Features:
  - Built-in rate limiting (configurable RPS)
  - Retry logic with exponential backoff
  - Per-document error handling

**Flow**:

```
BaseCrawler
├─ fetch_list()      → Get list of document URLs (with pagination)
├─ fetch_document()  → Fetch individual document (with rate limiting)
├─ parse_document()  → Extract: title, url, doc_type, published_at
├─ normalize()       → Standardize schema
└─ run()             → Orchestrate; loop through docs
    → returns (documents, fetched, stored, errors)
```

**Examples** (Phase 3):

- `DOECrawler` — Crawl DOE policies
- `ERCCrawler` — Crawl ERC circulars

### Models (`models/`)

**Database Setup**:

- `database.py`: SQLAlchemy engine, sessions, Base class
- `init_db()`: Create tables on first run

**ORM Models**:

- `NewsArticle` — news_articles table
- `PolicyDocument` — policy_documents table
- `ScraperLog` — scraper_logs table

Each model has:

- SQLAlchemy columns with types and constraints
- `__repr__()` for debugging
- `to_dict()` for JSON serialization

### Utilities

**`scrapers/utils.py`**:

- `log_scraper_run()` — Record execution in DB
- `store_articles()` — Dedup + insert articles
- `get_recent_articles()` — Query helper

**`crawlers/utils.py`**:

- `log_crawler_run()` — Record execution in DB
- `store_documents()` — Dedup + insert documents
- `get_recent_documents()` — Query helper
- `get_statistics()` — Summary stats

### Pipeline (`pipeline/`)

**`CSVRadarPipeline` class**:

- `run_news_scrapers(scrapers)` — Execute all scrapers sequentially
- `run_policy_crawlers(crawlers)` — Execute all crawlers sequentially
- `run_full_pipeline()` — Both + statistics
- `print_results()` — Formatted output

Used in Phase 4 (integration testing).

### Analysis (`analysis/`)

**`SiteInspector` class** (Phase 1):

- `inspect_site(name, url)` → Automated feasibility check
  - HTTP reachability
  - robots.txt
  - JavaScript framework detection
  - Pagination indicators
  - Sample links
- `generate_report()` → Human-readable findings
- `main()` → Run on DOE, ERC; save to `ANALYSIS.md`

## Testing Strategy

### Unit Tests (`tests/`)

- **`test_news_scraper.py`**: Mock scraper; test dedup, normalization
- **`test_policy_crawler.py`**: Mock crawler; test rate limiting, normalization

### Fixtures

- **`tests/fixtures/`**: Sample HTML from real sites (populated during Phase 2/3)
  - `sample_news.html` — Example news article HTML
  - `sample_policy.html` — Example policy document HTML

### Execution

```bash
# Run all tests
pytest tests/ -v

# Mark tests by phase
pytest tests/ -m phase2   # Just Phase 2 tests
pytest tests/ -m phase3   # Just Phase 3 tests
```

## Configuration

**.env file**:

```env
DATABASE_URL=postgresql://...
LOG_LEVEL=INFO
SCRAPER_TIMEOUT=30
CRAWLER_TIMEOUT=60
RATE_LIMIT_REQUESTS_PER_SECOND=2
```

## Logging

Using `structlog` for structured logging:

- JSON-formatted logs for easy parsing
- Log levels: DEBUG, INFO, WARNING, ERROR
- Key events: scraper_started, items_fetched, items_stored, errors

Example:

```python
logger.info("articles_stored", stored=10, deduplicated=2, scraper="rappler")
# Output: {"event": "articles_stored", "stored": 10, "deduplicated": 2, "scraper": "rappler"}
```

## Deployment Strategy (Production, Post-POC)

For the ₱80,000 engagement (M1–M4), the POC code becomes the foundation:

**M1 — Deployment**:

- Docker setup (Dockerfile, docker-compose.yml)
- GitHub Actions CI/CD
- PostgreSQL production setup

**M2 — News Poller**:

- Extend `scrapers/` with real news sources
- Add scheduled execution (Celery/APScheduler)
- Complete storage layer

**M3 — Policy Crawlers**:

- Extend `crawlers/` with DOE + ERC crawlers
- Refine extraction logic based on POC findings
- Add classification/tagging

**M4 — Newsletter Wizard + BETA**:

- UI layer (query, edit, export)
- Deployment to production

## Key Design Decisions

| Decision                          | Rationale                                                                 |
| --------------------------------- | ------------------------------------------------------------------------- |
| **PostgreSQL over SQLite**        | Production-ready; better for concurrent writes; indexing                  |
| **SQLAlchemy ORM**                | Type-safe, migration-friendly with Alembic; not too heavyweight           |
| **BaseNewsSource/BaseCrawler**    | Standardized interface; easy to add new sources                           |
| **Rate Limiting in Base**         | Respect robots.txt and avoid blocking; critical for government sites      |
| **JSONB for Metadata**            | Flexible storage (format, pages, classification) without schema churn     |
| **Structured Logging**            | Easier debugging and monitoring in production                             |
| **Separate Scraper/Crawler Runs** | Sequential (not parallel) for simplicity; can parallelize in M2 if needed |

## Blockers to Watch

1. **JavaScript Rendering** — If DOE/ERC require JS: need Playwright (adds 2 weeks)
2. **PDFs Only** — If ERC is PDF-heavy: need OCR (complex, scope decision)
3. **Rate Limiting** — If government sites block rapid crawling: need delays/caching
4. **Government Site Stability** — If sites are intermittently down: need retry + alert logic

## Phase 1 Verdict

Phase 1 (0.5 day) runs `SiteInspector` to identify blockers upfront. Results feed into:

- Phase 2 (news scraper complexity estimate)
- Phase 3 (policy crawler approach — Playwright? OCR?)
- Negotiation with Martin (timeline, scope, fees)

---

## References

- **SQLAlchemy Docs**: https://docs.sqlalchemy.org/
- **BeautifulSoup4**: https://www.crummy.com/software/BeautifulSoup/
- **Structlog**: https://www.structlog.org/
- **Playwright**: https://playwright.dev/python/
