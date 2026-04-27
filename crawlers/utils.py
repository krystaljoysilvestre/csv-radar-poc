"""Utilities for policy crawlers."""
from datetime import datetime
from models import get_session, PolicyDocument, ScraperLog
import structlog

logger = structlog.get_logger()


def log_crawler_run(
    crawler_name: str,
    status: str,
    items_fetched: int,
    items_stored: int,
    items_deduplicated: int = 0,
    errors: str = "",
    performance_ms: int = 0,
):
    """
    Log crawler execution to database.

    Args:
        crawler_name: Name of crawler
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
            scraper_name=crawler_name,
            scraper_type="policy_crawler",
            status=status,
            items_fetched=items_fetched,
            items_stored=items_stored,
            items_deduplicated=items_deduplicated,
            errors=errors,
            performance_ms=performance_ms,
        )
        session.add(log)
        session.commit()
        logger.info("crawler_logged", crawler_name=crawler_name, status=status)
    except Exception as e:
        logger.error("crawler_log_failed", error=str(e))
    finally:
        session.close()


def store_documents(documents: list) -> tuple[int, int]:
    """
    Store policy documents to database, handling deduplication.

    Args:
        documents: List of document dictionaries

    Returns:
        Tuple of (stored_count, deduplicated_count)
    """
    session = get_session()
    stored_count = 0
    dedup_count = 0

    try:
        for doc in documents:
            # Try to find existing by URL (primary dedup key)
            existing = session.query(PolicyDocument).filter(
                PolicyDocument.url == doc["url"]
            ).first()

            if existing:
                dedup_count += 1
                logger.debug("document_deduplicated", url=doc["url"])
            else:
                new_doc = PolicyDocument(**doc)
                session.add(new_doc)
                stored_count += 1

        session.commit()
        logger.info("documents_stored", stored=stored_count, deduplicated=dedup_count)
        return stored_count, dedup_count

    except Exception as e:
        session.rollback()
        logger.error("documents_store_failed", error=str(e))
        return 0, 0
    finally:
        session.close()


def get_recent_documents(source: str = None, days: int = 30, limit: int = 50) -> list:
    """
    Get recently crawled policy documents.

    Args:
        source: Filter by source ('DOE', 'ERC', or None for all)
        days: Fetch documents from last N days
        limit: Max results

    Returns:
        List of documents
    """
    session = get_session()
    try:
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=days)

        query = session.query(PolicyDocument).filter(
            PolicyDocument.fetched_at >= cutoff
        )
        if source:
            query = query.filter(PolicyDocument.source == source)

        documents = query.order_by(
            PolicyDocument.fetched_at.desc()
        ).limit(limit).all()

        return [d.to_dict() for d in documents]
    except Exception as e:
        logger.error("get_documents_failed", error=str(e))
        return []
    finally:
        session.close()


def get_statistics() -> dict:
    """
    Get crawling statistics.

    Returns:
        Dictionary with counts and metrics
    """
    session = get_session()
    try:
        total_articles = session.query(NewsArticle).count()
        total_docs = session.query(PolicyDocument).count()
        doe_docs = session.query(PolicyDocument).filter(
            PolicyDocument.source == "DOE"
        ).count()
        erc_docs = session.query(PolicyDocument).filter(
            PolicyDocument.source == "ERC"
        ).count()

        return {
            "total_news_articles": total_articles,
            "total_policy_documents": total_docs,
            "doe_documents": doe_docs,
            "erc_documents": erc_docs,
        }
    except Exception as e:
        logger.error("get_statistics_failed", error=str(e))
        return {}
    finally:
        session.close()
