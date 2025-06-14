# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Castle Wars is a multiplayer 2D sandbox game with both PvP and PvE modes. Built with Phaser 3, Node.js, Socket.io, and MongoDB. Players can build structures, engage in combat, and interact in persistent worlds.

## Common Development Commands

```bash
# Install dependencies
npm install

# Development mode (auto-reload)
npm run dev          # PvP server only
npm run dev:pve      # PvE server only
npm run dev:gui-multi # Admin GUI only
npm run dev:all      # All servers

# Production mode
npm run start        # PvP server (port 3000)
npm run pve          # PvE server (port 3001)
npm run gui-multi    # Admin GUI (port 3005)
npm run gui-auto     # Admin GUI with auto-restart on exit
npm run start:all    # All servers
npm run start:optimized # Optimized with 8GB memory

# PM2 Process Management (recommended for production)
npm run pm2:start    # Start all servers with PM2
npm run pm2:stop     # Stop all servers
npm run pm2:restart  # Restart all servers
npm run pm2:logs     # View all server logs
npm run pm2:status   # Check server status

# Manual testing (no automated tests)
# Test with multiple browser tabs using different accounts
# Verify server-client sync and check browser/server console logs
```

## Production Infrastructure

### DigitalOcean Droplet Setup
- **Server**: Ubuntu 22.04 LTS droplet
- **Resources**: Minimum 4GB RAM, 2 vCPUs recommended
- **Domain**: game.koryenders.com with subdomains
- **SSL**: Let's Encrypt via Certbot
- **Process Manager**: PM2 for production
- **Web Server**: Nginx reverse proxy
- **Database**: MongoDB (local or Atlas)

### Network Architecture
```
Internet → Nginx (ports 80/443)
    ├→ game.koryenders.com → :3000 (PvP/Landing)
    ├→ pvp.koryenders.com → :3000 (PvP Direct)
    ├→ pve.koryenders.com → :3001 (PvE Direct)
    └→ gui.koryenders.com → :3005 (Admin GUI)

Internal IPC:
    GUI (:3005) → PvP IPC (:3002)
    GUI (:3005) → PvE IPC (:3003)
```

### PM2 Ecosystem Configuration
- **Auto-restart**: All servers restart on crash
- **Memory limits**: 4GB for game servers, 1GB for GUI
- **Log rotation**: Automatic with timestamps
- **Clean exit handling**: Code 0 triggers auto-restart for updates

## High-Level Architecture

### Multi-Server Architecture
- **PvP Server** (`server.js`): Port 3000 - Classic deathmatch gameplay
- **PvE Server** (`server-pve.js`): Port 3001 - Cooperative wave survival with party system
- **Admin GUI** (`server-gui-multi.js`): Port 3005 - Control panel for both servers
- **Landing Page** (`home.html`): Server selection served at game.koryenders.com

### Server Communication Flow
```
Client Browser → Nginx Reverse Proxy → Game Servers
                                    ↓
                              MongoDB Database
                                    ↑
                        Admin GUI (IPC ports 3002/3003)
```

### Project Structure
```
/
├── server.js           # PvP game server (port 3000)
├── server-pve.js       # PvE game server (port 3001)
├── server-gui-multi.js # Admin control panel (port 3005)
├── js/                 # Client-side game code
│   ├── scenes/         # Phaser scenes (Login, Game)
│   ├── entities/       # Game entities (Player, Bullet, NPC)
│   └── ui/             # UI components (GameUI, InventoryUI)
├── models/             # MongoDB schemas (Player, Building)
├── config/             # Server configuration
├── assets/             # Game sprites and resources
└── css/                # Styling for UI panels
```

### Critical Architectural Patterns

1. **Server-Authoritative Multiplayer**
   - Client sends inputs only: `{up, left, right, aimAngle}`
   - Server validates all actions and broadcasts authoritative state
   - 60Hz tick rate (16ms) for smooth gameplay
   - Client-side prediction for bullets with server reconciliation

2. **Hybrid UI Rendering**
   - Phaser Canvas: Game world (offset by 350px for UI panel)
   - DOM Elements: UI panels (GameUI, InventoryUI) outside canvas
   - Critical coordinates: UI panel 0-350px, game viewport 350-1630px
   - Death screen centered at x=800 (viewport center, not window center)

