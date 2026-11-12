# Social Planner

Self-hosted social media planning, client-approval and auto-publishing platform (Facebook, Instagram, LinkedIn) — a Planable-style workflow you run yourself.

See [`/Users/thilofriedrich/.claude/plans/zesty-wandering-umbrella.md`](/Users/thilofriedrich/.claude/plans/zesty-wandering-umbrella.md) for the full architecture and phase roadmap. This repo currently covers **Phase 0 (project setup)**, **Phase 1 (workspaces, team membership, Meta/LinkedIn account connections)**, **Phase 2 (post composer, media upload, per-channel preview)**, **Phase 3 (Feed/Calendar/Instagram-Grid views, internal comments)**, **Phase 4 (magic-link client approval)** and **Phase 5 (scheduler + automatic publishing)**. That's the full original roadmap — Phase 6 (hardening/deployment polish) is the one phase left.

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
| `npm run worker:publish` | Background job that actually publishes scheduled posts to Facebook/Instagram/LinkedIn (run alongside `npm run dev`) |
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

Posts only reach `DRAFT` status in this phase — the approval workflow and scheduled/automatic publishing are Phases 4–5.

## Views & internal comments (Phase 3)

`/w/<slug>/posts` now has three views, switchable via the tabs at the top:

- **Feed** (default) — chronological list of all posts, each with an inline, internal comment thread (add a comment, mark it done/reopen). These are team-internal comments (`Comment.authorType = INTERNAL`); client-facing comments via a magic link are Phase 4.
- **Kalender** — a month grid you can navigate (`?month=YYYY-MM`). Posts with no `scheduledAt` sit in a tray above the grid; drag any post chip onto a day (or back into the tray) to set/clear its scheduled date. There's no week view yet — month view covers the Phase 3 scope; a week view would reuse the same `src/lib/calendar-dates.ts` helpers if added later.
- **Instagram Grid** — a 3-column preview of how a connected Instagram account's grid would look, ordered by `scheduledAt` (unscheduled posts sort to the end, since they have no defined position yet). If a workspace has more than one connected Instagram account, switch between them with the pills above the grid.

