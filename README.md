# Calorie Counter (Next.js + MySQL)

Chat-centric calorie tracker with a Dashboard and Chat. API routes are implemented as Next.js Route Handlers and persist data in MySQL or MariaDB.

## Stack
- Next.js App Router
- MySQL or MariaDB via `mysql2`
- App-owned email/password auth with signed HTTP-only cookies
- Chart.js via react-chartjs-2
- SCSS + CSS Modules

## Quick Start
1. Install deps
   - `npm install`

2. Create the database
   - In cPanel, use **Databases > MySQL Database Wizard** or **Databases > MySQL Databases**.
   - Create a database and database user.
   - Add the user to the database with **ALL PRIVILEGES** for the initial migration.
   - Import `db/mysql/schema.sql`, then optionally import `db/mysql/seed.sql`.

3. Env vars
   - Copy `.env.example` to `.env.local`.
   - Fill `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`.
   - Set `SESSION_SECRET` to a random value at least 32 characters long.
   - Set `OPENAI_API_KEY` for chat image/text analysis.

4. Run
   - `npm run dev`
   - Open http://localhost:3000

5. Auth
   - Visit `/login`.
   - Create an account with email/password.
   - User data is scoped in every query by the signed session user id.

## MySQL Import
Use phpMyAdmin in cPanel:

1. Open **phpMyAdmin**.
2. Select the new database.
3. Use **Import** to run `db/mysql/schema.sql`.
4. Import `db/mysql/seed.sql` if you want the default active chat prompt.

For production, keep the app user limited to this one database. It needs normal table privileges for runtime reads/writes. You can remove broad DBA-style privileges after schema creation if your host allows editing privileges.

## Routes
- UI: `/dashboard`, `/chat`, `/test`, `/login`
- API:
  - `GET /api/health`
  - `GET,POST /api/entries`
  - `PATCH,DELETE /api/entries/:id`
  - `GET /api/dashboard/summary`
  - `POST /api/chat/stream`
  - `GET,POST /api/chat/sessions`
  - `GET /api/chat/sessions/:id/messages`
  - `GET /api/prompts/active`

## Notes
- Images are never persisted; uploaded images are forwarded to the LLM request only.
- Supabase Auth/RLS has been replaced by app-owned auth and query-level user scoping.
- The old `supabase/` directory is retained as migration history.
