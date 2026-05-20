# Local Trial — Step by Step

This guide walks you through running the POC on your own laptop so you can decide whether to commit to the full migration. **Estimated time: 20 minutes.**

The goal of this trial is to let you *feel* the architecture before committing — so as you go, pay attention to the **evaluation checklist** at the end. Those are the questions only you can answer.

---

## What you'll do

1. Install prerequisites (5 min, one-time)
2. Install & seed the POC (3 min)
3. Run the two-terminal dev mode (2 min)
4. Click through the full user flow: register → create event → add guests → submit RSVP as a guest → see it appear live (5 min)
5. Inspect the database file on disk (2 min)
6. Try the "production-style" run as a single binary (3 min)

---

## 0. Prerequisites

You need:

- **Node.js 20 LTS or 22 LTS.** ⚠️ **Do NOT use Node 23, 24, or 25** — the `better-sqlite3` package doesn't ship prebuilt binaries for the "Current" release line, so installation will fail trying to compile from C++ source (requiring a 7 GB Visual Studio Build Tools install on Windows). The `package.json` enforces `>=20.0.0 <23.0.0` so `npm install` will warn you if you're on the wrong version.
  - Check your version: `node -v`
  - Get the **LTS** build from <https://nodejs.org/> (the *left* green button, not the right one). It's labeled "Recommended for Most Users."