Setting a date (from the calendar or the composer's own date field) only sets `Post.scheduledAt` — it does **not** change `status` or queue anything for publishing. Those transitions (Draft → Pending Approval → Approved → Scheduled → Published) land with the approval workflow (Phase 4) and the publish worker (Phase 5).

## Client approval via magic link (Phase 4)

**Internal side:** a Draft is invisible to clients. From the Feed, click **"Zur Freigabe einreichen"** to move it to `PENDING_APPROVAL` (and **"Zurück zu Entwurf"** to pull it back for more edits). A workspace **Owner** manages share links from `/w/<slug>/share` — create one with an optional password, an optional expiry (in days), and three independent toggles: allow commenting, allow approving, allow editing the text. Deleting a link immediately revokes it.

**Client side:** the link (`/review/<token>`) needs no account. It shows every post with status `PENDING_APPROVAL` or later — never raw Drafts. Depending on the link's toggles, a visitor can:
- view a live per-channel mockup (the same Facebook/Instagram/LinkedIn preview cards from the composer),
- comment and mark comments done (stored as `Comment.authorType = EXTERNAL`, shown inline next to the team's own comments),
- click **Freigeben** to approve a post (`PENDING_APPROVAL` → `APPROVED`),
- edit the post's master text directly — logged as a plain-text version history entry (`ApprovalEvent.action = EDITED`, old → new) rather than a dedicated versions table; channels with their own customized text aren't touched by this.

The first time a visitor comments, approves, or edits, they're asked for a display name; it's remembered in a cookie (`reviewer_name`, scoped to `/review`) so they're not asked again. A password-protected link sets a separate, signed, link-specific cookie once unlocked — there's no shared "logged in as client" session across links.

Every status change and text edit is recorded on `ApprovalEvent` and shown as a small "Verlauf" (history) list on each post, both internally and on the review page.

## Scheduler & automatic publishing (Phase 5)

Once a post is `APPROVED` (or previously `FAILED`), the Feed shows:
- **Terminieren** — only when the post has a future `scheduledAt` (set in the composer or the calendar) — queues it on a delayed BullMQ job that fires at that time.
- **Jetzt veröffentlichen** / **Erneut versuchen** — publishes immediately, bypassing `scheduledAt`.
- **Planung abbrechen** (while `SCHEDULED`) — cancels the queued job and drops back to `APPROVED`.

Run the worker that actually does the publishing alongside `npm run dev`:

```bash
npm run worker:publish
```

Each channel is published by `src/lib/publishers/{facebook,instagram,linkedin}.ts`:
- **Facebook** — a plain `/feed` post for text-only; `/photos` or `/videos` for a single image/video; multiple *images* are uploaded unpublished first and attached to one `/feed` post (Facebook has no Instagram-style carousel container, and a video can't be mixed into that).
- **Instagram** — the Graph API container flow: create a container per image/video (`is_carousel_item` for 2–10 items), poll `status_code` until a video container is `FINISHED`, then `media_publish`.
- **LinkedIn** — the current `/rest/posts` API (not the deprecated `/v2/ugcPosts`), with a single image/video uploaded via the Images/Videos API first (video uses LinkedIn's chunked multipart upload). **Multiple media per LinkedIn post isn't implemented** (LinkedIn's organic MultiImage API) — that call fails with a clear error rather than guessing. The `Linkedin-Version` header is a hardcoded `YYYYMM` in `src/lib/publishers/linkedin.ts` — bump it periodically per LinkedIn's versioning policy.

**Retries & partial failure:** a failed attempt retries up to 3 times (exponential backoff) via BullMQ's own retry, not a custom loop. Each `PostChannelVariant` records its own `publishedExternalId` the moment *that* channel succeeds, so a retry (triggered by a different channel failing) skips channels already posted instead of double-posting. If every attempt still has failures, the post becomes `FAILED` and the Feed shows the combined error message (from the latest `PublishJob`); there's no automatic cross-channel rollback — a post can legitimately end up published on some channels and failed on others, and that's shown rather than hidden.

**A note for anyone adding worker-shared code:** `src/workers/*.ts` run as plain `tsx` processes, never through Next's bundler. Next aliases the `server-only` package to a no-op internally, but the real npm package (needed so plain Node can resolve the import at all) unconditionally throws — so none of the files a worker imports (directly or transitively) can have `import "server-only"` at the top. That's why `src/lib/posts.ts`, `media.ts`, `social-accounts.ts`, `publish-jobs.ts` and `src/lib/publishers/*` don't have it, even though they're server-only in spirit; nothing in this codebase imports them from a Client Component anyway (Client Components always go through a `"use server"` action file instead).

## Notifications & tests (Phase 6)

Workspace members get an email (via `src/lib/email.ts`, any SMTP provider) when a client comments on or approves a post through a share link — internal activity (team comments, drafting) stays silent, since the team already knows what it did. Set `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` in `.env` to enable it; leave them unset and it's skipped (logged, nothing else breaks).

```bash
npm run test       # vitest, once
npm run test:watch # vitest, watch mode
```

Covers the pure logic (slug generation, calendar/month-grid date math, the token-encryption round-trip) and all three publishers end-to-end against a mocked `fetch` — single media, multi-image/carousel, LinkedIn's chunked video upload, and error surfacing from the Graph/LinkedIn APIs. There's no integration test against a real database — that needs Docker, see below.

## Deployment (Phase 6)

This ships as two kinds of container, both built from the one `Dockerfile`:

- **`web`** — the Next.js server, as Next's minimal [standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output). Small, no `node_modules` install step at runtime.
- **`worker`** — full `node_modules` + source, used for the two background workers (`worker-publish`, `worker-tokens`) and one-off `prisma migrate deploy` / seed runs. Prisma 7's `@prisma/adapter-pg` driver adapter does query building in JS and talks to Postgres through the `pg` driver directly — there's no native query-engine binary to fetch, so a plain Alpine base image works with no OpenSSL/glibc workarounds.

`docker-compose.prod.yml` wires up Postgres, Redis, both workers, the web server, a one-off `migrate` service, and [Caddy](https://caddyserver.com/) in front for automatic HTTPS. It deliberately has **no MinIO** — production media storage is Cloudflare R2 (or any S3-compatible host), configured entirely through environment variables.

### 1. Point a domain at the server

Create an A record for your domain pointing at the server's IP, and make sure ports 80 and 443 are open — Caddy needs both to obtain and renew a Let's Encrypt certificate automatically.

### 2. Set up Cloudflare R2 for media

`npm run s3:init` (the policy/CORS script) is MinIO/AWS-S3-flavored and **doesn't work against R2** — R2 doesn't implement the S3 bucket-policy API the way MinIO/AWS do. Instead:

1. Create an R2 bucket in the Cloudflare dashboard.
2. Under the bucket's **Settings → Custom Domains**, connect a subdomain (e.g. `media.yourdomain.com`) — this is what makes objects publicly readable over HTTPS, required for Meta/Instagram to fetch media at publish time. The `r2.dev` development URL works too, but it's rate-limited and not meant for production.
3. Under **Settings → CORS Policy**, allow `GET`/`PUT` from `https://yourdomain.com` (needed for the browser's direct upload in the composer).
4. Create an R2 API token (Account → R2 → Manage API Tokens) for `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`.
5. Set `S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"`, `S3_BUCKET` to the bucket name, and `S3_PUBLIC_BASE_URL="https://media.yourdomain.com"` (your custom domain from step 2).

### 3. Write `.env.production`

Same variables as `.env.example`, plus:

```bash
POSTGRES_USER="social_planner"
POSTGRES_PASSWORD="<generate one>"
POSTGRES_DB="social_planner"
DATABASE_URL="postgresql://social_planner:<same password>@postgres:5432/social_planner"
REDIS_URL="redis://redis:6379"
AUTH_URL="https://yourdomain.com"
DOMAIN="yourdomain.com" # read by the Caddyfile
```

`DATABASE_URL`/`REDIS_URL` use the Compose service names (`postgres`, `redis`) as hostnames, not `localhost`. Update the Meta and LinkedIn app redirect URIs to `https://yourdomain.com/api/connect/{meta,linkedin}/callback` (see the setup steps above) — they must match `AUTH_URL` exactly.

### 4. Build, migrate, launch

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.prod.yml run --rm migrate npx prisma db seed   # first deploy only
docker compose -f docker-compose.prod.yml up -d
```

Re-run the `migrate` command (not `up -d`, which only starts the long-running services) after every deploy that changes `prisma/schema.prisma`.

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
src/lib/posts.ts              Post CRUD, status workflow, calendar/grid queries
src/lib/comments.ts            Internal + external post comments
src/lib/share-links.ts         Magic share-link CRUD (token, password, expiry, permissions)
src/lib/share-link-session.ts  Password-unlock + reviewer-name cookies for /review
src/lib/calendar-dates.ts      Month-grid date math shared by server + client
src/lib/media.ts               Media record CRUD
src/lib/s3-upload.ts           Presigned direct-to-S3/MinIO upload
src/lib/publish-jobs.ts        PublishJob status tracking
src/lib/publishers/           Facebook/Instagram/LinkedIn publishers + shared Graph API client
src/lib/email.ts               SMTP wrapper (nodemailer)
src/lib/notifications.ts       Email on client comment/approval
src/lib/              Prisma client, Redis, BullMQ queue, S3 client, token encryption
src/workers/token-refresh.ts  Background job: refreshes LinkedIn tokens before expiry
src/workers/publish.ts        Background job: publishes SCHEDULED posts (npm run worker:publish)
src/scripts/init-bucket.ts    One-time MinIO/S3 bucket + policy + CORS setup (npm run s3:init)
src/app/login                 Public login page
src/app/(app)/dashboard       Workspace list + create
src/app/(app)/w/[slug]        Workspace shell: overview, posts (Feed/Calendar/Grid), share, accounts, members
src/app/api/connect/          Meta/LinkedIn "connect account" OAuth flow (not NextAuth login)
src/app/review/[token]        Public magic-link review page + its own actions.ts
src/components/post-composer.tsx   Master text + per-channel overrides + media picker
src/components/post-calendar.tsx   Drag-and-drop month calendar
src/components/post-comments.tsx   Inline internal comment thread (Feed)
src/components/review/             Password gate, review comments, review post card (public page)
src/components/previews/      Facebook/Instagram/LinkedIn mockup preview cards (shared by composer + review)
vitest.config.mts             Test runner config (path alias, Node environment)
docker-compose.yml            Local Postgres + Redis + MinIO
Dockerfile                    Multi-stage build: `web` (standalone) + `worker` (full deps) targets
docker-compose.prod.yml       Production stack: Postgres, Redis, web, both workers, Caddy (HTTPS)
Caddyfile                      Reverse proxy + automatic HTTPS for docker-compose.prod.yml
```
