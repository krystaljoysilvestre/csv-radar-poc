"""Tests for policy crawlers (Phase 3)."""
import pytest
from crawlers.base import BaseCrawler


class MockPolicyCrawler(BaseCrawler):
    """Mock policy crawler for testing."""

    def fetch_list(self):
        return [
            "https://example.com/policy1",
            "https://example.com/policy2",
        ]

    def fetch_document(self, url):
        return {
            "url": url,
            "title": f"Policy from {url}",
            "content": "Sample policy content",
        }

    def parse_document(self, raw_doc):
        return {
            "title": raw_doc["title"],
            "url": raw_doc["url"],
            "document_text": raw_doc["content"],
            "doc_type": "Circular",
            "published_at": None,
            "source": self.name,
            "metadata": {},
        }


def test_base_crawler_rate_limiting():
    """Test rate limiting mechanism."""
    import time
    crawler = MockPolicyCrawler(name="test", base_url="https://example.com", rate_limit_rps=10)
    start = time.time()
    crawler._rate_limit()
    crawler._rate_limit()
    elapsed = time.time() - start
    # Should have minimal delay for high RPS
    assert elapsed < 1.0


def test_base_crawler_normalization():
    """Test document normalization."""
    crawler = MockPolicyCrawler(name="test", base_url="https://example.com")
    docs = [
        {
            "title": "  Policy 1  ",
            "url": "https://example.com/1",
            "doc_type": "Circular",
        }
    ]
    normalized = crawler.normalize(docs)
    assert normalized[0]["title"] == "Policy 1"  # Trimmed


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
