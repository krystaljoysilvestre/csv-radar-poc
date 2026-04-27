"""Tests for news scrapers (Phase 2)."""
import pytest
from scrapers.base import BaseNewsSource


class MockNewsSource(BaseNewsSource):
    """Mock news source for testing."""

    def fetch(self):
        return [
            {
                "url": "https://example.com/news1",
                "title": "Test Article 1",
                "content": "Sample content 1",
                "published": "2024-01-01",
            }
        ]

    def parse(self, raw_data):
        results = []
        for item in raw_data:
            results.append({
                "title": item["title"],
                "url": item["url"],
                "content": item["content"],
                "published_at": item.get("published"),
                "source": self.name,
            })
        return results


def test_base_news_source_deduplication():
    """Test content deduplication."""
    source = MockNewsSource(name="test", url="https://example.com")
    articles = [
        {
            "title": "Article 1",
            "content": "Content A",
            "url": "https://example.com/1",
        },
        {
            "title": "Article 1 Duplicate",
            "content": "Content A",  # Same content
            "url": "https://example.com/2",
        },
    ]
    deduped = source.deduplicate(articles)
    assert deduped[0]["content_hash"] == deduped[1]["content_hash"]


def test_base_news_source_normalization():
    """Test article normalization."""
    source = MockNewsSource(name="test", url="https://example.com")
    articles = [
        {
            "title": "  Article 1  ",
            "content": "Content",
            "url": "https://example.com/1",
        }
    ]
    normalized = source.normalize(articles)
    assert normalized[0]["title"] == "Article 1"  # Trimmed


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
