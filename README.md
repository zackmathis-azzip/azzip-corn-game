# Azzip Pizza Corn Kernel Game

Server-authoritative instant-win promo microsite: a corn-on-the-cob kernel grid where 50 prizes are pre-assigned at seed time. Built with **Next.js 15**, **SQLite** (`better-sqlite3`), and **Tailwind CSS**.

## Quick start

From the project root (`Corn Game/`):

```bash
cp .env.example .env.local
# Edit .env.local — set ADMIN_PASSWORD at minimum

npm install
npm run seed    # Creates campaign + 50 winning kernels
npm run dev     # http://localhost:3000
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run seed` | Archive active campaign and seed a new one |

## Routes

| Path | Description |
|------|-------------|
| `/` | Play page — corn grid, win/lose modals |
| `/admin` | Campaign ops (password protected) |
| `/rules` | Official Rules |
| `/privacy` | Privacy Policy |

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/campaign/current` | Active campaign metadata |
| `GET` | `/api/campaigns/[id]/kernel-state` | Claimed kernels + optional full grid (`?kernels=0` for poll-only) |
| `POST` | `/api/kernels/[id]/claim` | Atomic kernel claim (session cookie) |
| `POST` | `/api/claims/complete` | Winner contact form + Turnstile |

## Environment variables

See [`.env.example`](.env.example) for the full list.

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_PASSWORD` | Yes (admin) | Protects `/admin` |
| `DATABASE_PATH` | No | SQLite file path (default `./data/corn-game.db`) |
| `CAMPAIGN_STARTS_AT` / `CAMPAIGN_ENDS_AT` | No | Campaign window |
| `FULFILLMENT_EMAIL` | No | Winner notifications (default `zack.mathis@azzippizza.com`) |
| `RESEND_API_KEY` | No | Email notifications via Resend |
| `TURNSTILE_*` | No | Cloudflare Turnstile on win form |

## Deploy to Vercel (`corn.azzippizza.com`)

1. Create a new Vercel project from this directory.
2. Set environment variables in Vercel (especially `ADMIN_PASSWORD`, `RESEND_API_KEY`, Turnstile keys).
3. **SQLite on Vercel**: the default file-based DB is ephemeral on serverless. For production either:
   - Mount persistent storage (Vercel doesn't support this natively), or
   - Switch `DATABASE_PATH` to a hosted SQLite/Turso/libSQL volume, or
   - Migrate to Postgres (Supabase/Neon).
4. Run `npm run seed` once via a deploy hook or local script pointed at production DB.
5. Add DNS: `corn.azzippizza.com` → Vercel.
6. Put Cloudflare in front for bot protection and Turnstile.

## Game design

- **Grid**: 53×24 cells, 36×45px kernels, 9px radius, 1px black border
- **Mask**: Oval cob silhouette — inactive cells are not rendered/clickable
- **Colors**: Seeded yellows weighted toward `#FFDB00` between `#FFAC00`–`#FFEC00`
- **Prizes**: 25× Free Love It Elote, 25× $5 Off — pre-assigned at seed
- **One play per session**; wins deduped by normalized email or E.164 phone

## Production gaps

- Email/SMS verification before prize finalize
- Persistent DB on serverless (Turso/Postgres)
- Analytics (GA4/Plausible)
- Legal review for IN/IL sweepstakes rules
- Honeypot kernels / shadow-ban for bots
- GDPR/CCPA deletion workflow automation
