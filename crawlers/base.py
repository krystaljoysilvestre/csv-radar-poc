"""Base crawler class for policy documents."""
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime
import time
import structlog

logger = structlog.get_logger()


class BaseCrawler(ABC):
    """Abstract base class for policy crawlers with rate limiting."""

    def __init__(
        self,
        name: str,
        base_url: str,
        timeout: int = 60,
        rate_limit_rps: float = 2.0,
        max_retries: int = 3,
    ):
        """
        Initialize crawler.

        Args:
            name: Crawler name (e.g., 'doe_crawler', 'erc_crawler')
            base_url: Base URL of the source
            timeout: Request timeout in seconds
            rate_limit_rps: Requests per second (rate limiting)
            max_retries: Max retry attempts on failure
        """
        self.name = name
        self.base_url = base_url
        self.timeout = timeout
        self.rate_limit_rps = rate_limit_rps
        self.max_retries = max_retries
        self.last_request_time = 0

    def _rate_limit(self):
        """Apply rate limiting before next request."""
        elapsed = time.time() - self.last_request_time
        min_interval = 1.0 / self.rate_limit_rps
        if elapsed < min_interval:
            time.sleep(min_interval - elapsed)
        self.last_request_time = time.time()

    @abstractmethod
    def fetch_list(self) -> List[str]:
        """
        Fetch list of document URLs to crawl.

        Returns:
            List of document URLs (absolute or relative)

        Raises:
            Exception on network/parsing error
        """
        pass

    @abstractmethod
    def fetch_document(self, url: str) -> Dict[str, Any]:
        """
        Fetch individual document.

        Args:
            url: Document URL

        Returns:
            Raw document data (depends on source)

        Raises:
            Exception on network/parsing error
        """
        pass

    @abstractmethod
    def parse_document(self, raw_doc: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse document into standardized format.

        Args:
            raw_doc: Raw document data from fetch_document()

        Returns:
            Parsed document with fields:
            - title (str)
            - url (str)
            - doc_type (str): 'Circular', 'Executive Order', etc.
            - published_at (datetime or None)
            - document_text (str or None)
            - metadata (dict): flexible metadata storage
            - source (str): defaults to self.name
        """
        pass

    def normalize(self, documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Normalize document data to standard schema.

        Args:
            documents: Parsed documents

        Returns:
            Normalized documents ready for database storage
        """
        normalized = []
        for doc in documents:
            normalized.append({
                "title": doc.get("title", "").strip(),
                "source": doc.get("source", self.name),
                "doc_type": doc.get("doc_type", "").strip(),
                "url": doc.get("url", "").strip(),
                "published_at": doc.get("published_at"),
                "document_text": doc.get("document_text", "").strip() if doc.get("document_text") else None,
                "metadata": doc.get("metadata", {}),
            })
        return normalized

    def run(self, max_documents: Optional[int] = None) -> Tuple[List[Dict[str, Any]], int, int, str]:
        """
        Full pipeline: fetch list → fetch each → parse → normalize.

        Args:
            max_documents: Limit number of documents to crawl (for POC)

        Returns:
            Tuple of (documents, total_fetched, documents_stored, errors)
        """
        try:
            logger.info("crawler_started", crawler=self.name)

            # Fetch list of URLs
            urls = self.fetch_list()
            if max_documents:
                urls = urls[:max_documents]
            logger.info("crawler_urls_fetched", crawler=self.name, count=len(urls))

            # Fetch and parse each document
            documents = []
            fetched = 0
            errors = []

            for i, url in enumerate(urls):
                try:
                    self._rate_limit()
                    raw_doc = self.fetch_document(url)
                    fetched += 1
                    parsed_doc = self.parse_document(raw_doc)
                    documents.append(parsed_doc)
                except Exception as e:
                    errors.append(f"URL {url}: {str(e)}")
                    logger.warning("crawler_document_error", url=url, error=str(e))

            # Normalize
            normalized = self.normalize(documents)
            error_msg = "; ".join(errors) if errors else ""
            logger.info("crawler_completed", crawler=self.name, fetched=fetched, stored=len(normalized))

            return normalized, fetched, len(normalized), error_msg

        except Exception as e:
            logger.error("crawler_failed", crawler=self.name, error=str(e))
            return [], 0, 0, str(e)

    def __repr__(self):
        return f"<{self.__class__.__name__}(name={self.name}, base_url={self.base_url})>"
