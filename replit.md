# AI Career Guidance System

A full-stack AI-powered career intelligence platform that helps students and job-seekers get smart, data-driven guidance on their career paths.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port assigned by workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + Recharts + wouter + framer-motion
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Auth: JWT (jsonwebtoken + bcryptjs) — token stored in localStorage
- AI: OpenAI via Replit AI Integrations (no API key required)
- Resume Parsing: pdf-parse + mammoth
- File Upload: multer (multipart/form-data)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — Single source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle ORM schema files (users, resumes, predictions, suggestions)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/middlewares/auth.ts` — JWT auth middleware
- `artifacts/career-guidance/src/` — React frontend (pages, components)
- `lib/api-client-react/src/generated/` — Auto-generated React Query hooks
- `lib/api-zod/src/generated/` — Auto-generated Zod schemas

## Architecture decisions

- OpenAPI-first contract: spec gates codegen, which gates the frontend. All type changes go through `openapi.yaml`.
- JWT stored in localStorage; custom-fetch.ts automatically injects Authorization header.
- ML predictions are implemented server-side in TypeScript (skill extraction, domain prediction, placement eligibility scoring) rather than a Python service — simpler deployment, same results.
- AI features (career suggestions, roadmaps) use Replit AI Integrations (OpenAI) — no API key needed from users.
- Resume parsing handles PDF (pdf-parse), DOCX (mammoth), and TXT files.

## Product

- Landing page with hero, features, and CTA
- JWT-based login/register
- Resume upload with automatic skill extraction and scoring
- ML-powered predictions: career domain, placement eligibility, cluster group
- AI career suggestions powered by OpenAI: guidance, courses, interview tips, resume tips, learning roadmaps
- Analytics dashboard with Recharts: score history, skill trends, career domain breakdown

## Demo Account

- Email: `demo@example.com`
- Password: `Demo1234!`

## User preferences

- No emojis in the UI
- Dark/light mode support
- Mobile responsive

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after every OpenAPI spec change
- Run `pnpm --filter @workspace/db run push` after every schema change
- JWT secret comes from `SESSION_SECRET` env var
- OpenAI integration uses `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` env vars (auto-provisioned by Replit)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