3. **Entity State Management**
   ```javascript
   // Server maintains authoritative state
   gameState = {
     players: { [socketId]: { x, y, vx, vy, health, isDead, role, ... } },
     buildings: [{ x, y, type, owner }],
     bullets: { [id]: { x, y, vx, vy, damage, ownerId, weaponType } },
     sun: { elapsed, duration, isDay }
   }
   
   // Client receives filtered worldState every tick
   // PvE adds: npcs, parties, waves, teamLives
   ```

4. **Death/Respawn System**
   - Server controls all timing (3-second respawn)
   - Client waits for server 'respawn' event
   - PvE: "Stunned" state instead of death, costs team life
   - Spawn position: x=600, y=1800 (avoids weapon shop)

5. **Party System (PvE Only)**
   - Open by default, leader can close
   - UI opens with P key (not commands)
   - Auto-named after creator's username
   - Leader controls game start
   - Max 10 players per party

### Socket.io Event Architecture

**Authentication Flow:**
```
1. Client connects → 'verifyLogin' with credentials
2. Server validates → 'loginVerified' or 'loginError'
3. Client joins → 'join' with username
4. Server sends → 'initialState' with player data
```

**Game Loop Events (60Hz):**
- C→S: `playerInput` (movement/aim)
- S→C: `worldState` (all entity positions/states)

**Combat Events:**
- C→S: `bulletCreated` → Server validates → S→C: broadcast to all
- S→C: `playerDamaged`, `playerKill`, `bulletDestroyed`
- S→C: `tomatoExploded` (special weapon AOE)

**PvE-Specific Events:**
- `partyUpdate`, `waveStart`, `waveComplete`
- `playerStunned`, `respawn` (replaces death)
- `npcSpawned`, `npcDied`

### File Serving Configuration

**Critical Issue**: Express static middleware must come AFTER explicit routes or it serves wrong files.

```javascript
// Correct order:
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});
app.use(express.static(...)); // AFTER routes

// GUI server should NOT have static middleware (causes black screen)
```

### Database Schema Patterns

```javascript
// Player model includes hidden server state
{
  username: String,
  role: { type: String, enum: ['player', 'mod', 'admin', 'owner'] },
  stats: { kills, deaths, headshots, ... },
  inventory: { items: [String], hotbar: [String] },
  // Server-only fields not sent to client:
  wasInWeaponShop: Boolean,
  flyMode: Boolean,
  // ... admin modifiers
}
```

### Performance-Critical Patterns

1. **Collision Detection**
   - Buildings use 64x64 grid alignment
   - Early exit on first collision
   - "door" type blocks skip bullet collision

2. **Network Optimization**
   - Building changes detected via string comparison
   - Only send changed data in worldState
   - Throttled player updates based on movement

3. **Memory Management**
   - Object pooling for bullets/sprites
   - Max 20 tomato bullets (server enforced)
   - Stale player cleanup in game loop

### Environment Configuration

**Required Environment Variables (.env file):**
```bash
MONGODB_URI=mongodb://localhost:27017/castle-wars
SESSION_SECRET=your-secret-key
USE_HTTPS=false  # Set to true for production with SSL
PORT=3000        # Override default ports if needed
ADMIN_PASSWORD_HASH=$2b$10$...  # Bcrypt hash of admin password
NODE_ENV=production  # Set for production deployment
```

### Production Deployment Steps

1. **Initial Setup**
   ```bash
   # Clone repository
   git clone git@github.com:yourusername/castle-wars.git
   cd castle-wars
   
   # Install dependencies
   npm install
   npm install -g pm2
   
   # Setup environment
   cp .env.example .env
   # Edit .env with production values
   ```

2. **Configure Nginx**
   ```bash
   sudo cp nginx-example.conf /etc/nginx/sites-available/castlewars
   sudo ln -s /etc/nginx/sites-available/castlewars /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

3. **SSL Setup**
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d game.koryenders.com -d pvp.koryenders.com -d pve.koryenders.com -d gui.koryenders.com
   ```

4. **Start with PM2**
   ```bash
   npm run pm2:start  # Starts all servers
   pm2 save           # Save process list
   pm2 startup        # Generate startup script
   ```

