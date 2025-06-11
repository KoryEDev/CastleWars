# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Castle Wars Game is a multiplayer 2D sandbox game built with Phaser 3, Node.js, and Socket.io. Players can build structures, engage in combat, and interact in a persistent world.

## Recent Changes & Critical Fixes

### Latest Updates (Most Recent First)
- **PvE Mode Implementation**: Separate server on port 3001 with party system, wave-based gameplay
- **Party System**: Create/join parties, open/closed status, leader controls game start
- **Stunned System**: Players get "stunned" instead of dying in PvE (10s recovery, costs 1 team life)
- **NPCs Not Rendering**: Despite loading sprites (Monster.png, mage.png, ranger.png), NPCs remain invisible - NEEDS FIX
- **Fortress Removal**: Removed pre-built fortresses, players build their own defenses
- **Death/Respawn System**: Server-controlled timing, death visual (opacity) synced to all players, spawn position x=600
- **Tutorial Fix**: Only shows on first account creation (checks data.player.tutorialCompleted)
- **Tomato Gun Balance**: Splash damage reduced to 60 (2-shot kill), direct hit remains 999
- **Movement During Death**: Server blocks input processing when player.isDead = true
- **Weapon State Manager**: Prevents rapid-fire exploit, maintains reload state per weapon instance
- **Ammo Indicator**: Dynamic positioning that follows weapon, color-coded for reload state

### Critical Bug Fixes
- **PvE Socket Connection**: Fixed hardcoded port 3000 to use window.location.origin
- **Party Commands**: Fixed parsing of multi-word commands like "/party create"
- **Fortress Crash**: Removed references to gameState.fortresses causing crashes
- **IPC Port Conflict**: PvE server uses port 3003 instead of 3002 to avoid conflicts
- **Ash sprite stacking**: Must include 'stickman_ash' and 'stickman_running_ash' in texture key checks
- **Tutorial on death**: Was checking wrong property path (data.tutorialCompleted vs data.player.tutorialCompleted)
- **Weapon rapid fire**: Fixed by tracking individual weapon instances with WeaponStateManager
- **Death countdown mismatch**: Client now waits for server 'respawn' event instead of own timer

## Common Development Commands

```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Start optimized production server (8GB memory, GC optimization)
npm run start:optimized

# Start server control GUI (separate process)
npm run gui

# Development mode for GUI
npm run dev:gui
```

## Critical Implementation Patterns

### Adding New Roles (Required Updates)
```javascript
// 1. models/Player.js - enum definition
role: { type: String, enum: ['player', 'mod', 'admin', 'ash', 'owner'] }

// 2. server.js - permission arrays (line ~840)
const isStaff = ['mod', 'admin', 'ash', 'owner'].includes(player.role);
const isAdmin = ['admin', 'ash', 'owner'].includes(player.role);

// 3. GameScene.js - visual configuration (3 locations each)
roleColors = { ash: '#ff69b4' }  // Lines 243, 669, 1233
roleSymbols = { ash: '👑' }       // Lines 249, 674, 1239

// 4. UI files - role styling
// 5. server-gui.html - CSS classes
```

### Death System Architecture
```javascript
// Server-side death flow (server.js)
1. Player health <= 0 → isDead = true
2. Broadcast isDead in worldState (line 754)
3. setTimeout 3000ms → respawn at x=600, y=1800
4. emit('respawn') to client

// Client-side death flow (Player.js)
1. die() → Show death UI, store references
2. Wait for server 'respawn' event
3. respawn() → Clean up UI, reset visual state
```

### Weapon State Management
```javascript
// WeaponStateManager tracks per-instance state
weaponStates: Map<weaponId, {
  type: string,
  currentAmmo: number,
  magazineSize: number,
  lastFired: number,
  isReloading: boolean,
  reloadEndTime: number
}>

// Weapon IDs format: `${weaponType}_${playerId}_1`
```

## Architecture Overview

### Technology Stack
- **Frontend**: Phaser 3.55.2 game engine, Socket.io client, vanilla JavaScript
- **Backend**: Node.js, Express, Socket.io, MongoDB/Mongoose, bcrypt
- **Real-time**: Server-authoritative multiplayer with 60Hz tick rate

### Client Architecture
- **Scene-based flow**: LoginScene → GameScene with proper cleanup
- **Hybrid rendering**: Phaser canvas for game world, DOM for UI panels
- **Component UI system**: GameUI and InventoryUI exist outside canvas
- **Build mode**: Toggle with Shift, preview blocks, drag-to-build
- **Client prediction**: Local bullet creation with server reconciliation
- **Object pooling**: Reused sprites and UI elements for performance

### Critical UI Coordinates
- **UI Panel**: 0-350px (left side)
- **Game Canvas**: 350-1280px
- **Chat Input**: Centered in game viewport (800px from left edge)
- **Help Button**: Fixed at (370, 20)
- **Death Screen**: Centered at x=800 (viewport center, not window center)

### Key Architectural Patterns

