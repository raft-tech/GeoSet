"""Shared utilities for sample data ingest scripts."""

import os
import sys
import time

from sqlalchemy import create_engine, text

DB_HOST = os.environ.get("DB_HOST", "postgis")
DB_PORT = os.environ.get("DB_PORT", "5432")
DB_NAME = os.environ.get("DB_NAME", "geoset")
DB_USER = os.environ.get("DB_USER", "geoset")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "geoset")


def get_engine():
    db_url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    return create_engine(db_url)


def wait_for_db(engine, retries=10, delay=3):
    for attempt in range(retries):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except Exception:
            print(f"Waiting for database (attempt {attempt + 1}/{retries})...")
            time.sleep(delay)
    print("Could not connect to database.")
    sys.exit(1)


def skip_if_populated(engine, table_name):
    """Exit early if the table already has data."""
    with engine.connect() as conn:
        count = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar()
        if count > 0:
            print(f"{table_name} already has {count} rows, skipping.")
            sys.exit(0)


def fetch_with_retry(fn, description="request", retries=3, delay=2):
    """Call fn() with retry logic. Returns the result of fn() on success."""
    for attempt in range(retries):
        try:
            return fn()
        except Exception as e:
            if attempt < retries - 1:
                print(f"  Retry {attempt + 1} for {description}: {e}")
                time.sleep(delay)
            else:
                raise