- **Git** (only if you're cloning rather than working from a local copy).
- A terminal:
  - **macOS**: built-in Terminal or iTerm2
  - **Windows**: PowerShell (any version) — works out of the box
  - **Linux**: anything

That's it. No Docker required for the local trial. No database server to install. No PostgreSQL, no Redis, nothing else.

---

## 1. Get the code onto your machine

If you cloned this repo:
```bash
cd wedding-poc
```

If you're starting from a zip:
```bash
unzip wedding-poc.zip
cd wedding-poc
```

---

## 2. Install everything (one-time)

From the `wedding-poc` directory:

```bash
npm run install:all
```

This installs both the `server/` and `client/` dependencies. Takes ~30 seconds.

**Windows note:** This installs a **prebuilt** `better-sqlite3` binary as long as you're on Node 20 or 22 LTS (see prerequisites above). If you see `gyp ERR! find VS` or mentions of Visual Studio in the output, you're on Node 23+ — uninstall it and install Node 22 LTS. No Visual Studio install is needed when using the right Node version.

---

## 3. Set up the database

```bash
npm run migrate    # creates server/data/wedding.db with the schema
npm run seed       # creates a demo user, organization, and event
```

You should see:
```
[migrate] applying schema from /…/server/src/db/schema.sql
[migrate] done. schema_version = 1
[seed] created user owner@demo.local / wedding123
[seed] created organization Seven Paths Manor (…)
[seed] created event Smith × Jones (…)
[seed] seeded 3 sample guests
```

📁 **Important:** the database is now a single file at `wedding-poc/server/data/wedding.db`. That file IS your entire database. Back it up by copying it. Move it to another machine by copying it. This is the whole point of SQLite — your "control" requirement, made concrete.

---

## 4. Run it — dev mode (two terminals)

Open **two** terminal windows, both in the `wedding-poc` directory.

**Terminal 1 — the API server:**
```bash
npm run dev:server
```
You should see:
```
{"level":30,"msg":"Server listening at http://0.0.0.0:3000"}
{"level":30,"msg":"🎉 Wedding POC server listening on http://0.0.0.0:3000"}
```

**Terminal 2 — the React UI:**
```bash
npm run dev:client
```
You should see:
```
  VITE v5.4.x  ready in 234 ms

  ➜  Local:   http://localhost:5173/
```

---

## 5. The full user flow (the fun part)

Open <http://localhost:5173/> in your browser.

### Screen 1 — Login
The email and password fields are pre-filled with the seed credentials:
- `owner@demo.local`
- `wedding123`

Click **Sign in**.

### Screen 2 — Dashboard
You'll see:
- A header with your email
- **"Your Organizations"** card with one org: *Seven Paths Manor*
- **"Events"** card with one event: *Smith × Jones Wedding*
- **"Guests"** table with Aunt Mary, Cousin Lin, Uncle Bob (all RSVP = pending)
- **"Live RSVP Submissions"** card (empty for now)
- **"Public Guest Portal Link"** card with a shareable URL

### Try each action

1. **Create a new event** — type a title like "Test Reception", pick a date, click "Create event". It should appear and become active.
2. **Add a guest** — type "Test Guest" + an email + click "Add guest". It should appear in the table.
3. **Open the Guest Portal in a new tab** — click "Open portal in new tab" or copy the URL into an **incognito/private window** (more realistic — proves the portal works without your venue-owner login).
4. **Submit an RSVP as a guest** — pick a name from the dropdown (the dropdown is populated by the public `/api/portal/<id>/info` endpoint), choose attending=yes, pick a meal, add a note, submit.
5. **Switch back to the dashboard tab** — within 5 seconds the new RSVP should appear in the "Live RSVP Submissions" card. (It polls every 5 seconds in this POC — production would use Server-Sent Events for instant updates.)
6. **Notice the guest's `rsvp_status` flipped to "attending"** automatically.

### Bonus: test the authorization model

This is the bug you specifically asked me to fix in the original app. Confirm it actually works here:

1. **Log out.**
2. Click "Create account", register a *second* user (e.g. `stranger@example.com` / `stranger123` / org name "Other Venue"). You'll be logged in as them.
3. Notice you only see *Other Venue* in the Organizations card, not Seven Paths Manor. ✅ Each org is isolated.
4. Log out again, log back in as `owner@demo.local`. Your data is still there exactly as you left it. ✅

---

## 6. Inspect the database file directly

The whole point of this architecture is that *you own the bits*. Let's prove it.

```bash
# macOS / Linux
ls -lh wedding-poc/server/data/

# Windows PowerShell
dir wedding-poc\server\data\
```

You should see three files:
- `wedding.db` — the database itself (probably ~150 KB right now)
- `wedding.db-wal` — write-ahead log (transactions waiting to be committed)
- `wedding.db-shm` — shared memory for the WAL

**Try a backup, right now:**
```bash
# macOS / Linux
cp wedding-poc/server/data/wedding.db ~/Desktop/my-wedding-backup.db

# Windows
copy wedding-poc\server\data\wedding.db %USERPROFILE%\Desktop\my-wedding-backup.db
```

That single file *is* the entire backup. To restore: copy it back. To migrate to a different server: copy it there. To inspect it with any tool: open it with [DB Browser for SQLite](https://sqlitebrowser.org/) (free, GUI).

**Optional**: if you have `sqlite3` installed (built-in on macOS, `apt install sqlite3` on Linux, or via the DB Browser on Windows):
```bash
sqlite3 wedding-poc/server/data/wedding.db
sqlite> .tables
sqlite> SELECT email, full_name FROM users;
sqlite> SELECT title, status FROM events;
sqlite> SELECT g.full_name, r.attending, r.meal_choice, r.notes
        FROM rsvp_submissions r
        JOIN guests g ON g.id = r.guest_id;
sqlite> .quit
```

This is what every other server-side process would also see. There is no proprietary format. There is no vendor.

---

## 7. Try the "production-style" run (single binary, single port)

Stop both dev servers (Ctrl+C in each terminal). Then:

```bash
npm run build            # builds the React bundle into client/dist/
npm run dev:server       # restart the server
```

Now open <http://localhost:3000/> (note: port **3000**, not 5173). The same Fastify server is now serving *both* the React app at `/` and the API at `/api/*`. This is exactly how the production deployment works on a $5 VPS — one process, one port, one container.

Try the full flow again. Everything should work identically, but now there's only **one** server.

---

## 8. Stop everything

In each terminal: **Ctrl+C**.

The SQLite file remains on disk. Re-running `npm run dev:server` brings everything back exactly as it was.

---

## Your Evaluation Checklist

Tied directly to your stated motivations. Walk through these honestly:

### 💰 Cost
- [ ] Did running this on your machine cost you anything? (No.)
- [ ] If you ran this on a $5/mo VPS, do you understand it would cost you $60/year total? (Yes/No)
- [ ] Compare to the recurring cost of any existing cloud platform you've considered.

### ⚙️ Simplicity
- [ ] How many things did you have to install? (Just Node.js — that's it.)
- [ ] How many config files did you have to edit to get it running? (Zero.)
- [ ] How many services are running? (One Node process, one file. That's the whole backend.)
- [ ] Could you teach a non-engineer to start/stop this in 60 seconds?

### 🎛️ Control
- [ ] Did you successfully copy the database file? (You did in step 6.)
- [ ] Could you read it in DB Browser, no vendor needed?
- [ ] If I disappeared tomorrow, could you still run this? (You can.)
- [ ] Could you switch hosting providers in an afternoon by copying that one file?

### 🌐 The "anyone can use it from anywhere" question
- [ ] You ran it locally — but did the *architecture* you saw make sense for a VPS deployment? (Same Fastify process, same SQLite file, just on a remote box reachable at a domain name.)
- [ ] The Caddyfile + Dockerfile + docker-compose.yml are ready. Did you peek at how short they are?

### 🔐 The security-model question that broke the original app
- [ ] Did you test that the second user could *not* see the first user's data? (Step 5 bonus.)
- [ ] Notice the `403 forbidden` came from the server, not the UI? (Real authorization, not UI gating — this is the fix from the original review.)

---

## What's MISSING from this POC (deliberately)

This is just the architectural slice. None of these are hard to add — they're 1–2 hours of work each — but I left them out to keep the slice focused:

| Feature | Status | Why deferred |
|---|---|---|
| Rate limiting on public RSVP endpoint | ❌ | `@fastify/rate-limit`, ~5 lines |
| Per-guest tokenized invitation URLs | ❌ | Email integration first |
| Email sending (magic links, notifications) | ❌ | Needs SMTP credentials |
| File uploads (venue photos, contracts) | ❌ | `@fastify/multipart` + `/data/uploads/` |
| The actual floor-plan canvas / decor designer | ❌ | These are the *front-end* components from your existing app; this POC is just the backend |
| Vendor management UI | ❌ | Schema is in `schema.sql`, route is ~40 lines |
| Timeline / day-of staff tasks | ❌ | Same pattern as guests/events |
| Real-time updates (WebSocket/SSE) | ❌ | Currently polls every 5s |
| Multiple user invitations to an org | ❌ | Schema supports it (`organization_memberships`); just need the invite-by-email UI |

Each one of these maps to ~40 lines of repo + ~40 lines of route + ~80 lines of UI. The architecture is identical for every domain.

---

## Troubleshooting

### "Port 3000 is already in use"
You have another process on port 3000 (often from a previous run). Kill it:
```bash
# macOS / Linux
lsof -ti :3000 | xargs kill -9
# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
```

### "no such table: users"
You forgot to run `npm run migrate` (or you ran it from the wrong directory). Run it from the `wedding-poc` directory.

### "Cannot GET /" or "Route GET:/ not found" on port 3000
You haven't run `npm run build` yet, so the server has no React bundle to serve. Either:
- Use the dev workflow (run `npm run dev:client` separately, visit port 5173), or
- Run `npm run build` first, then visit port 3000.

### `npm run dev:client` fails with "EADDRINUSE :::5173"
Another Vite instance is running. Same fix as port 3000, but for port 5173.

### After registering a second user, you can't see your first org
That's the correct behavior! The second user only sees the org *they* created. To switch back, log out and log in as `owner@demo.local`.

### The seed says "already exists"
That's fine — the seed is idempotent (safe to re-run). It just reuses existing data.

### Want to start completely fresh
```bash
# macOS / Linux
rm -rf server/data
npm run migrate
npm run seed

# Windows PowerShell — one-liner
npm run reset:win
```

---

## Windows-specific troubleshooting

### Error: `gyp ERR! find VS` / "Could not find any Visual Studio installation"
You're on **Node 23, 24, or 25** (the "Current" release line). The `better-sqlite3` package only ships prebuilt binaries for the LTS releases (20 and 22), so it's trying to compile from C++ source and failing.

**Fix:** Install **Node 22 LTS** from <https://nodejs.org/>:
1. Settings → Apps → Installed apps → uninstall the current Node.js
2. Download the **LTS** installer from nodejs.org (the *left* green button)
3. Run it, accept defaults
4. Close and reopen PowerShell
5. Verify: `node -v` should print `v22.x.x`
6. Clean and reinstall:
   ```powershell
   cd D:\spm\wedding-poc
   Remove-Item -Recurse -Force server\node_modules, client\node_modules -ErrorAction SilentlyContinue
   Remove-Item -Recurse -Force server\data -ErrorAction SilentlyContinue
   npm run install:all
   npm run migrate
   npm run seed
   ```

### Error: `'tsx' is not recognized as an internal or external command`
A previous `npm install` failed partway through (almost always because of the Visual Studio error above), so `tsx` never finished installing. Fix the Node version (see above), then re-run `npm run install:all` from scratch.

### `npm install` is hanging / very slow on Windows
Windows Defender real-time scanning can dramatically slow down `node_modules` writes. You can either:
- Add `D:\spm\wedding-poc\` to Defender's exclusions (Settings → Privacy & Security → Windows Security → Virus & threat protection → Exclusions)
- Or just wait — first install can be 2–3 minutes on Windows vs ~30 seconds on macOS/Linux. Subsequent installs are much faster.

### Error: `The string is missing the terminator: '` when running `npm run reset:win`
You hit this if you opened `scripts\reset-local.ps1` in an older editor that
re-saved it with non-ASCII characters, OR if you cloned the repo on a system
that converted line endings. The script in the repo is pure ASCII; if yours
has been modified, restore it from the repo. Quick test:
```powershell
# Should print nothing. If it prints lines, the file has non-ASCII characters.
Select-String -Path scripts\reset-local.ps1 -Pattern '[^\x00-\x7F]'
```

### `EPERM: operation not permitted, rmdir` during install
A previous Node process had a lock on a file. Close any open PowerShell windows running the server, then:
```powershell
cd D:\spm\wedding-poc
Remove-Item -Recurse -Force server\node_modules, client\node_modules -ErrorAction SilentlyContinue
npm run install:all
```
If it persists, restart Windows — something has a stale file handle.

---

## After your trial — decision point

After 20 minutes of clicking around, you should have a clear gut answer to: **"do I want to commit to this architecture for the full app?"**

If **yes** → next step is the ~2-week migration:
1. I write the per-domain repos for layouts, vendors, timeline, decor, etc. (~3 days)
2. I rewrite the front-end `useLayoutState` and similar hooks to call the API instead of `localStorage` (~5 days)
3. We test, deploy to a $5 VPS, set up your home backup (~2 days)
4. Cutover (~1 day)

If **no** → tell me what felt wrong. There are still options:
- "I want managed hosting" → we can re-target this same code to Fly.io or Railway (~1 day extra)
- "I want the UI to be richer first" → we build out a fuller stub UI before migrating
- "Self-hosting feels too risky" → we can layer on automatic off-site encrypted backups to Backblaze ($0.05/mo)

Either way, you'll have made the decision based on a real running thing rather than a slide deck. 🎉
