"""SQLAlchemy ORM model for news articles."""
from sqlalchemy import Column, String, Text, DateTime, Integer, ARRAY, Index
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from models.database import Base


class NewsArticle(Base):
    """ORM model for news_articles table."""
    __tablename__ = "news_articles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(500), nullable=False)
    source = Column(String(255), nullable=False)
    url = Column(Text, nullable=False, unique=True)
    published_at = Column(DateTime(timezone=True))
    content = Column(Text)
    content_hash = Column(String(64))
    tags = Column(ARRAY(String), default=[])
    fetched_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    status = Column(String(50), default="active")

    def __repr__(self):
        return f"<NewsArticle(id={self.id}, title={self.title[:50]}, source={self.source})>"

    def to_dict(self):
        """Convert to dictionary for serialization."""
        return {
            "id": str(self.id),
            "title": self.title,
            "source": self.source,
            "url": self.url,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "content": self.content,
            "tags": self.tags,
            "fetched_at": self.fetched_at.isoformat() if self.fetched_at else None,
        }
