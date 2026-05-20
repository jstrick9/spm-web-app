# Wedding Venue POC — Self-Hosted Architecture

> **👉 Trying this out for the first time?**
> **Start with [TRIAL.md](./TRIAL.md)** — a 20-minute step-by-step walkthrough
> with a decision checklist tied to your goals (cost, simplicity, control).
> This README is the architectural reference; TRIAL.md is the user manual.

---


A proof-of-concept demonstrating the **Option B architecture** from the architectural analysis: a single $5/mo Linux VPS running a Fastify + SQLite + React stack, with automatic HTTPS via Caddy and nightly backups to your home PC.

**What this POC proves:**
1. The data model from the previous review (organizations → events → memberships → guests → RSVPs) works end-to-end.
2. The RBAC system from the previous review is **enforced** at every endpoint — not decorative.
3. The Guest Portal works **publicly** (no login required) while the venue dashboard is properly authenticated.
4. The entire backend is a single SQLite file on disk that you fully control.
5. Deploys to a fresh Linux VPS in under 10 minutes with two commands.

---

## Quick start (local development)

You need Node.js 20+.

```bash
cd wedding-poc
npm run install:all     # installs server + client deps
npm run migrate         # creates ./server/data/wedding.db with the schema
npm run seed            # creates a demo user, org, event, and 3 guests

# In one terminal:
npm run dev:server      # Fastify on http://localhost:3000

# In another terminal:
npm run dev:client      # Vite dev server on http://localhost:5173
```

Open <http://localhost:5173> and log in with:
- Email: `owner@demo.local`
- Password: `wedding123`

Then click the seeded event → copy the public portal URL → open it in an incognito window → submit an RSVP. Watch it appear live in the dashboard.

---

## Production deployment (the $5/mo VPS)

### 1. Provision a VPS

Pick any of:
- **Hetzner** CX22 — €4.59/mo, EU
- **DigitalOcean** Basic Droplet — $6/mo, global
- **Linode** Nanode — $5/mo, global
- **Vultr** Cloud Compute — $5/mo, global

Choose **Ubuntu 24.04 LTS**. Note your VPS's public IPv4.

### 2. Buy a domain (~$10/year)

Cloudflare Registrar, Namecheap, or any other. Create an **A record** pointing your subdomain (e.g. `weddings.example.com`) at the VPS IP.

### 3. SSH in and install Docker

```bash
ssh root@your-vps-ip
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
```

### 4. Clone this repo and configure

```bash
git clone <your-repo-url> /root/wedding-poc
cd /root/wedding-poc

# Generate a strong JWT secret
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env

# Edit Caddyfile — replace 'yourwedding.example.com' with your actual domain
nano deploy/Caddyfile
```

### 5. Launch

```bash
docker compose up -d
```

That's it. In ~30 seconds Caddy will obtain a Let's Encrypt cert and the app is live at `https://yourwedding.example.com`.

Watch logs with: `docker compose logs -f`

### 6. Set up nightly backup to your home PC

On your **home machine** (not the VPS):

```bash
# One-time: set up passwordless SSH to the VPS
ssh-keygen -t ed25519                       # if you don't already have a key
ssh-copy-id root@yourwedding.example.com

# Edit the backup script with your VPS hostname
nano wedding-poc/scripts/backup-to-home.sh

# Test it
./wedding-poc/scripts/backup-to-home.sh

# Add to your home machine's crontab (3 AM nightly)
crontab -e
# Add this line:
0 3 * * * /full/path/to/wedding-poc/scripts/backup-to-home.sh >> ~/wedding-backups/backup.log 2>&1
```

You now have a fresh SQLite snapshot on your local hard drive every morning.

---

## Architecture overview

```
                              Internet
                                  │
                          HTTPS (port 443)
                                  │
                                  ▼
            ┌────────────────────────────────────────┐
            │  Caddy (auto Let's Encrypt + reverse   │
            │  proxy + compression + security headers)│
            └───────────────────┬────────────────────┘
                                │ HTTP (internal docker net)
                                ▼
            ┌────────────────────────────────────────┐
            │  Fastify app                           │
            │  ├─ /api/*  → JSON endpoints          │
            │  └─ /*      → React static bundle     │
            └───────────────────┬────────────────────┘
                                │
                                ▼
            ┌────────────────────────────────────────┐
            │  SQLite (one .db file in /data volume) │
            └────────────────────────────────────────┘
                                │
                  nightly sqlite3 .backup + rsync
                                │
                                ▼
            ┌────────────────────────────────────────┐
            │  Your home PC — /wedding-backups/      │
            └────────────────────────────────────────┘
```

### Why each piece

