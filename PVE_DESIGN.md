# Castle Wars PvE Mode Design Document

## Overview
A cooperative wave-based fortress defense mode where players work together to defend against increasingly difficult waves of intelligent NPCs.

## Core Concepts

### Game Mode
- **Objective**: Survive as many waves as possible while defending your fortress
- **Team Size**: 2-8 players per session
- **Win Condition**: None (endless waves, high score based)
- **Lose Condition**: Core fortress destroyed or all players dead with no respawns left

### Fortress System
- **Pre-built Fortresses**: Large multi-story structures scattered across the map
- **Player Building**: Allowed everywhere except inside pre-built fortresses
- **Core Crystal**: Each fortress has a core that must be defended (shared team health)
- **Safe Zones**: Inside fortresses are no-build zones but provide defensive positions

## Enemy Types

### 1. Grunt (Melee)
- **Health**: 50
- **Speed**: Medium
- **Damage**: 15 per hit
- **Behavior**: Rush towards nearest player, basic pathfinding
- **Block Damage**: 5 per hit
- **Special**: Can climb 1-block high walls

### 2. Archer (Ranged)
- **Health**: 30
- **Speed**: Slow
- **Damage**: 10 per arrow
- **Behavior**: Maintains distance, shoots at players from afar
- **Block Damage**: 3 per hit
- **Special**: Prioritizes high ground positions

### 3. Mage (Magic)
- **Health**: 40
- **Speed**: Slow
- **Damage**: 25 (AoE fireball)
- **Behavior**: Casts AoE spells, teleports when threatened
- **Block Damage**: 15 (explosion damages multiple blocks)
- **Special**: Can teleport short distances every 10 seconds

### 4. Brute (Tank)
- **Health**: 200
- **Speed**: Very Slow
- **Damage**: 40 per hit
- **Behavior**: Targets structures, breaks through walls
- **Block Damage**: 20 per hit
- **Special**: Immune to knockback, reduced damage from explosions

### 5. Siege Tower
- **Health**: 500
- **Speed**: Very Slow
- **Damage**: 0 (doesn't attack directly)
- **Behavior**: Moves to fortress walls, deploys enemies
- **Block Damage**: 50 on collision
- **Special**: Spawns 3-5 random enemies when reaching a wall

### 6. Assassin
- **Health**: 20
- **Speed**: Very Fast
- **Damage**: 30 (backstab), 10 (normal)
- **Behavior**: Targets isolated players, uses stealth
- **Block Damage**: 0
- **Special**: Becomes invisible for 3 seconds, double damage from behind

### 7. Bomber
- **Health**: 60
- **Speed**: Medium
- **Damage**: 100 (self-destruct)
- **Behavior**: Rushes towards structures/groups
- **Block Damage**: 50 (radius damage)
- **Special**: Explodes on death or when reaching target

### 8. Necromancer (Mini-boss)
- **Health**: 150
- **Speed**: Slow
- **Damage**: 20 (dark bolt)
- **Behavior**: Summons skeleton minions, stays back
- **Block Damage**: 5
- **Special**: Resurrects fallen enemies as skeletons (30 HP)

## Wave System

### Wave Structure
```
Wave 1-5: Tutorial waves (Grunts only)
Wave 6-10: Mixed basic enemies (Grunts + Archers)
Wave 11-15: Advanced enemies introduced (+ Mages, Assassins)
Wave 16-20: Heavy units appear (+ Brutes, Bombers)
Wave 21-25: Siege warfare (+ Siege Towers)
Wave 26+: Chaos mode (all types + mini-bosses)
```

### Scaling Formula
- Enemy Count: `baseCount + (wave * 1.5)`
- Enemy Health: `baseHealth * (1 + wave * 0.1)`
- Enemy Damage: `baseDamage * (1 + wave * 0.05)`
- Spawn Rate: Decreases by 100ms per wave (min 500ms)

### Wave Rewards
- Ammo resupply boxes spawn after each wave
- Bonus resources based on performance
- Special weapons unlock at certain waves

## Team System

### Party Formation
- `/party create [name]` - Create a party
- `/party invite [player]` - Invite player to party
- `/party join [name]` - Join a party
- `/party leave` - Leave current party
- `/party list` - Show party members

### Shared Resources
- Team lives pool (starts at 20, +5 per wave)
- Shared score and wave progress
- Shared fortress health

### Respawn System
- Dead players respawn at start of next wave
- Costs 1 team life per respawn
- Instant revive if teammate reaches body (costs no lives)

## AI Behavior System

### Pathfinding
- A* pathfinding with dynamic obstacle avoidance
- Enemies can destroy blocks to create paths
- Prioritize doors and weak points
- Group behavior to prevent clustering

### Target Priority
1. Players in open areas
2. Defensive structures (turrets when implemented)
3. Fortress core/walls
4. Support structures

### Difficulty Adaptation
- Track player performance (K/D, accuracy, building skill)
- Adjust spawn positions and enemy composition
- Smarter AI on higher waves (flanking, coordinated attacks)

## Technical Implementation

### Server Architecture
- `server-pve.js` - Dedicated PvE server
- Separate game loop for AI processing
- Enemy state management in `gameState.npcs`
- Wave controller manages spawning and progression

### Client Updates
- Show wave number and enemies remaining
- Team health/lives display
- Fortress health indicators
- Enhanced minimap showing enemy positions

### Performance Considerations
- Limit max NPCs to 100 active
- LOD system for distant NPCs
- Simplified physics for NPCs
- Batch pathfinding updates

## Future Expansions
- Boss battles every 10 waves
- Power-ups and temporary buffs
- Buildable defenses (turrets, traps)
- Different fortress layouts/maps
- Competitive leaderboards