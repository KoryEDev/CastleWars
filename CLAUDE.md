# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Castle Wars Game is a multiplayer 2D sandbox game built with Phaser 3, Node.js, and Socket.io. Players can build structures, engage in combat, and interact in a persistent world.

## Recent Updates & Common Issues

### Recent Features
- **Weapon Aiming Sync**: All players can see where others are aiming (aimAngle in playerInput/worldState)
- **Ash Role**: Special staff class with hot pink color (#ff69b4), admin-level permissions
- **Tutorial System**: Account-based (stored in Player.tutorialCompleted), shows once per account
- **Help Button**: Floating button with controls tooltip, replaced static controls section
- **Ammo Indicator**: Follows weapon position, shows current/max ammo with color coding

### Known Issues & Fixes
- **Ash sprite stacking**: Fixed by adding 'stickman_ash' and 'stickman_running_ash' to sprite search
- **Weapon orientation**: Now based on aimAngle, not movement direction
- **Chat overlap**: Fixed by removing controls section, chat uses full remaining UI space
- **Tutorial timing**: Shows after initialState received, not on scene creation

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

## Common Code Patterns

### Adding New Roles
When adding a new role (like 'ash'), update these locations:
1. `models/Player.js` - Add to role enum
2. `server.js` - Add to isStaff/isAdmin arrays, validRoles
3. `GameScene.js` - Update roleColors (3 places), roleSymbols (3 places), sprite selection
4. `GameUI.js` & `EnhancedUI.js` - Add role colors and symbols
5. `server-gui.html` - Add CSS styling for role

### Sprite Naming Convention
- Player sprites: `stickman_[role]` (idle) and `stickman_running_[role]` (moving)
- Weapon sprites: Match weapon type names (pistol, shotgun, rifle, sniper, tomatogun)
- All sprites loaded in `GameScene.preload()` with try/catch fallbacks

### Network Update Flow
1. Client: `playerInput` → Server (60Hz) with { up, left, right, aimAngle }
2. Server: Validates input → Updates game state → Broadcasts `worldState`
3. Client: Receives worldState → Updates all player positions/sprites
4. Special events: `bulletCreated`, `weaponChanged`, `tutorialCompleted`

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

### UI Layout Specifics
- **Left Panel**: 350px wide, contains health, hotbar, build menu, stats, chat
- **Game Canvas**: Starts at x=350, uses remaining width
- **Help Button**: Position (370, 20), shows controls on hover
- **Chat Input**: Centered in game viewport (not window center)
- **Game Log**: Position x=370 (was behind UI panel at x=20)
- **Ammo Indicator**: Follows weapon position with dynamic offset

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

## Key Data Structures

### Player Input
```javascript
{
  up: boolean,
  left: boolean, 
  right: boolean,
  aimAngle: number  // Degrees, sent every frame
}
```

### World State Player Data
```javascript
{
  id: string,
  username: string,
  x: number, y: number,
  vx: number, vy: number,
  role: 'player' | 'mod' | 'admin' | 'ash' | 'owner',
  weaponType: string,
  aimAngle: number,
  health: number,
  isDead: boolean,
  // ... plus all other player properties via spread operator
}
```

### Player Sprite Properties
```javascript
playerSprite: {
  weaponSprite: Phaser.GameObjects.Sprite,  // Weapon visual
  ammoText: Phaser.GameObjects.Text,        // Ammo display
  ammoBg: Phaser.GameObjects.Rectangle,      // Ammo background
  usernameText: Phaser.GameObjects.Text,     // Name display
  healthBar: Phaser.GameObjects.Graphics,    // Health visual
  // ... standard Phaser sprite properties
}
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

### Testing Changes
```bash
# No automated tests currently - manual testing required
# 1. Start server in dev mode: npm run dev
# 2. Open http://localhost:3000 in browser
# 3. Create test account or use existing one
# 4. Test gameplay features manually
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

## Quick Feature Location Guide

### Weapon System
- **Weapon sprites/rotation**: `GameScene.js` lines 690-714 (remote players)
- **Weapon aiming**: `Player.js` lines 80-85, 656-661 (aimAngle calculation)
- **Weapon switching**: `Player.js` equipWeapon() method
- **Weapon state management**: `WeaponStateManager.js` (reload/ammo persistence)

### UI Components  
- **Tutorial popup**: `GameScene.js` showTutorial() method (line ~3657)
- **Help button**: `GameUI.js` createHelpButton() method (line ~578)
- **Ammo indicator**: `GameScene.js` lines 303-314 (creation), 1715-1730 (update)
- **Chat positioning**: `GameScene.js` lines 2467, 2535 (input/log positions)

### Role System
- **Role colors**: `GameScene.js` - search "roleColors" (3 locations)
- **Role symbols**: `GameScene.js` - search "roleSymbols" (3 locations) 
- **Ash role specifics**: Hot pink (#ff69b4), admin permissions, custom sprites

### Network Communication
- **Player input sending**: `GameScene.js` line 1741
- **World state handler**: `GameScene.js` lines 238-750 (main update loop)
- **Initial state**: `GameScene.js` line 1306, includes tutorialCompleted check

### Common Debugging Points
- **Sprite duplication**: Check texture keys in worldState handler (line 246-250)
- **Weapon orientation**: Based on aimAngle, not movement (line 695)
- **Tutorial not showing**: Check initialState handler (line 1356)
- **Ammo not updating**: Check 'ammoChanged' event listeners