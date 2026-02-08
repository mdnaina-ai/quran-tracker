-- Quran Tracker Database Schema

-- Readings log (daily entries)
CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE UNIQUE NOT NULL,
    start_page INTEGER NOT NULL,
    end_page INTEGER NOT NULL,
    pages_read INTEGER NOT NULL,
    completed BOOLEAN DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Goals/settings per Ramadan
CREATE TABLE IF NOT EXISTS goals (
    year INTEGER PRIMARY KEY,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    daily_goal INTEGER DEFAULT 5,
    target_pages INTEGER DEFAULT 604
);

-- Current state (singleton)
CREATE TABLE IF NOT EXISTS state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial state
INSERT OR IGNORE INTO state (key, value) VALUES ('current_page', '1');
INSERT OR IGNORE INTO state (key, value) VALUES ('ramadan_year', '2026');
INSERT OR IGNORE INTO state (key, value) VALUES ('last_read_date', '');

-- Insert 2026 Ramadan dates (approximate - adjust when official)
-- Ramadan 2026: ~Feb 17 - March 18 (29-30 days)
INSERT OR IGNORE INTO goals (year, start_date, end_date, daily_goal, target_pages) 
VALUES (2026, '2026-02-17', '2026-03-18', 5, 604);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_readings_date ON readings(date);
