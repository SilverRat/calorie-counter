# Calorie Counter (Next.js + Supabase)

Production-ready scaffold for a chat-centric calorie tracker with a Dashboard and Chat. API is implemented as Next.js Route Handlers (Edge where streaming fits). No image persistence.

## Stack
- Next.js (App Router) on Vercel
- Supabase (Postgres + Auth + RLS)
- Chart.js via react-chartjs-2
- SCSS + CSS Modules, CSS variables for theming

## Quick Start
1) Install deps
   - `npm install`

2) Env vars
   - Copy `.env.example` → `.env.local`, fill in:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - Server: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`
     - Dev helper: `DEV_USER_ID` (a valid Supabase Auth user UUID)

3) Supabase schema
   - Apply SQL from `supabase/migrations/0001_init.sql` to your Supabase project.
   - Seed Prompt v1 using `supabase/seeds/000_prompt.sql` (optional; or add via dashboard).

4) Run
   - `npm run dev` then open http://localhost:3000

5) Auth
   - Visit `/login` and sign in (email/password). Supabase Auth cookies will be set and refreshed by `middleware.ts`.
   - After signing in, `/dashboard` and `/test` will show your data (RLS enforced).

## Routes
- UI
  - `/dashboard` basic placeholders for Today/7d/30d
  - `/chat` chat stub with file picker and message box
- API (stubs)
  - `GET /api/health` → `{ ok: true }`
  - `GET,POST /api/entries`
  - `PATCH,DELETE /api/entries/:id`
  - `GET /api/dashboard/summary`
  - `POST /api/chat/stream` (SSE stub)
  - `GET,POST /api/chat/sessions` and related session routes
  - `GET /api/prompts/active`

## Notes
- Images are never persisted; chat endpoint will accept small images and forward to the LLM (to be implemented).
- RLS policies restrict all data to the authenticated user (Supabase Auth).
- Next steps: wire Supabase client in API routes, implement tool handlers, and integrate LLM streaming.
