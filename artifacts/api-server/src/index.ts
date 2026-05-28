import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      bio TEXT,
      target_role TEXT,
     "current_role" TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS resumes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      raw_text TEXT,
      score REAL,
      skills TEXT[] NOT NULL DEFAULT '{}',
      missing_skills TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS predictions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      resume_id INTEGER NOT NULL,
      resume_score REAL NOT NULL,
      placement_eligibility BOOLEAN NOT NULL DEFAULT FALSE,
      placement_probability REAL,
      career_domain TEXT NOT NULL,
      cluster_group TEXT,
      performance_prediction REAL,
      skill_gaps TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ml_analysis (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      communication_score REAL NOT NULL,
      coding_score REAL NOT NULL,
      aptitude_score REAL NOT NULL,
      performance_prediction REAL NOT NULL,
      placement_probability REAL NOT NULL,
      placement_eligibility BOOLEAN NOT NULL DEFAULT FALSE,
      recommended_domain TEXT NOT NULL,
      domain_confidence REAL NOT NULL,
      all_domain_scores TEXT NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bulk_uploads (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      student_count INTEGER NOT NULL DEFAULT 0,
      eligible_count INTEGER NOT NULL DEFAULT 0,
      results TEXT NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS suggestions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      content TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  logger.info("Database tables ready");
}

runMigrations().catch((err) => {
  logger.error({ err }, "Migration failed");
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});