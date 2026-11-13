# bildstueck — Social Planner

Self-hosted social media planning, client-approval and auto-publishing platform (Facebook, Instagram, LinkedIn) — a Planable-style workflow, run on your own Vercel + Neon + Cloudflare R2 stack instead of a paid SaaS.

See [`/Users/thilofriedrich/.claude/plans/zesty-wandering-umbrella.md`](/Users/thilofriedrich/.claude/plans/zesty-wandering-umbrella.md) for the full feature roadmap.

## Tech stack

- Next.js 16 (App Router, TypeScript), Tailwind CSS, shadcn/ui
- **Vercel** hosting — no server to manage, deploys from GitHub automatically
- **Neon** (serverless Postgres) + Prisma 7 (driver adapters — see `prisma.config.ts` / `src/lib/prisma.ts`)
- **Cloudflare R2** (S3-compatible) for media — required because the Instagram Graph API fetches media by public URL
- NextAuth.js (Credentials) for the internal team login. Clients never get accounts — they use invitation links (`/review/<token>`)
- No queue, no Redis, no background processes to keep running: scheduled publishing and token refresh are two ordinary API routes, pinged on a schedule by a free GitHub Actions workflow (`.github/workflows/cron.yml`) — see "Scheduler & automatic publishing" below for why

## Local development

No Docker needed — local dev talks to the same kind of free, hosted Postgres (Neon) and object storage (R2) that production uses, just with your own dev values.

### 1. Install dependencies

```bash
npm install
```

### 2. Set up a free Neon database

1. Create a project at [neon.tech](https://neon.tech) (free tier is plenty for this).
2. Copy the **pooled** connection string (the one with `-pooler` in the hostname) from the Neon dashboard.
3. Append `&pgbouncer=true` to it — required for Prisma to work correctly through Neon's connection pooler.

### 3. Set up a free Cloudflare R2 bucket

See "Set up Cloudflare R2" further down — same steps for local dev and production. For quick local testing you can use R2's free `r2.dev` development URL instead of a custom domain (it's rate-limited, so switch to a custom domain before going live).

### 4. Configure environment variables

```bash
cp .env.example .env
```

