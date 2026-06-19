# Azzip Pizza Corn Kernel Game

Server-authoritative instant-win promo microsite: a corn-on-the-cob kernel grid where 50 prizes are pre-assigned at seed time. Built with **Next.js 15**, **Turso** (libSQL) / local SQLite, and **Tailwind CSS**.

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
| `TURSO_DATABASE_URL` | Yes (Vercel) | Turso libsql URL |
| `TURSO_AUTH_TOKEN` | Yes (Vercel) | Turso auth token |
| `DATABASE_PATH` | No | Local file DB when Turso unset |
| `CAMPAIGN_STARTS_AT` / `CAMPAIGN_ENDS_AT` | No | Campaign window |
| `FULFILLMENT_EMAIL` | No | Winner notifications (default `zack.mathis@azzippizza.com`) |
| `RESEND_API_KEY` | No | Email notifications via Resend |
| `TURNSTILE_*` | No | Cloudflare Turnstile on win form |

## Deploy to Vercel (`corn.azzippizza.com`)

1. Create a new Vercel project from this directory.
2. Set environment variables in Vercel (`ADMIN_PASSWORD`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, Turnstile keys).
3. Create a [Turso](https://turso.tech) database and add credentials to Vercel (Storage → Create → Turso, or set env vars manually).
4. Run `npm run seed` once against production (local with Turso env vars, or via `/admin` seed).
5. Add DNS: `corn.azzippizza.com` → Vercel.
6. Put Cloudflare in front for bot protection and Turnstile.

## Game design

- **Grid**: 58×29 cells, 30×38px kernels, 8px radius, 1px black border
- **Mask**: Oval cob silhouette — **1,250** playable kernels (432 inactive cells hidden)
- **Colors**: Seeded yellows weighted toward `#FFDB00` between `#FFAC00`–`#FFEC00`
- **Prizes**: 25× Free Love It Elote, 25× $5 Off — pre-assigned at seed
- **One play per session**; wins deduped by normalized email or E.164 phone

## Production gaps

- Email/SMS verification before prize finalize
- Analytics (GA4/Plausible)
- Legal review for IN/IL sweepstakes rules
- Honeypot kernels / shadow-ban for bots
- GDPR/CCPA deletion workflow automation
