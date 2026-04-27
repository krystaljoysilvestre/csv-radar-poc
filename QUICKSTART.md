# Quick Start Guide

## Step 1: Clone/Setup Repository

```bash
cd ~/Desktop/csv-radar-poc
git init
git add .
git commit -m "Initial POC structure"
```

## Step 2: Set Up Python Environment

```bash
python3.11 -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Optional: Install playwright for JS rendering detection
pip install playwright
playwright install chromium
```

## Step 3: Set Up Database

### Option A: Using Docker

```bash
docker-compose up -d

# Check PostgreSQL is running
docker ps | grep postgres

# Initialize schema
PGPASSWORD=postgres psql -h localhost -U postgres -f schema/init.sql
```

### Option B: Using Local PostgreSQL

```bash
# Ensure PostgreSQL is running locally
psql -U postgres -d csv_radar_poc -f schema/init.sql
```

### Option C: Just Run (Auto-init)

```bash
python -c "from models import init_db; init_db()"
```

## Step 4: Verify Setup

```bash
# Check database connection
python -c "from models import SessionLocal; session = SessionLocal(); print('Database OK')"

# Run quick database test
psql -U postgres -d csv_radar_poc -c "SELECT COUNT(*) FROM news_articles;"
```

## Step 5: Run Phase 1 Site Analysis

```bash
python -m analysis.site_inspector

# This will:
# 1. Inspect DOE and ERC sites
# 2. Generate ANALYSIS.md report
# 3. Print findings to console
```

## Step 6: Review Phase 1 Findings

```bash
cat ANALYSIS.md
```

Check for:

- ✅ Site accessibility (HTTP status)
- ✅ robots.txt restrictions
- ✅ JavaScript framework detection (critical blocker!)
- ✅ Pagination indicators
- ✅ Sample links

---

## What's Included (Phase 1 Complete)

### Configuration Files

- `.env.example` — Config template (copy to `.env`)
- `docker-compose.yml` — PostgreSQL setup
- `requirements.txt` — Python dependencies
- `.gitignore` — Git ignore rules

### Database

- `schema/init.sql` — Our schema (run to initialize)

### Python Modules

1. **`models/`** — ORM Models

   - `database.py` — SQLAlchemy setup
   - `news_article.py` — NewsArticle model
   - `policy_document.py` — PolicyDocument model
   - `scraper_log.py` — ScraperLog model

2. **`scrapers/`** — News Source Framework

   - `base.py` — BaseNewsSource abstract class
   - `utils.py` — Utilities (store_articles, logging)

3. **`crawlers/`** — Policy Crawler Framework

   - `base.py` — BaseCrawler abstract class
   - `utils.py` — Utilities (store_documents, logging)

4. **`analysis/`** — Phase 1 Inspection

   - `site_inspector.py` — Automated site analysis tool
   - `main()` → generates ANALYSIS.md

5. **`pipeline/`** — Orchestration

   - `main.py` — CSVRadarPipeline (used in Phase 4+)

6. **`tests/`** — Testing Framework
   - `test_news_scraper.py` — Mock scraper tests
   - `test_policy_crawler.py` — Mock crawler tests
   - `fixtures/` — Sample HTML (to be populated)

### Documentation

- `README.md` — Overview
- `ARCHITECTURE.md` — Design decisions
- `ANALYSIS.md` — Phase 1 findings (generated)

---

## Phase 2: Start Building News Scraper

After Phase 1, create concrete scrapers in `scrapers/`:

```python
# Example: scrapers/rappler_scraper.py
from scrapers.base import BaseNewsSource

class RapplerScraper(BaseNewsSource):
    def fetch(self):
        # Fetch Rappler news (RSS or HTML)
        pass

    def parse(self, raw_data):
        # Extract title, url, content, date
        pass
```

Then test:

```bash
pytest tests/test_news_scraper.py -v
```

---

## Phase 3: Build Policy Crawlers

After Phase 1 findings, create crawlers in `crawlers/`:

```python
# Example: crawlers/doe_crawler.py
from crawlers.base import BaseCrawler

class DOECrawler(BaseCrawler):
    def fetch_list(self):
        # Get list of DOE policies
        pass

    def fetch_document(self, url):
        # Fetch individual policy
        pass

    def parse_document(self, raw_doc):
        # Extract title, date, doc_type
        pass
```

Then test:

```bash
pytest tests/test_policy_crawler.py -v
```

---

## Useful Commands

```bash
# Activate venv
source venv/bin/activate

# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_news_scraper.py -v

# Check database records
psql -U postgres -d csv_radar_poc -c "SELECT COUNT(*) FROM news_articles; SELECT COUNT(*) FROM policy_documents;"

# View recent articles
psql -U postgres -d csv_radar_poc -c "SELECT title, url, fetched_at FROM news_articles ORDER BY fetched_at DESC LIMIT 5;"

# Generate analysis report
python -m analysis.site_inspector

# Check database statistics
python -c "from crawlers.utils import get_statistics; print(get_statistics())"
```

---

## Troubleshooting

### ModuleNotFoundError: No module named 'models'

```bash
# Make sure you're in the project root directory
cd ~/Desktop/csv-radar-poc

# And venv is activated
source venv/bin/activate
```

### PostgreSQL Connection Error

```bash
# Check if container is running
docker ps | grep postgres

# Restart container
docker-compose restart

# Or ensure local PostgreSQL is running
psql -U postgres -d csvradar_poc
```

### Missing .env file

```bash
cp .env.example .env
# Edit .env with your DATABASE_URL if needed
```

---

## Next Steps

1. ✅ **Phase 1**: Run `python -m analysis.site_inspector` (DONE: generates ANALYSIS.md)
2. 🔄 **Phase 2**: Build news scrapers (rappler, manilatimes, etc.)
3. 🔄 **Phase 3**: Build policy crawlers (DOE, ERC)
4. 🔄 **Phase 4**: Run full pipeline + performance tests
5. 🔄 **Phase 5**: Generate FINDINGS_REPORT.md for Martin

---

## Questions?

Refer to:

- `README.md` — Project overview
- `ARCHITECTURE.md` — Design decisions
- `tests/` — Example implementations
