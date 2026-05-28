import app from "./app";
import { logger } from "./lib/logger";
import pg from "pg";

const rawPort = process.env["PORT"];
if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Auto-create tables on startup
async function runMigrations() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, bio TEXT, target_role TEXT, current_role TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS resumes (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), content TEXT, file_name TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS conversations (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), title TEXT, created_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, conversation_id INTEGER REFERENCES conversations(id), role TEXT NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW());
  `);
  await pool.end();
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