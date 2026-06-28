# AGENTS.md

For a full architecture overview, common commands, and gameplay details, see `CLAUDE.md`. This file only adds notes for agents running in the Cursor Cloud environment.

## Cursor Cloud specific instructions

### Services
Castle Wars is one product with three Node services (all share one MongoDB database `castlewars`):
- PvP game server (`npm run start` / `npm run dev`) on port `3000` — primary product, also serves the landing page (`home.html`) and game client.
- PvE game server (`npm run pve` / `npm run dev:pve`) on port `3001` — cooperative wave-survival mode.
- Admin GUI (`npm run gui-multi`) on port `3005` — ops dashboard; requires the game servers to be running and login via `ADMIN_PASSWORD_HASH`. Not needed for gameplay testing.

### MongoDB is required and must be started manually
- `server.js` and `server-pve.js` **hardcode** `mongodb://localhost:27017/castlewars` and ignore `MONGODB_URI` from `.env`. MongoDB must be reachable on `localhost:27017` or the servers exit on startup.
- MongoDB is installed in the VM image (`mongod` v8). The update script does NOT start it. Start it before running any server:
  ```bash
  mkdir -p /data/db
  mongod --dbpath /data/db --bind_ip 127.0.0.1 --port 27017
  ```
  (Run it in a background/tmux session; verify with `mongosh --quiet --eval "db.runCommand({ping:1})"`.)

### Running / port notes
- Copy `.env.example` to `.env` once (`cp .env.example .env`); the example values are sufficient for local dev.
- Game servers read `process.env.PORT` for the listen port (NOT `PVP_PORT`/`PVE_PORT` from `.env`). To change the PvP port, set `PORT`; to run PvP and PvE together leave them on their defaults (3000 / 3001).
- Accounts are created on first login: enter a username + password on the game screen and click "CREATE ACCOUNT". Login is otherwise just username + password.

### Tests / lint / build
- There is no build step (the Phaser client is static files served by Express) and no automated test suite or lint config. The `test-*.js` files in the repo root are manual IPC/GUI probe scripts, not a test runner. Validate changes by running a server and testing in the browser.
