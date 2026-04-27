"""SQLAlchemy ORM model for policy documents."""
from sqlalchemy import Column, String, Text, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from models.database import Base


class PolicyDocument(Base):
    """ORM model for policy_documents table."""
    __tablename__ = "policy_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(500), nullable=False)
    source = Column(String(100), nullable=False)  # 'DOE' or 'ERC'
    doc_type = Column(String(100))  # 'Circular', 'Executive Order', etc.
    url = Column(Text, nullable=False, unique=True)
    published_at = Column(DateTime(timezone=True))
    document_text = Column(Text)
    metadata = Column(JSON, default={})
    fetched_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    status = Column(String(50), default="active")

    def __repr__(self):
        return f"<PolicyDocument(id={self.id}, title={self.title[:50]}, source={self.source})>"

    def to_dict(self):
        """Convert to dictionary for serialization."""
        return {
            "id": str(self.id),
            "title": self.title,
            "source": self.source,
            "doc_type": self.doc_type,
            "url": self.url,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "document_text": self.document_text[:500] if self.document_text else None,  # First 500 chars
            "metadata": self.metadata,
            "fetched_at": self.fetched_at.isoformat() if self.fetched_at else None,
        }
