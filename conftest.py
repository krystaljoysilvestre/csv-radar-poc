"""Pytest configuration."""
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def pytest_configure(config):
    """Configure pytest."""
    # Set test markers
    config.addinivalue_line(
        "markers", "phase1: phase 1 analysis tests"
    )
    config.addinivalue_line(
        "markers", "phase2: phase 2 news scraper tests"
    )
    config.addinivalue_line(
        "markers", "phase3: phase 3 policy crawler tests"
    )
