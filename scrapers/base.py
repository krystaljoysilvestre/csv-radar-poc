"""Base scraper class for news sources."""
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from datetime import datetime
import hashlib
import structlog

logger = structlog.get_logger()


class BaseNewsSource(ABC):
    """Abstract base class for news scrapers."""

    def __init__(self, name: str, url: str, timeout: int = 30):
        """
        Initialize news source scraper.

        Args:
            name: Source name (e.g., 'rappler', 'manilatimes')
            url: Base URL of the news source
            timeout: Request timeout in seconds
        """
        self.name = name
        self.url = url
        self.timeout = timeout

    @abstractmethod
    def fetch(self) -> List[Dict[str, Any]]:
        """
        Fetch raw data from the source.

        Returns:
            List of raw article data (format depends on source type)

        Raises:
            Exception: Network error, site unavailable, etc.
        """
        pass

    @abstractmethod
    def parse(self, raw_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Parse raw data into standardized format.

        Args:
            raw_data: Output from fetch()

        Returns:
            List of parsed articles with fields:
            - title (str)
            - url (str)
            - published_at (datetime or None)
            - content (str)
            - source (str): defaults to self.name
        """
        pass

    def deduplicate(self, articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Add content_hash for deduplication.

        Args:
            articles: Parsed articles

        Returns:
            Articles with added content_hash field
        """
        for article in articles:
            content = article.get("content", "") or ""
            article["content_hash"] = hashlib.sha256(content.encode()).hexdigest()
        return articles

    def normalize(self, articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Normalize article data to standard schema.

        Args:
            articles: Articles with content_hash

        Returns:
            Normalized articles ready for database storage
        """
        normalized = []
        for article in articles:
            normalized.append({
                "title": article.get("title", "").strip(),
                "source": article.get("source", self.name),
                "url": article.get("url", "").strip(),
                "published_at": article.get("published_at"),
                "content": article.get("content", "").strip(),
                "content_hash": article.get("content_hash"),
                "tags": article.get("tags", []),
            })
        return normalized

    def run(self) -> tuple[List[Dict[str, Any]], int, str]:
        """
        Full pipeline: fetch → parse → deduplicate → normalize.

        Returns:
            Tuple of (articles, items_fetched, errors)
        """
        try:
            logger.info("scraper_started", source=self.name)
            raw = self.fetch()
            parsed = self.parse(raw)
            deduped = self.deduplicate(parsed)
            normalized = self.normalize(deduped)
            logger.info("scraper_completed", source=self.name, count=len(normalized))
            return normalized, len(raw), ""
        except Exception as e:
            logger.error("scraper_failed", source=self.name, error=str(e))
            return [], 0, str(e)

    def __repr__(self):
        return f"<{self.__class__.__name__}(name={self.name}, url={self.url})>"
