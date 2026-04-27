"""SQLAlchemy ORM model for scraper logs."""
from sqlalchemy import Column, String, Text, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from models.database import Base


class ScraperLog(Base):
    """ORM model for scraper_logs table."""
    __tablename__ = "scraper_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scraper_name = Column(String(100), nullable=False)
    scraper_type = Column(String(50), nullable=False)  # 'news_scraper' or 'policy_crawler'
    run_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    status = Column(String(50), nullable=False)  # 'success', 'error', 'partial'
    items_fetched = Column(Integer, default=0)
    items_stored = Column(Integer, default=0)
    items_deduplicated = Column(Integer, default=0)
    errors = Column(Text)
    performance_ms = Column(Integer)
    notes = Column(Text)

    def __repr__(self):
        return f"<ScraperLog(scraper_name={self.scraper_name}, status={self.status}, items_stored={self.items_stored})>"

    def to_dict(self):
        """Convert to dictionary for serialization."""
        return {
            "id": str(self.id),
            "scraper_name": self.scraper_name,
            "scraper_type": self.scraper_type,
            "run_at": self.run_at.isoformat() if self.run_at else None,
            "status": self.status,
            "items_fetched": self.items_fetched,
            "items_stored": self.items_stored,
            "items_deduplicated": self.items_deduplicated,
            "performance_ms": self.performance_ms,
        }
