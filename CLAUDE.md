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
npm run start:all    # All servers
npm run start:optimized # Optimized with 8GB memory

# Manual testing (no automated tests)
# Test with multiple browser tabs using different accounts
# Verify server-client sync and check browser/server console logs
```

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

### Common Pitfalls & Solutions

**Port Conflicts:**
- PvE IPC uses 3003 (not 3002) to avoid PvP conflict
- Check `lsof -i :PORT` if servers won't start

**Nginx Subdomain Routing:**
```nginx
server {
    listen 80;
    server_name pve.domain.com;
    location / {
        proxy_pass http://127.0.0.1:3001;
        # ... proxy headers
    }
}
```

**Client Connection Issues:**
- PvE must use `window.location.origin` not hardcoded port
- Check CORS settings if cross-origin errors

**Sprite Rendering Issues:**
- Texture keys must match exactly (including role variants)
- Check preload try/catch blocks for missing assets

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