| Layer | Choice | Why |
|---|---|---|
| OS | Ubuntu 24.04 LTS | 5 years of security patches, ubiquitous |
| Container | Single Docker image | One unit to deploy; no separate DB / cache / queue services to babysit |
| Reverse proxy | **Caddy** | Single config file, auto-HTTPS in one line. The #1 thing that makes self-hosting hard for non-admins disappears. |
| Web framework | **Fastify** | Faster than Express, built-in TypeScript, less ceremony |
| Database | **SQLite (better-sqlite3)** | One file. No separate server. Fast enough for 100k+ daily users. The whole Stack Overflow data dump fits in SQLite. |
| Front-end | **React + Vite** | Matches the existing app's stack; bundle served as static files |
| Auth | **JWT (@fastify/jwt)** | Stateless, simple, supports the existing PBKDF2 hashes |
| Backup | `sqlite3 .backup` + `rsync` | Consistent snapshots even with concurrent writes; runs from your home machine, no extra services |

### What lives where

| Concern | File / module |
|---|---|
| SQL schema | `server/src/db/schema.sql` |
| DB connection | `server/src/db/database.ts` |
| Repositories (one per domain) | `server/src/db/repos.ts` |
| Password hashing | `server/src/lib/crypto.ts` |
| **RBAC resolver** | `server/src/lib/rbac.ts` |
| Auth middleware (JWT + membership loading) | `server/src/middleware/auth.ts` |
| Auth routes (register, login, /me) | `server/src/routes/auth.ts` |
| Event routes | `server/src/routes/events.ts` |
| Guest + RSVP routes (incl. public portal) | `server/src/routes/guests.ts` |
| Front-end | `client/src/App.tsx` |
| Production deploy | `Dockerfile`, `docker-compose.yml`, `deploy/Caddyfile` |
| Backup | `scripts/backup-to-home.sh` |

---

## What's intentionally NOT in the POC

To keep the slice focused, these are deferred to the full migration:
- **Rate limiting** on the public RSVP endpoint (use `@fastify/rate-limit` — 5 lines)
- **CSRF tokens** (not strictly needed with bearer-token auth on a separate domain, but worth adding)
- **Email sending** (use `nodemailer` or the existing Supabase Edge Function logic)
- **File uploads** (use `@fastify/multipart` writing to `/data/uploads`)
- **Real-time updates** (replace the 5-second polling with Server-Sent Events — `app.get('/api/events/:id/stream', { handler: sseHandler })`)
- **Migration runner with version tracking** (the `schema_version` table exists; just needs a `migrate-v2.sql` convention)
- **Per-guest portal tokens** (the column exists; the email-send flow is the only missing piece)
- **The full existing front-end** (this POC has a stub UI; the next phase plugs the existing React components into this API)

---

## Honest cost & operational summary

| Item | Cost |
|---|---|
| VPS (Hetzner CX22, 2 vCPU / 4 GB RAM / 40 GB SSD) | **€4.59/mo** ≈ $5 |
| Domain (.com via Cloudflare) | **$10/year** ≈ $0.83/mo |
| Backup to your home PC | $0 |
| Optional encrypted off-site backup (Backblaze B2, 10 GB) | $0.05/mo |
| **Total** | **~$6/month, ~$72/year** |

**Maintenance:** ~1 hour/quarter for OS updates (`apt upgrade && docker compose pull && docker compose up -d`). That's it.

**What can go wrong:**
- VPS dies → DNS change to a new VPS + restore latest backup = ~15 minutes downtime
- Domain expires → ~1 hour to re-register + propagate (set auto-renew!)
- SQLite file corrupts → restore last night's snapshot. Set up the backup BEFORE you need it.
- You forget to renew the Let's Encrypt cert → impossible; Caddy renews automatically

---

## Testing the POC

After `npm run dev:server` + `npm run dev:client` + `npm run seed`:

```bash
# Login
curl -sX POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@demo.local","password":"wedding123"}'

# List orgs (use token from previous response)
TOKEN=...
curl -sH "Authorization: Bearer $TOKEN" http://localhost:3000/api/orgs

# Submit a public RSVP (no auth)
curl -sX POST http://localhost:3000/api/portal/<eventId>/rsvp \
  -H 'Content-Type: application/json' \
  -d '{"attending":true,"mealChoice":"vegetarian","notes":"cant wait!"}'

# Health check
curl http://localhost:3000/api/health
```

---

## Migration from the existing app

This POC implements the same data model as the production Supabase migration in the original repo (`supabase/migrations/0001_initial.sql`). To migrate the full app:

1. **Replace `src/services/backend/supabaseClient.ts`** with a thin `apiClient.ts` that wraps fetch (already done in `client/src/lib/api.ts` here).
2. **Replace each `localStorage` read in `useLayoutState.ts`, `useRBAC.ts`, `guestPortal.ts`, `auth.ts`** with the corresponding API call.
3. **Drop in this server** unchanged.
4. **Add the missing routes** (layouts, vendors, timeline, etc.) following the same pattern — each one is ~40 lines and mirrors a repo.

Estimated effort: ~2 weeks for one engineer, since the front-end already has the right abstractions (`Repository` pattern just isn't wired yet).