5. **Updates**
   ```bash
   ./auto-update.sh  # Pulls code, installs deps, restarts PM2
   # OR from Admin GUI: Pull Updates button
   ```

### Auto-Restart Functionality

**GUI Server Auto-Restart:**
- After git pull with updates, GUI server exits with code 0
- Use `npm run gui-auto` or PM2 for automatic restart
- Client browser will auto-refresh after 5 seconds when updates detected

**Game Server Auto-Restart:**
- Servers automatically restart when exiting with code 0
- Restart countdown can be initiated from Admin GUI
- Players receive in-game notifications before restart

**PM2 Configuration (ecosystem.config.js):**
- All servers configured with auto-restart
- Logs saved to `/logs` directory
- Memory limits: 4GB for game servers, 1GB for GUI

### Common Pitfalls & Solutions

**Port Conflicts:**
- PvE IPC uses 3003 (not 3002) to avoid PvP conflict
- Check `lsof -i :PORT` if servers won't start
- Ensure MongoDB is running on default port 27017

**Nginx Configuration:**
- WebSocket support requires proper headers (Upgrade, Connection)
- Set appropriate timeouts for long-lived connections
- Use `nginx -t` to test config before reloading

**PM2 Issues:**
- If servers don't restart: `pm2 delete all && npm run pm2:start`
- Check logs: `pm2 logs castle-wars-pvp --lines 100`
- Monitor resources: `pm2 monit`

**Client Connection Issues:**
- PvE must use `window.location.origin` not hardcoded port
- Socket.IO requires matching versions client/server
- Check browser console for WebSocket errors

**Database Issues:**
- Ensure MongoDB is running: `sudo systemctl status mongod`
- Check connection string in .env file
- For remote MongoDB, whitelist droplet IP

**Update/Restart Issues:**
- GUI auto-restart requires PM2 or `npm run gui-auto`
- Clean exit (code 0) triggers auto-restart
- Manual restart: Admin GUI → Restart button

**SSL/HTTPS Issues:**
- Update client to use wss:// for WebSocket with HTTPS
- Set USE_HTTPS=true in production .env
- Renew certificates: `sudo certbot renew`

## Adding New Features

### New Role Checklist
1. `models/Player.js` - Add to enum
2. `server.js` - Update permission arrays (isStaff, isAdmin)
3. `GameScene.js` - Add roleColors and roleSymbols (3 locations each)
4. `GameUI.js` - Add chat color handling
5. Add character sprites: `stickman_[role].png` and `stickman_running_[role].png`

### New Weapon Checklist
1. Add sprite to `assets/weapons/[weapon].png`
2. `js/entities/Weapon.js` - Add to WEAPON_CONFIGS
3. `server.js` - Add damage handling in bullet collision
4. `js/scenes/GameScene.js` - Add to shop display
5. Test reload, fire rate, ammo display, and damage

### New Building Block
1. Add texture to `assets/blocks/[block].png`
2. Update BLOCK_TYPES in both server files
3. Add to building UI in GameScene
4. Test collision and placement validation

### Server Monitoring & Management

**Admin GUI Access:**
- URL: https://gui.koryenders.com (or http://droplet-ip:3005)
- Default password: 'admin' (change immediately!)
- Real-time monitoring of both game servers
- Integrated log viewer with filtering

**PM2 Monitoring:**
```bash
pm2 status          # Quick status check
pm2 monit           # Interactive dashboard
pm2 logs            # View all logs
pm2 logs castle-wars-pvp --lines 100  # Specific server logs
```

**Server Health Checks:**
- Game servers: `curl http://localhost:3000/health`
- IPC status: Check ports 3002/3003 connectivity
- MongoDB: `mongo --eval "db.stats()"`

### Admin Commands (Owner/Admin roles)

**In-game Commands:**
- `/tp [username]` - Teleport to player
- `/give [username] [item] [amount]` - Give items
- `/role [username] [role]` - Change player role
- `/kill [username]` - Kill player
- `/fly` - Toggle fly mode
- `/clearinv [username]` - Clear inventory
- `/gold [username] [amount]` - Give gold

**Admin GUI Features:**
- Real-time server metrics and player lists
- Kick/ban players
- Send server announcements
- Start/stop PvE waves
- View/download server logs
- One-click restart with countdown
- Git pull updates with auto-restart
- Backup/restore world data