"""Pipeline orchestration for CSV Radar POC (Phase 4+)."""
import time
from typing import Dict, List, Any
import structlog
from models import get_session, init_db
from scrapers.utils import log_scraper_run, store_articles, get_statistics
from crawlers.utils import log_crawler_run, store_documents

logger = structlog.get_logger()


class CSVRadarPipeline:
    """Orchestrate news scrapers and policy crawlers."""

    def __init__(self):
        self.results = {
            "news_scrapers": [],
            "policy_crawlers": [],
            "statistics": {},
            "total_runtime_ms": 0,
        }

    def run_news_scrapers(self, scrapers: List[Any]) -> Dict[str, Any]:
        """
        Run all news scrapers.

        Args:
            scrapers: List of BaseNewsSource instances

        Returns:
            Dictionary with results and statistics
        """
        logger.info("news_scrapers_start", count=len(scrapers))
        start_time = time.time()

        for scraper in scrapers:
            try:
                articles, fetched, errors = scraper.run()
                stored, dedup = store_articles(articles)
                runtime_ms = int((time.time() - start_time) * 1000)

                status = "success" if not errors else "partial"
                log_scraper_run(
                    scraper_name=scraper.name,
                    status=status,
                    items_fetched=fetched,
                    items_stored=stored,
                    items_deduplicated=dedup,
                    errors=errors,
                    performance_ms=runtime_ms,
                )

                self.results["news_scrapers"].append({
                    "scraper": scraper.name,
                    "fetched": fetched,
                    "stored": stored,
                    "deduplicated": dedup,
                    "status": status,
                })

            except Exception as e:
                logger.error("scraper_exception", scraper=scraper.name, error=str(e))
                log_scraper_run(
                    scraper_name=scraper.name,
                    status="error",
                    items_fetched=0,
                    items_stored=0,
                    errors=str(e),
                    performance_ms=0,
                )

        return self.results

    def run_policy_crawlers(self, crawlers: List[Any], max_docs: int = None) -> Dict[str, Any]:
        """
        Run all policy crawlers.

        Args:
            crawlers: List of BaseCrawler instances
            max_docs: Max documents per crawler (for POC)

        Returns:
            Dictionary with results and statistics
        """
        logger.info("policy_crawlers_start", count=len(crawlers))
        start_time = time.time()

        for crawler in crawlers:
            try:
                documents, fetched, stored, errors = crawler.run(max_documents=max_docs)
                db_stored, dedup = store_documents(documents)
                runtime_ms = int((time.time() - start_time) * 1000)

                status = "success" if not errors else "partial"
                log_crawler_run(
                    crawler_name=crawler.name,
                    status=status,
                    items_fetched=fetched,
                    items_stored=db_stored,
                    items_deduplicated=dedup,
                    errors=errors,
                    performance_ms=runtime_ms,
                )

                self.results["policy_crawlers"].append({
                    "crawler": crawler.name,
                    "fetched": fetched,
                    "stored": db_stored,
                    "deduplicated": dedup,
                    "status": status,
                })

            except Exception as e:
                logger.error("crawler_exception", crawler=crawler.name, error=str(e))
                log_crawler_run(
                    crawler_name=crawler.name,
                    status="error",
                    items_fetched=0,
                    items_stored=0,
                    errors=str(e),
                    performance_ms=0,
                )

        return self.results

    def run_full_pipeline(self, scrapers: List[Any], crawlers: List[Any], max_docs: int = None) -> Dict[str, Any]:
        """
        Run complete pipeline: scrapers + crawlers + stats.

        Args:
            scrapers: List of news scrapers
            crawlers: List of policy crawlers
            max_docs: Max documents per crawler

        Returns:
            Full results
        """
        start_time = time.time()
        logger.info("pipeline_start", scrapers=len(scrapers), crawlers=len(crawlers))

        # Run scrapers
        if scrapers:
            self.run_news_scrapers(scrapers)

        # Run crawlers
        if crawlers:
            self.run_policy_crawlers(crawlers, max_docs=max_docs)

        # Gather statistics
        stats_session = get_session()
        try:
            from models import NewsArticle, PolicyDocument
            total_articles = stats_session.query(NewsArticle).count()
            total_docs = stats_session.query(PolicyDocument).count()
            self.results["statistics"] = {
                "total_news_articles": total_articles,
                "total_policy_documents": total_docs,
            }
        finally:
            stats_session.close()

        self.results["total_runtime_ms"] = int((time.time() - start_time) * 1000)
        logger.info("pipeline_complete", runtime_ms=self.results["total_runtime_ms"])

        return self.results

    def print_results(self):
        """Print formatted results."""
        print("\n" + "=" * 70)
        print("CSV RADAR POC — PIPELINE RESULTS")
        print("=" * 70 + "\n")

        print(f"Total Runtime: {self.results['total_runtime_ms']}ms\n")

        if self.results["news_scrapers"]:
            print("📰 NEWS SCRAPERS:")
            for result in self.results["news_scrapers"]:
                print(f"  {result['scraper']}: {result['stored']} stored, {result['deduplicated']} dedup [{result['status']}]")

        if self.results["policy_crawlers"]:
            print("\n📋 POLICY CRAWLERS:")
            for result in self.results["policy_crawlers"]:
                print(f"  {result['crawler']}: {result['stored']} stored, {result['deduplicated']} dedup [{result['status']}]")

        if self.results["statistics"]:
            print("\n📊 DATABASE STATISTICS:")
            for key, value in self.results["statistics"].items():
                print(f"  {key}: {value}")

        print("\n" + "=" * 70 + "\n")


def main():
    """Example: run pipeline with mock scrapers/crawlers."""
    # Initialize database
    init_db()

    # Create pipeline
    pipeline = CSVRadarPipeline()

    # In real use, add actual scrapers/crawlers here
    # For now, just show structure
    print("Pipeline initialized. Add scrapers and crawlers in Phase 2/3.")


if __name__ == "__main__":
    main()
