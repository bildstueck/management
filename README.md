# Social Planner

Self-hosted social media planning, client-approval and auto-publishing platform (Facebook, Instagram, LinkedIn) — a Planable-style workflow you run yourself.

See [`/Users/thilofriedrich/.claude/plans/zesty-wandering-umbrella.md`](/Users/thilofriedrich/.claude/plans/zesty-wandering-umbrella.md) for the full architecture and phase roadmap. This repo currently covers **Phase 0: project setup**.

## Tech stack

- Next.js 16 (App Router, TypeScript), Tailwind CSS, shadcn/ui
- PostgreSQL + Prisma 7 (driver adapters — see `prisma.config.ts` / `src/lib/prisma.ts`)
- NextAuth.js (Credentials) for the internal team login. Clients/reviewers never get accounts — they use magic share links (Phase 4)
- BullMQ + Redis for scheduled/immediate publishing (worker added in Phase 5)
- S3-compatible storage (MinIO locally, Cloudflare R2 in production) — required because the Instagram Graph API fetches media by public URL

## Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Start Postgres, Redis and MinIO

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) (not installed on this machine yet — install it first).

```bash
docker compose up -d
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

A working `.env` for local dev (matching `docker-compose.yml`) is already checked out for you in this repo during setup — adjust values as needed. Generate fresh secrets with:

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 32      # TOKEN_ENCRYPTION_KEY (must stay 64 hex chars)
```

### 4. Create the database schema and a first admin user

```bash
npm run db:migrate
npm run db:seed
```

The seed script creates `admin@example.com` / `changeme123` (override via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env vars before seeding). Change the password after first login once account management ships in a later phase.

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on `/login`.

### Useful scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run db:migrate` | Create/apply a Prisma migration (dev) |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:seed` | Run `prisma/seed.ts` |
| `npm run db:studio` | Open Prisma Studio |
| `npm run lint` / `npm run format` | ESLint / Prettier |

## Meta App Setup (Facebook + Instagram) — needed for Phase 1

Facebook Page and Instagram Business/Creator account publishing both go through the Meta Graph API via one Meta developer app.

1. Go to <https://developers.facebook.com/apps> and create a new app (type: **Business**).
2. Add the **Facebook Login** and **Instagram Graph API** products to the app.
3. Under **App Settings → Basic**, note the **App ID** and **App Secret** → put them in `.env` as `META_APP_ID` / `META_APP_SECRET`.
4. Under **Facebook Login → Settings**, add a **Valid OAuth Redirect URI**: `http://localhost:3000/api/auth/callback/meta` (matches `META_REDIRECT_URI` in `.env`; use your real domain in production).
5. Request the following permissions (needs **App Review** before they work for anyone other than the app's own admins/testers in Development Mode):
   - `pages_show_list`, `pages_read_engagement`, `pages_manage_posts` (Facebook Page publishing)
   - `instagram_basic`, `instagram_content_publish` (Instagram publishing — requires the IG account to be a Business/Creator account linked to a Facebook Page)
6. While the app is still in **Development Mode**, add yourself/your test users as **Admins/Testers** under **App Roles** so you can connect accounts and test publishing before App Review approves the app for everyone else.
7. Instagram's publish endpoint fetches media by URL, so `S3_PUBLIC_BASE_URL` must be a real, public HTTPS URL in any environment used for actual Instagram publishing — `http://localhost:9000` only works for local UI/dev work, not real Instagram API calls.

## LinkedIn App Setup — needed for Phase 1

1. Go to <https://www.linkedin.com/developers/apps> and create a new app (requires an associated LinkedIn Company Page, even if you'll also post to personal profiles).
2. Under **Auth**, note the **Client ID** and **Client Secret** → put them in `.env` as `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`.
3. Add an **Authorized redirect URL**: `http://localhost:3000/api/auth/callback/linkedin` (matches `LINKEDIN_REDIRECT_URI`; use your real domain in production).
4. Request the **Community Management API** product (for posting on behalf of Company Pages and members) — this requires LinkedIn's approval process; personal-profile-only posting via `w_member_social` is more readily available while you wait.
5. Scopes needed later in Phase 1: `w_member_social` (post as the member), `r_organization_social` + `w_organization_social` (read/post as a Company Page an admin manages).

## Project structure

```
prisma/schema.prisma   Data model (Workspace, SocialAccount, Post, ShareLink, ...)
prisma/seed.ts          Creates the first admin user
src/auth.ts             NextAuth config (Credentials, JWT sessions)
src/proxy.ts            Next.js 16 "Proxy" (formerly Middleware) — optimistic auth redirect
src/lib/                Prisma client, Redis, BullMQ queue, S3 client, token encryption
src/app/login           Public login page
src/app/dashboard        Authenticated app shell (placeholder dashboard)
src/app/review/[token]   Public magic-link review route (stub, built out in Phase 4)
docker-compose.yml       Local Postgres + Redis + MinIO
```
