# Ordering and Returns System (Vercel rebuild)

A from-scratch rebuild of the Ordering and Returns System as a standalone
Next.js app, deployable entirely on free tiers: **Vercel Hobby** (hosting),
**Neon free** (Postgres), **GitHub Actions** (background scheduling).

Tabs: **Deals** (home) · Orders · Returns · Requests · Addresses · Retailers.
Retailers covered: **Amazon, Walmart, Target, Costco**. Costco appears for deals only — login/checkout support is not enabled for it yet.

## Architecture

```
Browser ──> Next.js App Router (Vercel)
              ├─ /deals      search + manually curated available deals, Buy button
              ├─ /orders     checkout pipeline: approved_for_checkout → processing → placed | needs_attention
              ├─ /returns    return pipeline: fetching → ready | needs_attention (+ retailer QR)
              ├─ /requests   manual free-text item requests
              ├─ /addresses  CRUD + default shipping address (required before Buy)
              ├─ /retailers  login storage, AES-256-GCM encrypted, masked display only
              └─ /api/...
                   ├─ POST /api/cron/process  background worker (CRON_SECRET bearer)
                   └─ CRUD routes for every tab

GitHub Actions (every 5 min) ──POST──> /api/cron/process
Neon Postgres <── Drizzle ORM (HTTP driver, no persistent connections)
```

### How buying works

1. You tap **Buy** on a deal — that tap IS the explicit purchase approval.
   The app creates an order with `checkout_status = approved_for_checkout`.
   Nothing is charged at this point.
2. Every 5 minutes the GitHub Action calls `POST /api/cron/process`.
3. The worker picks up approved orders, re-checks the price, and refuses to
   proceed if it moved more than **10%** (`needs_attention`, plain reason).
4. It then attempts checkout through the per-retailer driver
   (`lib/checkout/driver.ts`) using your saved retailer login and the
   retailer's saved/default payment method, recording the retailer
   confirmation number + charged total on success, or a plain-language failure
   reason (`login challenge`, `OTP/CAPTCHA needed`, `item unavailable`,
   `no saved payment method`, `bot-blocked`, `timeout`) on failure.

### How returns work

Request a return on a placed order → status `fetching`. The worker asks the
retailer driver for the return QR code. **QR codes can only come from the
retailer's own return flow** — the app cannot mint them. When the retailer
issues one it is stored and shown; otherwise a plain reason is recorded
(`needs_attention`).

### Honest limits (read before deploying)

- **No headless checkout on Vercel Hobby.** Retailer checkout and return-QR
  retrieval need a real browser session. Vercel's free serverless functions
  have short durations and datacenter IPs that Amazon/Walmart/Target
  bot-block. The driver abstraction (`lib/checkout/driver.ts`) is built for
  this: each retailer driver runs preflight checks and **honestly reports the
  block with a deep link to finish in your browser** — it never fakes a
  confirmation number or charged total. The `attemptCheckout` / `fetchReturnQr`
  methods are the extension points for a future dedicated browser-automation
  worker running outside Vercel.
- **No free product API exists** for Amazon/Walmart/Target, and all three
  block datacenter scraping. Deal discovery is therefore manual: paste product
  links you found into "Add a deal". Only `availability = available` listings
  are shown; sold-out/unavailable are hidden. The price re-check guards
  against the recorded price changing after approval.
- **Credentials cannot be migrated** from anywhere else — re-enter your
  retailer logins in the Retailers tab after deploy. They are encrypted with
  AES-256-GCM (`ENCRYPTION_KEY`); losing the key means re-entering them.
- **Serverless duration:** the worker asks for `maxDuration = 60` but the free
  tier caps it lower; it processes in small batches (10 orders / 10 returns /
  25 searches per run) and is idempotent, so interrupted runs just continue
  next tick.
- **GitHub Actions schedule delays:** cron runs on the free tier can lag a few
  minutes under load; harmless here.

## 100% free-tier service list

| Service | Tier | Used for |
|---|---|---|
| Vercel Hobby | Free | Next.js hosting, serverless functions |
| Neon Postgres | Free tier | Database (Drizzle ORM over HTTP) |
| GitHub Actions | Free (public repo) | Every-5-minute cron hitting `/api/cron/process` |