1. **Dual-Process Architecture**
   - Main game server (`server.js`) handles gameplay and client connections
   - GUI control panel (`server-gui.js`) provides web-based admin interface
   - IPC communication via TCP socket on port 3002 for real-time command execution
   - GUI maintains independent MongoDB connection as fallback when IPC fails
   - GUI spawns game server as child process with platform-specific process management

2. **Server-Client Communication**
   - Server-authoritative game state with client-side prediction
   - Socket.io middleware enforces ban checks on every event
   - Client sends inputs, server validates and broadcasts state
   - Network optimization: throttled updates, batched operations, minimal data transfer
   - Event flow: LoginScene → Socket creation → verifyLogin → GameScene

3. **Game Loop Architecture**
   - Server runs at 60 FPS (16ms tick rate)
   - Complex bullet physics with edge detection and impact calculations
   - Tomato bullets: heat-seeking, 500ms arming delay, max 20 concurrent
   - Day/night cycle: 5-minute periods tracked in `gameState.sun`
   - Performance optimizations: O(1) ban lookups, early collision exits

4. **Authentication & Security**
   - Multi-account management with up to 9 saved logins
   - Socket.io middleware blocks banned users from all actions
   - Passwords hashed with bcrypt (10 rounds)
   - Session tracked via socket connection
   - Periodic ban sweep in game loop removes banned players

5. **Entity System**
   - Base Player class with hidden state (flyMode, shop tracking, admin modifiers)
   - Death/respawn: 3-second timer, spawn at (600, 1800)
   - Headshot detection: top 20% of hitbox = 2x damage
   - Building collision uses 64x64 grid alignment
   - Weapon shop zone: virtual area at (0, 1808) with 512x192 bounds
   - Player collision: 32x64 (width x height) on both client and server

6. **Data Persistence**
   - Dual MongoDB connections (game server + GUI server)
   - Player state includes positions, stats, inventory, and UI preferences
   - Buildings persist with collision optimization for "door" types
   - Backup system creates timestamped JSON exports in `backups/` directory

### IPC Communication (GUI → Game Server)

The GUI control panel communicates with the game server via JSON messages on port 3002:
- `getPlayers`: Request current player list
- `restartCountdown`: Initiate server restart with countdown
- `shutdownGracefully`: Save data and disconnect players before shutdown
- `promote`: Change player role
- `ban`/`unban`: Manage player bans
- `kick`: Remove player from server
- `resetworld`: Clear all buildings
- `announce`: Send server-wide message

### Socket.io Event Reference

**Core Game Events:**
- `verifyLogin` (C→S): Validate login before joining
- `join` (C→S): Player joins with username
- `worldState` (S→C): Broadcast game state (players, buildings, sun)
- `initialState` (S→C): Send initial player state on join
- `playerInput` (C→S): Send movement/action inputs
- `disconnect`: Handle player disconnection

**Building System:**
- `placeBuilding` (C→S): Place a building block
- `deleteBlock` (C→S): Remove a building
- `updateBuildingOrder` (C→S): Save building menu order

**Combat System:**
- `bulletCreated` (C→S): Fire a bullet
- `weaponChanged` (C→S): Switch weapon type
- `playerDamaged` (S→C): Notify damage taken
- `bulletDestroyed` (S→C): Remove bullet
- `playerKill` (S→C): Broadcast kill feed message
- `tomatoExploded` (S→C): Special weapon explosion effect

**Chat & Commands:**
- `chatMessage` (C→S/S→C): Send/receive chat messages
- `command` (C→S): Execute admin command
- `commandResult` (S→C): Command execution feedback
- `serverAnnouncement` (S→C): System-wide announcements

**Admin Events:**
- `resetWorld` (C→S): Clear all buildings (owner only)
- `roleUpdated` (S→C): Notify role change
- `serverRestart` (S→C): Trigger client restart screen
- `loginError` (S→C): Authentication/ban messages

## Critical Data Structures

### Network Protocol
```javascript
// Client → Server (60Hz)
playerInput: { up, left, right, aimAngle }

// Server → Client (60Hz)  
worldState: {
  players: { [id]: { x, y, vx, vy, role, weaponType, aimAngle, health, isDead, ...rest } },
  buildings: Array<{ x, y, type, owner }>,
  sun: { elapsed, duration, isDay },
  bullets: { [id]: { x, y, vx, vy, damage, ownerId, weaponType } }
}

// Event-based messages
bulletCreated: { x, y, angle, speed, damage, weaponType, targetX?, targetY? }
playerDamaged: { targetId, damage, health, maxHealth, isHeadshot }
```

## Important Configuration

### Game Configuration (js/config/gameConfig.js)
- Canvas: 1280x720 with responsive scaling
- Physics: Arcade engine, gravity: 800
- World bounds: 4000x2000

### Server Configuration (server.js)
- Port: 3000 (default)
- MongoDB: localhost:27017
- Day/night cycle: 5 minutes (300 seconds)
- Ground Y position: 1936
- Tick rate: 16ms (60 FPS)
- Max tomato bullets: 20 (special weapon limit)
- IPC port: 3002 (GUI-server communication)
- Weapon shop buffer: 192px (prevents building near shop)
- Player spawn: x=600, y=1800 (changed from 100 to avoid weapon shop)

