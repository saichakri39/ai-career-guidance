import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(`
DROP TABLE IF EXISTS bulk_uploads CASCADE;
DROP TABLE IF EXISTS ml_analysis CASCADE;
DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS suggestions CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS resumes CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, bio TEXT, target_role TEXT, "current_role" TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE TABLE resumes (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), filename TEXT, original_name TEXT, raw_text TEXT, score INTEGER, skills TEXT[], missing_skills TEXT[], created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE predictions (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), resume_id INTEGER REFERENCES resumes(id), resume_score INTEGER, placement_eligibility BOOLEAN, placement_probability NUMERIC, career_domain TEXT, cluster_group TEXT, performance_prediction NUMERIC, skill_gaps TEXT[], created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE ml_analysis (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), communication_score NUMERIC, coding_score NUMERIC, aptitude_score NUMERIC, performance_prediction NUMERIC, placement_probability NUMERIC, placement_eligibility BOOLEAN, recommended_domain TEXT, domain_confidence NUMERIC, all_domain_scores JSONB, created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE suggestions (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), content TEXT, created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE conversations (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), title TEXT, created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE messages (id SERIAL PRIMARY KEY, conversation_id INTEGER REFERENCES conversations(id), role TEXT NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE bulk_uploads (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), filename TEXT, student_count INTEGER, eligible_count INTEGER, results JSONB, created_at TIMESTAMP DEFAULT NOW());
`);
console.log('All tables created!');
process.exit(0);