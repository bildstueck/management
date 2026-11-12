# Social Planner

Self-hosted social media planning, client-approval and auto-publishing platform (Facebook, Instagram, LinkedIn) — a Planable-style workflow you run yourself.

See [`/Users/thilofriedrich/.claude/plans/zesty-wandering-umbrella.md`](/Users/thilofriedrich/.claude/plans/zesty-wandering-umbrella.md) for the full architecture and phase roadmap. This repo currently covers **Phase 0 (project setup)**, **Phase 1 (workspaces, team membership, Meta/LinkedIn account connections)** and **Phase 2 (post composer, media upload, per-channel preview)**.

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

Open [http://localhost:3000](http://localhost:3000) — you'll land on `/login`. After logging in, create a workspace from `/dashboard`, then connect accounts and manage team members from `/w/<slug>`.

### Adding more team members

There's no self-serve sign-up — team accounts are internal. To add someone, either:
- run `npm run db:seed` again with `SEED_ADMIN_EMAIL=them@example.com SEED_ADMIN_PASSWORD=... npm run db:seed`, or
- create a `User` row directly in Prisma Studio (`npm run db:studio`) with a bcrypt password hash.

Then, as a workspace Owner, add them to a workspace from `/w/<slug>/members` by email.

### Useful scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run db:migrate` | Create/apply a Prisma migration (dev) |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:seed` | Run `prisma/seed.ts` |
| `npm run db:studio` | Open Prisma Studio |
| `npm run worker:tokens` | Background job that silently refreshes LinkedIn tokens before they expire (run alongside `npm run dev`) |
| `npm run s3:init` | One-time: creates the media bucket and makes it public-read + CORS-enabled (needed before uploading media) |
| `npm run lint` / `npm run format` | ESLint / Prettier |

## Connecting social accounts (Phase 1)

From `/w/<slug>/accounts`, a workspace **Owner** can connect Facebook Pages (with their linked Instagram Business/Creator accounts) and LinkedIn. Both go through a custom OAuth "connect" flow (`/api/connect/meta`, `/api/connect/linkedin` + their `/callback` routes) — this is deliberately separate from the NextAuth login at `/api/auth/*`, since it's "let this workspace publish as this external account", not "sign in as this app user".

### Meta App Setup (Facebook + Instagram)

1. Go to <https://developers.facebook.com/apps> and create a new app (type: **Business**).
2. Add the **Facebook Login** and **Instagram Graph API** products to the app.
3. Under **App Settings → Basic**, note the **App ID** and **App Secret** → put them in `.env` as `META_APP_ID` / `META_APP_SECRET`.
4. Under **Facebook Login → Settings**, add a **Valid OAuth Redirect URI**: `http://localhost:3000/api/connect/meta/callback` (use your real domain in production).
5. Request the following permissions (needs **App Review** before they work for anyone other than the app's own admins/testers in Development Mode):
   - `pages_show_list`, `pages_read_engagement`, `pages_manage_posts` (Facebook Page publishing)
   - `instagram_basic`, `instagram_content_publish` (Instagram publishing — requires the IG account to be a Business/Creator account linked to a Facebook Page)
6. While the app is still in **Development Mode**, add yourself/your test users as **Admins/Testers** under **App Roles** so you can connect accounts and test publishing before App Review approves the app for everyone else.
7. Instagram's publish endpoint fetches media by URL, so `S3_PUBLIC_BASE_URL` must be a real, public HTTPS URL in any environment used for actual Instagram publishing — `http://localhost:9000` only works for local UI/dev work, not real Instagram API calls.
8. The Graph API version is pinned in `src/lib/oauth/meta.ts` (`GRAPH_VERSION`, currently v26.0) — bump it there when Meta deprecates that version.

Once connected, Page access tokens obtained this way are derived from a long-lived user token and don't expire on a fixed schedule — there's no silent refresh for them. If Meta ever invalidates one (password change, long inactivity, revoked permission), the Accounts page shows it as expired/expiring and the Owner just reconnects.

### LinkedIn App Setup

1. Go to <https://www.linkedin.com/developers/apps> and create a new app (requires an associated LinkedIn Company Page, even if you'll also post to personal profiles).
2. Under **Auth**, note the **Client ID** and **Client Secret** → put them in `.env` as `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`.
3. Add an **Authorized redirect URL**: `http://localhost:3000/api/connect/linkedin/callback` (use your real domain in production).
4. Request the **Sign In with LinkedIn using OpenID Connect** product (for `openid`/`profile`/`email`) — this is self-serve and approves instantly.
5. By default, only personal-profile posting (`w_member_social`) is requested. Company Page posting needs the **Community Management API** product, which requires LinkedIn's (slower) approval process. Once approved, set `LINKEDIN_ORGANIZATION_SCOPES_ENABLED=true` in `.env` — requesting those scopes before approval makes the *entire* OAuth request fail, so leave it `false` until then.
6. If your app is also an approved Marketing Developer Platform partner, LinkedIn issues a `refresh_token` on connect; `npm run worker:tokens` uses it to silently refresh access tokens before their 60-day expiry. Without that approval, access tokens still work for 60 days but the Owner has to reconnect manually afterwards (surfaced on the Accounts page).

## Post composer & media (Phase 2)

From `/w/<slug>/posts`, any workspace member can draft a post: one master text + media, optionally customized per connected channel, with a live mockup preview (desktop/mobile toggle) for Facebook, Instagram and LinkedIn.

Media uploads go straight from the browser to S3/MinIO via a presigned URL (the file never passes through the Next.js server) — see `src/lib/s3-upload.ts` and `requestMediaUploadAction`/`confirmMediaUploadAction` in `src/app/(app)/w/[slug]/posts/actions.ts`. Before uploading anything for the first time, run:

```bash
npm run s3:init
```

This creates the bucket (if missing) and makes it public-read + CORS-enabled for the app's origin — required both for the browser-side upload and because Instagram/Facebook fetch media by public URL when actually publishing (Phase 5).

Only JPEG/PNG images and MP4/MOV videos are accepted at upload time (8MB / 1GB sanity caps); exact per-platform limits (aspect ratio, duration, carousel size) are enforced later, when actually publishing.

Posts only reach `DRAFT` status in this phase — the Feed/Calendar/Grid views, the approval workflow and scheduled/automatic publishing are Phases 3–5.

## Project structure

```
prisma/schema.prisma        Data model (Workspace, SocialAccount, Post, ShareLink, ...)
prisma/seed.ts               Creates the first admin user
src/auth.ts                  NextAuth config (Credentials, JWT sessions)
src/proxy.ts                 Next.js 16 "Proxy" (formerly Middleware) — optimistic auth redirect
src/lib/dal.ts                requireUser() — the real auth guard, used in pages/actions/routes
src/lib/workspaces.ts         Workspace CRUD + membership checks
src/lib/members.ts            Add/remove/change-role for workspace members
src/lib/social-accounts.ts    Connected-account storage (encrypted tokens)
src/lib/oauth/                Meta + LinkedIn OAuth clients, signed OAuth "state" helper
src/lib/posts.ts              Post + per-channel variant CRUD
src/lib/media.ts               Media record CRUD
src/lib/s3-upload.ts           Presigned direct-to-S3/MinIO upload
src/lib/              Prisma client, Redis, BullMQ queue, S3 client, token encryption
src/workers/token-refresh.ts  Background job: refreshes LinkedIn tokens before expiry
src/scripts/init-bucket.ts    One-time MinIO/S3 bucket + policy + CORS setup (npm run s3:init)
src/app/login                 Public login page
src/app/(app)/dashboard       Workspace list + create
src/app/(app)/w/[slug]        Workspace shell: overview, posts, accounts, members
src/app/api/connect/          Meta/LinkedIn "connect account" OAuth flow (not NextAuth login)
src/app/review/[token]        Public magic-link review route (stub, built out in Phase 4)
src/components/post-composer.tsx   Master text + per-channel overrides + media picker
src/components/previews/      Facebook/Instagram/LinkedIn mockup preview cards
docker-compose.yml            Local Postgres + Redis + MinIO
```
