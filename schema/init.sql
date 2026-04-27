-- CSV Radar POC Database Schema
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- News Articles table
CREATE TABLE news_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    source VARCHAR(255) NOT NULL,
    url TEXT NOT NULL UNIQUE,
    published_at TIMESTAMP WITH TIME ZONE,
    content TEXT,
    content_hash VARCHAR(64),
    tags TEXT[],
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active'
);

-- Indexes for news_articles
CREATE INDEX idx_news_source ON news_articles(source);
CREATE INDEX idx_news_published_at ON news_articles(published_at DESC);
CREATE INDEX idx_news_fetched_at ON news_articles(fetched_at DESC);
CREATE INDEX idx_news_content_hash ON news_articles(content_hash);
CREATE UNIQUE INDEX idx_news_url_hash ON news_articles(url, content_hash);

-- Policy Documents table
CREATE TABLE policy_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    source VARCHAR(100) NOT NULL, -- 'DOE' or 'ERC'
    doc_type VARCHAR(100), -- 'Circular', 'Executive Order', 'PPA', etc.
    url TEXT NOT NULL UNIQUE,
    published_at TIMESTAMP WITH TIME ZONE,
    document_text TEXT,
    metadata JSONB, -- Flexible storage: format, pages, doc_number, etc.
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active'
);

-- Indexes for policy_documents
CREATE INDEX idx_policy_source ON policy_documents(source);
CREATE INDEX idx_policy_doc_type ON policy_documents(doc_type);
CREATE INDEX idx_policy_published_at ON policy_documents(published_at DESC);
CREATE INDEX idx_policy_fetched_at ON policy_documents(fetched_at DESC);
CREATE INDEX idx_policy_source_type ON policy_documents(source, doc_type);

-- Scraper Logs table
CREATE TABLE scraper_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scraper_name VARCHAR(100) NOT NULL,
    scraper_type VARCHAR(50) NOT NULL, -- 'news_scraper' or 'policy_crawler'
    run_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL, -- 'success', 'error', 'partial'
    items_fetched INT DEFAULT 0,
    items_stored INT DEFAULT 0,
    items_deduplicated INT DEFAULT 0,
    errors TEXT,
    performance_ms INT,
    notes TEXT
);

-- Indexes for scraper_logs
CREATE INDEX idx_scraper_run_at ON scraper_logs(run_at DESC);
CREATE INDEX idx_scraper_name ON scraper_logs(scraper_name);
CREATE INDEX idx_scraper_status ON scraper_logs(status);

-- Metadata table for tracking POC progress
CREATE TABLE poc_metadata (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Initialize metadata
INSERT INTO poc_metadata (key, value) VALUES
    ('phase', '1_analysis'),
    ('news_sources_tested', '0'),
    ('doe_policies_fetched', '0'),
    ('erc_circulars_fetched', '0'),
    ('js_rendering_needed', 'unknown'),
    ('pdf_handling_required', 'unknown');

-- Grants (if needed for different users)
-- GRANT SELECT, INSERT, UPDATE ON news_articles TO app_user;
-- GRANT SELECT, INSERT, UPDATE ON policy_documents TO app_user;
-- GRANT SELECT, INSERT ON scraper_logs TO app_user;
