"""Utilities for news scrapers."""
from datetime import datetime
from models import get_session, NewsArticle, ScraperLog
import structlog

logger = structlog.get_logger()


def log_scraper_run(
    scraper_name: str,
    status: str,
    items_fetched: int,
    items_stored: int,
    items_deduplicated: int = 0,
    errors: str = "",
    performance_ms: int = 0,
):
    """
    Log scraper execution to database.

    Args:
        scraper_name: Name of scraper
        status: 'success', 'error', or 'partial'
        items_fetched: Number of items fetched
        items_stored: Number of items successfully stored
        items_deduplicated: Number deduplicated
        errors: Error message if applicable
        performance_ms: Execution time in milliseconds
    """
    try:
        session = get_session()
        log = ScraperLog(
            scraper_name=scraper_name,
            scraper_type="news_scraper",
            status=status,
            items_fetched=items_fetched,
            items_stored=items_stored,
            items_deduplicated=items_deduplicated,
            errors=errors,
            performance_ms=performance_ms,
        )
        session.add(log)
        session.commit()
        logger.info("scraper_logged", scraper_name=scraper_name, status=status)
    except Exception as e:
        logger.error("scraper_log_failed", error=str(e))
    finally:
        session.close()


def store_articles(articles: list) -> tuple[int, int]:
    """
    Store articles to database, handling deduplication.

    Args:
        articles: List of article dictionaries

    Returns:
        Tuple of (stored_count, deduplicated_count)
    """
    session = get_session()
    stored_count = 0
    dedup_count = 0

    try:
        for article in articles:
            # Try to find existing by URL
            existing = session.query(NewsArticle).filter(
                NewsArticle.url == article["url"]
            ).first()

            if existing:
                dedup_count += 1
                logger.debug("article_deduplicated", url=article["url"])
            else:
                new_article = NewsArticle(**article)
                session.add(new_article)
                stored_count += 1

        session.commit()
        logger.info("articles_stored", stored=stored_count, deduplicated=dedup_count)
        return stored_count, dedup_count

    except Exception as e:
        session.rollback()
        logger.error("articles_store_failed", error=str(e))
        return 0, 0
    finally:
        session.close()


def get_recent_articles(hours: int = 24, limit: int = 50) -> list:
    """
    Get recently fetched articles.

    Args:
        hours: Fetch articles from last N hours
        limit: Max results

    Returns:
        List of articles
    """
    session = get_session()
    try:
        cutoff = datetime.utcnow()
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(hours=hours)

        articles = session.query(NewsArticle).filter(
            NewsArticle.fetched_at >= cutoff
        ).order_by(NewsArticle.fetched_at.desc()).limit(limit).all()

        return [a.to_dict() for a in articles]
    except Exception as e:
        logger.error("get_articles_failed", error=str(e))
        return []
    finally:
        session.close()
