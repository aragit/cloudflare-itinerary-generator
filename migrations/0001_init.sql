-- migrations/0001_init.sql

CREATE TABLE IF NOT EXISTS itineraries (
    jobId TEXT PRIMARY KEY,
    status TEXT CHECK(status IN ('processing','completed','failed')) NOT NULL,
    destination TEXT NOT NULL,
    durationDays INTEGER NOT NULL,
    createdAt INTEGER NOT NULL,
    completedAt INTEGER,
    itinerary TEXT,
    error TEXT
);


