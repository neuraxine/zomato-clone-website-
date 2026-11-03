# Thaali

A demo-ready food delivery and dining platform: customer app, restaurant partner app, rider app and admin console in one Next.js app.

> The product name lives in `src/config/brand.ts`. Change it there to rename everything.

| App | URL |
|---|---|
| Customer | `/` |
| Restaurant partner | `/partner` |
| Rider | `/rider` |
| Admin | `/admin` |

## Run it locally

You need **Node 20+**, **pnpm** (`npm i -g pnpm`) and **Docker Desktop** (running).

```bash
git clone <this repo> && cd <repo>
git checkout claude/new-session-cb3873
pnpm install
pnpm local:setup     # starts a local Supabase in Docker, applies migrations + demo data, writes .env.local
pnpm dev             # → http://localhost:3000
```

The first `pnpm local:setup` downloads the Supabase Docker images (a few GB), so it takes a few minutes. After that it starts in seconds.

Then open:

| App | URL | Sign in as |
|---|---|---|
| Customer | http://localhost:3000 | Customer (Priya) |
| Restaurant partner | http://localhost:3000/partner | Owner (Saffron Courtyard) |
| Rider | http://localhost:3000/rider | Rider (Arjun) |
| Admin | http://localhost:3000/admin | Admin (Kavya) |

Use the **Demo** button (bottom-left) to switch accounts instantly. Phone login accepts OTP **123456**. Open each app in its own browser window (or a private window per account) to watch an order move across all four at once. In the admin console, **Run full demo** places an order and walks it to "Delivered" in about 90 seconds.

Payments run in demo mode (a test payment sheet) until Razorpay test keys are added to `.env.local`.

Other commands: `pnpm local:reset` wipes and re-seeds the database · `pnpm local:stop` stops Supabase · Supabase Studio (database browser) is at http://localhost:54323 · magic-link emails land in http://localhost:54324.

For a faster, production-like run: `pnpm build && pnpm start`.

### Deploy to Vercel

1. Import this repository into Vercel (Next.js is detected automatically) and set `NEXT_PUBLIC_DEMO_MODE=true`.
2. In the Vercel project, open **Storage → Create Database → Supabase** and connect it to the project. This adds the Supabase URL, keys and database URLs as environment variables.
3. Redeploy. Each build first runs `scripts/db-deploy.mjs`, which applies new migrations and, on the first deploy, loads the demo data.

Scheduled jobs in `vercel.json` run daily (Vercel's free plan allows no more); open order-tracking, partner and admin screens drive the simulation in between.

### Linux without Docker

`scripts/dev-stack/start.sh` runs a lightweight Supabase stand-in (needs Postgres 16 and Linux x64; it downloads the Auth and PostgREST binaries). `scripts/dev-stack/start.sh --reset` re-creates and seeds the database, then `pnpm dev`. The automated tests run against this stack.

### Connecting a real Supabase project

Put the project's URL, anon key, service-role key and database connection string (`SUPABASE_DB_URL`) in `.env.local`, apply `supabase/migrations` (e.g. `npx supabase link` then `npx supabase db push`), then `pnpm seed` for the demo data.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm build` | Production build |
| `pnpm test:e2e` | Playwright tests (builds must exist; starts `pnpm start` automatically) |
| `pnpm check` | typecheck + lint + build |

If Playwright's bundled Chromium isn't installed, point it at another one:
`PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome pnpm test:e2e`.

## Demo accounts

Created by the demo seed. Password for all: `Demo@1234`.

`customer@demo.in` (Priya) · `customer2@demo.in` (Rahul, Gold) · `customer3@demo.in` · `owner@demo.in` (Saffron Courtyard + Napoli Fire Oven) · `owner2@demo.in` · `owner3@demo.in` · `rider@demo.in` · `admin@demo.in` · `newpartner@demo.in` (restaurant awaiting approval)

With `NEXT_PUBLIC_DEMO_MODE=true`, the **Demo** button (bottom-left) switches between them.

## Project layout

```
src/
  app/(customer)/   customer app (route group, served at /)
  app/partner/      restaurant partner app
  app/rider/        rider app
  app/admin/        admin console
  components/ui/    shadcn/ui primitives
  components/       shared, layout and demo components
  config/           brand, navigation, demo personas
  lib/supabase/     server, browser and middleware clients
supabase/          migrations, demo seed, local Supabase config
e2e/                Playwright tests
```

## 2-minute demo script

Written in Phase 11, once the full order flow exists.
