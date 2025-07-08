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
   - Phaser Canvas: Game world (offset by 350px for UI panel on desktop)
   - DOM Elements: UI panels (GameUI, InventoryUI) outside canvas
   - Mobile: Full-screen canvas with overlay UI elements
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

4. **Mobile UI System**
   - Dual joystick controls (movement + aim)
   - Touch-based building with grid alignment
   - Weapon switching interface with sprites
   - Double-tap joystick for build mode
   - Responsive font sizing system
   - Haptic feedback for actions

5. **Mantling System**
   - Automatic climbing over 1-block obstacles
   - Detects blocks ahead and checks for space above
   - 300ms cooldown to prevent exploitation
   - Works while jumping with limited overhead space

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

## Production Infrastructure

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

## Key File Locations & Important Constants

### Critical Constants & Boundaries
- **World boundaries**: 0-2400 x 0-2400
- **Weapon shop**: x: 300-700, y: 1650-2050 (safe zone)
- **UI offset**: 350px (game canvas starts at x=350 on desktop)
- **Tick rate**: 60Hz (16.67ms intervals)
- **Building grid**: 64x64 pixel alignment
- **Player hitbox**: 32x64 pixels
- **Spawn position**: x=600, y=1800

### Configuration Files
- `.env` - Environment variables (copy from `.env.example`)
- `ecosystem.config.js` - PM2 process configuration
- `config/weaponShop.js` - Weapon shop area boundaries
- `config/gameConfig.js` - Game constants (tick rate, world size)

## Adding New Features

### New Role Checklist
1. `models/Player.js` - Add to enum
2. `server.js` & `server-pve.js` - Update permission arrays (isStaff, isAdmin)
3. `js/scenes/GameScene.js` - Add roleColors and roleSymbols (3 locations each)
4. `js/ui/GameUI.js` - Add chat color handling
5. Add character sprites: `stickman_[role].png` and `stickman_running_[role].png`

### New Weapon Checklist
1. Add sprite to `assets/weapons/[weapon].png`
2. `js/entities/Weapon.js` - Add to WEAPON_CONFIGS
3. `server.js` & `server-pve.js` - Add damage handling in bullet collision
4. `js/scenes/GameScene.js` - Add to shop display
5. Test reload, fire rate, ammo display, and damage

### New Building Block
1. Add texture to `assets/blocks/[block].png`
2. Update BLOCK_TYPES in both server files
3. Add to building UI in GameScene
4. Test collision and placement validation

## Recent Fixes & Updates

**Mobile UI Overhaul (2025-01)**
- Implemented dual joystick controls with aim support
- Added weapon switching interface with actual sprites
- Created responsive font sizing system for all text
- Fixed delete mode visibility with top-left indicator
- Added mantling system for climbing 1-block obstacles
- Implemented double-tap joystick for build mode toggle
- Fixed stats display using stored server data

**GUI Command System Redesign (2025-01)**
- Fixed issue where GUI commands weren't executing on PvE server
- Commands now processed directly via `processGuiCommand` function in server-pve.js
- All commands (promote, kick, ban, tp, etc.) now work reliably from GUI
- Command parsing is now case-insensitive for usernames

## Common Pitfalls & Solutions

**Port Conflicts:**
- PvE IPC uses 3003 (not 3002) to avoid PvP conflict
- Check `lsof -i :PORT` if servers won't start
- Ensure MongoDB is running on default port 27017

**Mobile-Specific Issues:**
- Touch events need preventDefault() to avoid browser defaults
- Use isMobile() helper to conditionally apply mobile features
- Ensure touch targets are at least 44-50px for good UX
- Test landscape orientation separately

**Client Connection Issues:**
- PvE must use `window.location.origin` not hardcoded port
- Socket.IO requires matching versions client/server
- Check browser console for WebSocket errors

**Building System Issues:**
- Grid alignment must match between desktop and mobile
- Y-axis calculation: `Math.floor((worldY - (groundY - 64)) / 64) * 64 + (groundY - 64)`
- Check distance from player before allowing placement
- Ensure delete mode state is properly synchronized

## Admin Commands (Owner/Admin roles)

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