No paid services, no paid SDKs. The repo must be **public** for free
unlimited Actions minutes.

## Deploy instructions

### 1. Database (Neon)

1. Create a free project at neon.tech.
2. Copy the connection string (it ends with `?sslmode=require`).
3. Run migrations once against it:
   ```bash
   cp .env.example .env.local   # fill in DATABASE_URL
   npm install
   npm run db:generate          # only needed if you changed db/schema.ts
   npm run db:migrate
   ```

### 2. GitHub repo

1. Create a **public** repo, push `main`. (Public keeps the scheduled
   background worker free — no secrets live in the code.)
2. Repo Settings → Secrets and variables → Actions → add:
   - `APP_URL` = your production URL, e.g. `https://your-app.vercel.app`
   - `CRON_SECRET` = long random token (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
3. The workflow (`.github/workflows/cron.yml`) is **not for deployment** —
   Vercel handles that. It wakes up every 5 minutes and tells the production
   app to process approved orders and returns (`POST /api/cron/process`).
   Without it, Buy orders would sit in "approved" forever. It also has a
   manual "Run workflow" button.

### 3. Vercel (production only)

1. Import the repo. Framework preset: Next.js. No build changes needed.
2. Add environment variables (see table below) to the **Production**
   environment.
3. Deploy `main` → Production. There is no Preview/test deployment —
   testing happens on localhost (see below).

### Test vs prod mapping

| Where | Purpose | Database | Notes |
|---|---|---|---|
| `localhost:3000` (`npm run dev`) | Test | Local Postgres or a separate Neon database | Set `APP_URL=http://localhost:3000` in `.env.local` |
| Vercel Production (`main` branch) | Prod | Neon primary database | GitHub workflow targets this URL every 5 min |

Use a different database for localhost testing so test orders and retailer
logins never touch prod data.

## Environment variables

| Variable | Required | Where | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Yes | Vercel Production + `.env.local` (different DBs) | Neon Postgres connection string |
| `APP_PASSWORD` | Yes | Vercel Production + `.env.local` (can differ) | App login gate password |
| `ENCRYPTION_KEY` | Yes | Vercel Production + `.env.local` (keep stable per env) | 32-byte AES-256-GCM key, hex (64 chars) or base64. Losing it = re-enter retailer logins |
| `CRON_SECRET` | Yes | Vercel Production (must match GitHub secret) | Bearer token for `/api/cron/process` |
| `APP_URL` | Yes | Vercel Production | Public prod URL (logout redirect, cron target) |

GitHub repo secrets needed: `APP_URL`, `CRON_SECRET`.

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # CRON_SECRET
```

## Local development

```bash
cp .env.example .env.local   # fill in real values
npm install
npm run dev                  # http://localhost:3000
```

Login with `APP_PASSWORD`. Note: `middleware.ts` protects everything except
`/login` and `/api/cron/process`.

## Project layout

```
app/                  App Router pages + API routes
  api/cron/process/   background worker (search fill, checkout, return QR)
  api/{addresses,deals,orders,returns,requests,retailers}/  CRUD + Buy
components/           tab UIs (client components)
lib/
  checkout/driver.ts  per-retailer checkout/return drivers (honest stubs)
  deals/provider.ts   deal search provider (manual catalog)
  crypto.ts           AES-256-GCM encrypt/decrypt + username masking
  auth.ts             jose-signed session cookie, cron bearer check
  db.ts               lazy Drizzle + Neon client
db/schema.ts          tables: addresses, retailer_connections, deal_searches,
                      deals, orders, returns, requests
drizzle/              generated SQL migrations
.github/workflows/   cron.yml — every-5-minute worker trigger
```

## Security notes

- Retailer passwords are encrypted at rest (AES-256-GCM) and never logged;
  APIs only ever return masked usernames.
- `ENCRYPTION_KEY` lives only in env vars — never in the repo (see `.gitignore`).
- The cron endpoint uses its own `CRON_SECRET` bearer token, separate from the app password.
- Session cookie is `HttpOnly`, `SameSite=Lax`, `Secure` in production, signed with `jose` (HS256).