### Role Hierarchy
- **player**: Level 0 - Basic permissions
- **mod**: Level 1 - Can kick, ban, teleport, modify player attributes
- **admin**: Level 2 - All mod powers plus promote command
- **ash**: Level 2 - Same as admin with custom visuals
- **owner**: Level 3 - All powers plus world reset

### Production Optimizations (start_server.js)
- Memory limit: 8GB
- Thread pool: 64 threads
- GC interval: 30 seconds
- NODE_ENV: production

### Asset Organization
- `assets/weapons/` - Weapon sprites
- `assets/items/` - Item sprites (health potions, boosts, etc.)
- `assets/blocks/` - Building block textures
- `assets/characters/` - Player sprites

## Development Prerequisites
- MongoDB running on localhost:27017
- Node.js and npm installed
- Port 3000 available (game server)
- Port 3001 available (GUI control panel)
- Port 3002 available (IPC communication)

## Key Implementation Details

### Server Restart Flow
1. Countdown announcements at: initial, 60s, 30s, 10s, final 5s
2. Player data saved before restart begins
3. 2-second buffer after countdown for graceful disconnect
4. GUI respawns server process after shutdown

### Collision System
- Buildings aligned to 64x64 grid
- Bullets check solid blocks only (skip "door" type)
- Tomato explosion detection includes "near miss" for edges
- Player-building collision prioritizes smallest overlap

### Hidden Player State
- `wasInWeaponShop`: Tracks shop entry/exit
- `onElevator`: Physics state modifier
- `flyMode`, `flySpeed`, `moveSpeed`, `jumpHeight`: Admin modifiers
- `input`: Raw input state for physics calculations

### Performance Critical Paths
- Ban checks use Set for O(1) lookup
- Building string used for change detection
- Bullet collision exits on first hit
- Active player filtering for network updates

## In-Game Chat & Commands

Press `T` to open chat/command input. Regular messages are sent to all players. Commands start with `/`.

### Player Commands
- `/help` - Show available commands

### Staff Commands (Mod/Admin/Owner)
- `/kick [username]` - Kick player from server
- `/ban [username]` - Ban player permanently
- `/unban [username]` - Remove player ban
- `/tp [username]` - Teleport player to your location
- `/tpto [username]` - Teleport to player
- `/fly [username] [1-10]` - Toggle fly mode with speed
- `/speed [username] [1-10]` - Set movement speed
- `/jump [username] [1-10]` - Set jump height

### Admin Commands (Admin/Owner)
- `/promote [username] [role]` - Set player role (player/mod/admin/owner)

### Owner Commands
- `/resetworld` - Clear all buildings

## Server Terminal Commands
When running the game server, you can use these console commands:
- `promote <username> <role>` - Set player role
- `demote <username>` - Reset to player role
- `resetworld` - Clear all buildings

## GUI Control Panel Commands
Access via `http://localhost:3001` when running `npm run gui`:
- Server start/stop/restart with countdown options
- Player management (kick/ban/promote)
- World reset and backups
- Real-time server logs and player list
- Server announcements

## Common Development Tasks

### Development Workflow
```bash
# Local development
npm run dev              # Auto-restart on server changes
npm run dev:gui          # GUI control panel dev mode

# Testing checklist for gameplay changes:
1. Test with multiple browser tabs (different accounts)
2. Verify server-client sync (positions, animations, health)
3. Check for console errors in both browser and server
4. Test edge cases (death during reload, disconnect mid-action)

# No automated tests - rely on manual testing
```

### Adding New Weapons
1. Add weapon sprite to `assets/weapons/`
2. Update weapon types in `js/entities/Weapon.js`
3. Add server-side damage/physics in `server.js`
4. Update client rendering in `js/scenes/GameScene.js`

### Adding New Building Blocks
1. Add block texture to `assets/blocks/`
2. Update block types in `js/entities/Building.js`
3. Add to building UI in `js/scenes/GameScene.js`
4. Update server validation in `server.js`

### Modifying Game Balance
- Weapon damage: `server.js` → search for weapon damage values
- Movement speeds: `server.js` → `baseSpeed`, `flySpeed` variables
- Building costs: Currently all blocks are free
- Enemy spawn rates: `server.js` → enemy spawn intervals

## Common Debugging Patterns

### Sprite Issues
- **Duplication/Stacking**: Check texture key matching in worldState handler
- **Wrong orientation**: Weapon flip should use aimAngle, not movement direction
- **Missing sprites**: Check preload() try/catch blocks and texture existence

### Tutorial Issues  
- **Shows on death**: Check that it's reading data.player.tutorialCompleted
- **Not showing**: Verify initialState handler and 1500ms delay

### Combat Issues
- **Rapid fire**: Ensure WeaponStateManager is checking fire rate per weapon instance
- **Ammo not syncing**: Check 'ammoChanged' event emission and listeners
- **Death state**: Verify isDead is included in worldState broadcast

### UI Positioning Issues
- **Behind UI panel**: X coordinate must be >= 370 (UI panel is 0-350px)
- **Centered wrong**: Use viewport center (800px) not window center (640px)
- **Chat overlap**: Chat section height is dynamic, fills remaining space