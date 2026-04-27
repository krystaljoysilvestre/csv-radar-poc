"""Database setup and configuration."""
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import structlog

# Load environment variables
load_dotenv()

# Database URL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/csv_radar_poc")

# Create engine
engine = create_engine(
    DATABASE_URL,
    echo=os.getenv("LOG_LEVEL") == "DEBUG",
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for ORM models
Base = declarative_base()

logger = structlog.get_logger()


def get_session():
    """Get a new database session."""
    return SessionLocal()


def init_db():
    """Initialize database (create tables if needed)."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("database_initialized")
    except Exception as e:
        logger.error("database_init_failed", error=str(e))
        raise