Fill in `DATABASE_URL` (step 2) and the `S3_*` values (step 3). Generate the remaining secrets:

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 32      # TOKEN_ENCRYPTION_KEY (must stay 64 hex chars)
openssl rand -base64 32   # CRON_SECRET
```

### 5. Create the database schema and a first admin user

```bash
npm run db:migrate
npm run db:seed
```

The seed script creates `admin@example.com` / `changeme123` (override via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env vars before seeding). Change the password after first login.

### 6. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on `/login`. After logging in, create a workspace from `/dashboard`, then connect accounts and manage team members from `/w/<slug>`.

### Adding more team members

There's no self-serve sign-up — team accounts are internal. To add someone, either:
- run `SEED_ADMIN_EMAIL=them@example.com SEED_ADMIN_PASSWORD=... npm run db:seed` again, or
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
| `npm run test` / `npm run test:watch` | Run the vitest test suite |
| `npm run lint` / `npm run format` | ESLint / Prettier |

## Connecting social accounts

From `/w/<slug>/accounts`, a workspace **Owner** can connect Facebook Pages (with their linked Instagram Business/Creator accounts) and LinkedIn. Both go through a custom OAuth "connect" flow (`/api/connect/meta`, `/api/connect/linkedin` + their `/callback` routes) — this is deliberately separate from the NextAuth login at `/api/auth/*`, since it's "let this workspace publish as this external account", not "sign in as this app user". Connecting once pulls in **every** Page/account/Company Page the connecting user has access to — not just one.

### Meta App Setup (Facebook + Instagram)

1. Go to <https://developers.facebook.com/apps> and create a new app (type: **Business**), picking the "Content-Management" use cases that cover Instagram and Page content (new Meta apps get the **Facebook Login for Business** product automatically, not classic Facebook Login).
2. Under **App Settings → Basic**, note the **App ID** and **App Secret** → put them in `.env` as `META_APP_ID` / `META_APP_SECRET`.
3. Under **Facebook Login for Business → Settings**, add a **Valid OAuth Redirect URI** for each environment you use: `http://localhost:3000/api/connect/meta/callback` (local) and `https://your-project.vercel.app/api/connect/meta/callback` (production).
4. Under **Facebook Login for Business → Configurations**, create a Configuration granting:
   - `pages_show_list`, `pages_read_engagement`, `pages_manage_posts` (Facebook Page publishing)
   - `instagram_basic`, `instagram_content_publish` (Instagram publishing — requires the IG account to be a Business/Creator account linked to a Facebook Page)

   Copy its **Configuration ID** → put it in `.env` as `META_CONFIG_ID`. This is what `buildMetaAuthorizeUrl` (`src/lib/oauth/meta.ts`) sends instead of a plain `scope` list — Facebook Login for Business authorizes via Configuration, not raw scopes (a plain `scope` param gets rejected with "Invalid Scopes").
5. These permissions need **App Review** before they work for anyone other than the app's own Admins/Testers in Development Mode — see "App Roles" below for what that means for connecting *any* client's Page right away.
6. While the app is still in **Development Mode**, add yourself/your test users as **Admins/Testers** under **App Roles** so you can connect accounts and test publishing before App Review approves the app for everyone else.
7. Instagram's publish endpoint fetches media by URL, so `S3_PUBLIC_BASE_URL` must be a real, public HTTPS URL — see "Set up Cloudflare R2".
8. The Graph API version is pinned in `src/lib/oauth/meta.ts` (`GRAPH_VERSION`, currently v26.0) — bump it there when Meta deprecates that version.

Once connected, Page access tokens obtained this way are derived from a long-lived user token and don't expire on a fixed schedule — there's no silent refresh for them. If Meta ever invalidates one (password change, long inactivity, revoked permission), the Accounts page shows it as expired/expiring and the Owner just reconnects.

### LinkedIn App Setup

1. Go to <https://www.linkedin.com/developers/apps> and create a new app (requires an associated LinkedIn Company Page, even if you'll also post to personal profiles).
2. Under **Auth**, note the **Client ID** and **Client Secret** → put them in `.env` as `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`.
3. Add an **Authorized redirect URL** for each environment: `http://localhost:3000/api/connect/linkedin/callback` (local) and `https://your-project.vercel.app/api/connect/linkedin/callback` (production).
4. Request the **Sign In with LinkedIn using OpenID Connect** product (for `openid`/`profile`/`email`) — this is self-serve and approves instantly.
5. By default, only personal-profile posting (`w_member_social`) is requested. Company Page posting needs the **Community Management API** product, which requires LinkedIn's (slower) approval process. Once approved, set `LINKEDIN_ORGANIZATION_SCOPES_ENABLED=true` — requesting those scopes before approval makes the *entire* OAuth request fail, so leave it `false` until then.
6. If your app is also an approved Marketing Developer Platform partner, LinkedIn issues a `refresh_token` on connect; the daily `/api/cron/refresh-tokens` run uses it to silently refresh access tokens before their 60-day expiry. Without that approval, access tokens still work for 60 days but the Owner has to reconnect manually afterwards (surfaced on the Accounts page).

## Post composer & media

From `/w/<slug>/posts`, any workspace member can draft a post: one master text + media, optionally customized per connected channel, with a live mockup preview (desktop/mobile toggle) for Facebook, Instagram and LinkedIn.

Media uploads go straight from the browser to R2 via a presigned URL (the file never passes through the Next.js server) — see `src/lib/s3-upload.ts` and `requestMediaUploadAction`/`confirmMediaUploadAction` in `src/app/(app)/w/[slug]/posts/actions.ts`. Only JPEG/PNG images and MP4/MOV videos are accepted at upload time (8MB / 1GB sanity caps); exact per-platform limits (aspect ratio, duration, carousel size) are enforced later, when actually publishing.

## Views & internal comments

`/w/<slug>/posts` has three views, switchable via the tabs at the top:

- **Feed** (default) — chronological list of posts, filterable (**Anstehend** / **Veröffentlicht** / **Alle**), each with an inline, internal comment thread (add a comment, mark it done/reopen). These are team-internal comments (`Comment.authorType = INTERNAL`); client-facing comments via an invitation link are external.
- **Kalender** — a month grid you can navigate. Posts with no `scheduledAt` sit in a tray above the grid; drag any post chip onto a day (or back into the tray) to set/clear its scheduled date.
- **Instagram Grid** — a 3-column preview of how a connected Instagram account's grid would look, ordered by `scheduledAt` (unscheduled posts sort to the end). Switch between accounts with the pills above the grid if a workspace has more than one.

A connected-channels strip sits above all three views, so it's always clear which accounts a post could go out on.

Setting a date (from the composer or the calendar) only sets `Post.scheduledAt` — it does **not** change `status` or queue anything for publishing; see "Client approval" and "Scheduler" below for what does.

## Client approval via invitation link

**Internal side:** a Draft is invisible to clients. From the Feed, click **"Zur Freigabe einreichen"** to move it to `PENDING_APPROVAL` (and **"Zurück zu Entwurf"** to pull it back for more edits). A workspace **Owner** manages invitation links from `/w/<slug>/share` — create one with an optional password, an optional expiry (in days), and four independent toggles: allow commenting, allow approving, allow editing the text, allow uploading media. Deleting a link immediately revokes it.

**Client side:** the link (`/review/<token>`) needs no account — it's the one thing you send a client yourself, by WhatsApp or email. It shows every post with status `PENDING_APPROVAL` or later — never raw Drafts. Depending on the link's toggles, a visitor can:
- view a live per-channel mockup (the same Facebook/Instagram/LinkedIn preview cards from the composer),
- comment and mark comments done (shown inline next to the team's own comments),
- click **Freigeben** to approve a post (`PENDING_APPROVAL` → `APPROVED`),
- edit the post's master text directly — logged as a plain-text version history entry rather than a dedicated versions table; channels with their own customized text aren't touched by this,
- **upload their own photos/videos** (`canUpload`, on by default) — these land straight in the workspace's media library, the same one the composer picks from, so the team can build the next posts from whatever the client just sent.

The first time a visitor comments, approves, or edits, they're asked for a display name; it's remembered in a cookie so they're not asked again. A password-protected link sets a separate, signed, link-specific cookie once unlocked.

Every status change and text edit is recorded on `ApprovalEvent` and shown as a small "Verlauf" (history) list on each post, both internally and on the review page.

## Scheduler & automatic publishing

Once a post is `APPROVED` (or previously `FAILED`), the Feed shows:
- **Terminieren** — only when the post has a future `scheduledAt` — marks it `SCHEDULED`; the cron route (below) actually publishes it once that time passes.
- **Jetzt veröffentlichen** / **Erneut versuchen** — marks it `SCHEDULED` and publishes immediately, in the same request.
- **Planung abbrechen** (while `SCHEDULED`) — drops it back to `APPROVED`.

**Why there's no worker process:** Vercel is serverless — functions run per-request and don't stay alive listening for jobs, so there's no "queue worker" the way a self-hosted app would have one. Instead, `src/app/api/cron/publish` is a normal API route that, when called, publishes every `SCHEDULED` post whose `scheduledAt` has passed. What calls it on a schedule is `.github/workflows/cron.yml` — a GitHub Actions workflow (free) that pings it every 5 minutes. (Vercel does have its own Cron Jobs feature, but the free Hobby plan only allows once a day, too coarse for "publish at 14:00".) `src/app/api/cron/refresh-tokens` is the same pattern, pinged once a day, replacing the old token-refresh worker.

Both routes check an `Authorization: Bearer <CRON_SECRET>` header themselves — that's their real security boundary (see `src/proxy.ts`, which only does an optimistic redirect for logged-out *browser* visits and explicitly leaves `/api/cron` alone). Set `CRON_SECRET` to the same value in `.env` (local), Vercel's environment variables (production), and as a GitHub Actions repo secret.

Each channel is published by `src/lib/publishers/{facebook,instagram,linkedin}.ts`:
- **Facebook** — a plain `/feed` post for text-only; `/photos` or `/videos` for a single image/video; multiple *images* are uploaded unpublished first and attached to one `/feed` post (Facebook has no Instagram-style carousel container, and a video can't be mixed into that).
- **Instagram** — the Graph API container flow: create a container per image/video (`is_carousel_item` for 2–10 items), poll `status_code` until a video container is `FINISHED`, then `media_publish`.
- **LinkedIn** — the current `/rest/posts` API (not the deprecated `/v2/ugcPosts`), with a single image/video uploaded via the Images/Videos API first (video uses LinkedIn's chunked multipart upload). **Multiple media per LinkedIn post isn't implemented** (LinkedIn's organic MultiImage API) — that call fails with a clear error rather than guessing. The `Linkedin-Version` header is a hardcoded `YYYYMM` in `src/lib/publishers/linkedin.ts` — bump it periodically per LinkedIn's versioning policy.

**Retries & partial failure:** a single attempt per cron tick (no built-in backoff loop) — `src/lib/publish-post.ts`. Each `PostChannelVariant` records its own `publishedExternalId` the moment *that* channel succeeds, so retrying (the next cron tick, or clicking "Erneut versuchen") skips channels already posted instead of double-posting. If a post still has failures, it becomes `FAILED` and the Feed shows the combined error message; there's no automatic cross-channel rollback — a post can legitimately end up published on some channels and failed on others, and that's shown rather than hidden.

## Tests

No email notifications by design — comments and approvals are meant to be checked in the app itself (the agency communicates externally over WhatsApp/email on its own terms).

```bash
npm run test       # vitest, once
npm run test:watch # vitest, watch mode
```

Covers the pure logic (slug generation, calendar/month-grid date math, the token-encryption round-trip) and all three publishers end-to-end against a mocked `fetch` — single media, multi-image/carousel, LinkedIn's chunked video upload, and error surfacing from the Graph/LinkedIn APIs. There's no integration test against a real database.

## Deployment (Vercel)

### 1. Push to GitHub, import into Vercel

Push this repo to a GitHub repository, then at [vercel.com/new](https://vercel.com/new) import it — Vercel detects Next.js automatically, no config needed.

### 2. Set up Cloudflare R2 for media

1. Create an R2 bucket in the Cloudflare dashboard.
2. Under the bucket's **Settings → Custom Domains**, connect a subdomain (e.g. `media.yourdomain.com`) — this is what makes objects publicly readable over HTTPS, required for Meta/Instagram to fetch media at publish time. (The free `r2.dev` URL works for quick testing, but it's rate-limited — switch to a custom domain before going live.)
3. Under **Settings → CORS Policy**, allow `GET`/`PUT` from your Vercel domain(s) (needed for the browser's direct upload in the composer).
4. Create an R2 API token (Account → R2 → Manage API Tokens) for `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`.
5. Set `S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"`, `S3_BUCKET` to the bucket name, and `S3_PUBLIC_BASE_URL="https://media.yourdomain.com"`.

### 3. Set environment variables in Vercel

Project Settings → Environment Variables: the same variables as `.env.example`, with production values — `DATABASE_URL` from Neon, the R2 values from step 2, `AUTH_URL` set to your Vercel production URL, and freshly generated `AUTH_SECRET` / `TOKEN_ENCRYPTION_KEY` / `CRON_SECRET` (don't reuse the ones from local dev). Update the Meta and LinkedIn app redirect URIs to match (see "Connecting social accounts" above).

### 4. Apply the database schema

From your machine, pointed at the production `DATABASE_URL`:

```bash
npm run db:deploy
npm run db:seed   # first deploy only, creates the first admin user
```

### 5. Set up the GitHub Actions secrets

Repo → Settings → Secrets and variables → Actions, add:
- `APP_URL` — your Vercel production URL (e.g. `https://your-project.vercel.app`)
- `CRON_SECRET` — same value as in Vercel's environment variables

`.github/workflows/cron.yml` starts running automatically once these exist (every 5 minutes for publishing, once a day for token refresh). Trigger either manually from the repo's **Actions** tab (`workflow_dispatch`) to test it without waiting.

That's the whole deployment — no server, no Docker, no Redis, nothing to keep running yourself. Pushing to the repo's default branch redeploys automatically.

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
src/lib/share-links.ts         Invitation-link CRUD (token, password, expiry, permissions)
src/lib/share-link-session.ts  Password-unlock + reviewer-name cookies for /review
src/lib/calendar-dates.ts      Month-grid date math shared by server + client
src/lib/media.ts               Media record CRUD
src/lib/s3-upload.ts           Presigned direct-to-R2 upload
src/lib/publish-jobs.ts        PublishJob status tracking
src/lib/publish-post.ts        Publishes one post to every pending channel
src/lib/publishers/           Facebook/Instagram/LinkedIn publishers + shared Graph API client
src/lib/              Prisma client, S3 client, token encryption
src/app/api/cron/              Publish + token-refresh routes, pinged by GitHub Actions
src/app/login                 Public login page
src/app/(app)/dashboard       Workspace list + create
src/app/(app)/w/[slug]        Workspace shell: overview, posts (Feed/Calendar/Grid), share, accounts, members
src/app/api/connect/          Meta/LinkedIn "connect account" OAuth flow (not NextAuth login)
src/app/review/[token]        Public invitation-link review page + its own actions.ts
src/components/post-composer.tsx   Master text + per-channel overrides + media picker
src/components/post-calendar.tsx   Drag-and-drop month calendar
src/components/post-comments.tsx   Inline internal comment thread (Feed)
src/components/review/             Password gate, review comments, review post card, upload (public page)
src/components/previews/      Facebook/Instagram/LinkedIn mockup preview cards (shared by composer + review)
public/brand/                 bildstueck logo assets
vitest.config.mts             Test runner config (path alias, Node environment)
.github/workflows/cron.yml    Pings the two cron routes on a schedule (free, replaces a worker process)
```
