# PvE Loot System Implementation Plan

## Phase 1: Foundation & Bug Fixes (Priority 1)
### 1.1 Fix Critical Issues
- [ ] Fix E key being captured while typing in chat
- [ ] Remove team lives system
- [ ] Implement solo player auto-respawn (5 sec with blink effect)
- [ ] Add proper game over screen with stats
- [ ] Clear buildings on game end/party disband
- [ ] Add restart game functionality for party leader

### 1.2 Connect Existing Item System
- [ ] Add `itemsSpawned` handler in GameScene.js
- [ ] Implement `itemCollected` server event
- [ ] Sync item removal across all clients
- [ ] Test basic item spawning/collection flow

## Phase 2: Loot Drop System (Priority 2)
### 2.1 Server-Side Item Drops
- [ ] Create loot table system with drop rates
- [ ] Add item drops from NPCs on death
- [ ] Implement rarity-based drop chances
- [ ] Add position-based item spawning (where NPC died)

### 2.2 Expand Item Types
- [ ] Food items (healing):
  - Apple (15 HP)
  - Bread (20 HP)
  - Berries (10 HP)
  - Cooked Meat (40 HP)
  - Healing Potion (50 HP over time)
  - Energy Drink (30 HP + speed)
  - Golden Apple (full heal + resist)
  - Feast (party heal)
  - Phoenix Feather (auto-revive)

- [ ] Power-ups (temporary buffs):
  - Damage Boost (2x damage, 30s)
  - Speed Boots (1.5x speed, 30s)
  - Shield (50% damage reduction, 30s)
  - Rapid Fire (2x fire rate, 30s)
  - Vampire Bullets (lifesteal, 30s)
  - Quad Damage (4x damage, 20s)
  - Invincibility Star (10s)
  - Time Freeze (slow NPCs, 15s)

### 2.3 Client-Side Item Updates
- [ ] Add new item textures/sprites
- [ ] Update Item.js to handle new types
- [ ] Add visual effects for different rarities
- [ ] Implement buff system for power-ups
- [ ] Add UI indicators for active buffs

## Phase 3: Point Shop System (Priority 3)
### 3.1 Shop UI
- [ ] Create point shop UI interface
- [ ] Add to weapon shop or separate building
- [ ] Categorize items (Upgrades/Defense/Abilities/Cosmetic)
- [ ] Show current points and item costs

### 3.2 Permanent Upgrades
- [ ] Max Health upgrades (+10 HP, max 5x)
- [ ] Movement Speed upgrades (+5%, max 3x)
- [ ] Jump Height upgrades (+10%, max 3x)
- [ ] Build Speed upgrade (+25%)
- [ ] Ammo Capacity upgrades (+20% per weapon)

### 3.3 Purchasable Items
- [ ] Defensive structures:
  - Wooden Barricade (instant 3x1 wall)
  - Stone Tower (instant 2x3 structure)
  - Healing Station (area heal)
  - Ammo Crate (area reload)

- [ ] Special abilities:
  - Airstrike (bombing run)
  - Turret (temporary auto-turret)
  - Supply Drop (random items)
  - Nuke (clear screen)

- [ ] Team upgrades:
  - Party Damage +10%
  - Party Armor +10%
  - Faster Revive

### 3.4 Server Implementation
- [ ] Track purchased upgrades per player
- [ ] Apply upgrade effects
- [ ] Validate point spending
- [ ] Persist upgrades for the game session

## Phase 4: Random World Spawns (Priority 4)
### 4.1 Spawn System
- [ ] Timer-based random spawns
- [ ] Location selection algorithm
- [ ] Spawn rate based on wave/difficulty
- [ ] Special event spawns

### 4.2 Special Items
- [ ] Mystery boxes
- [ ] Rare power-ups
- [ ] Point multipliers
- [ ] Special weapons

## Phase 5: Polish & Balance (Priority 5)
### 5.1 Visual Effects
- [ ] Item spawn animations
- [ ] Collection particle effects
- [ ] Buff aura effects
- [ ] Shop purchase animations

### 5.2 Audio
- [ ] Item pickup sounds
- [ ] Buff activation sounds
- [ ] Shop interaction sounds

### 5.3 Balance
- [ ] Adjust drop rates
- [ ] Tune item effectiveness
- [ ] Balance point costs
- [ ] Test all combinations

## Technical Requirements

### Server-Side Changes:
1. **server-pve.js**:
   - Expand item spawning system
   - Add loot tables
   - Implement buff tracking
   - Add shop purchase handlers
   - Track player upgrades

2. **Database Schema**:
   - Add player upgrades tracking
   - Store active buffs
   - Track purchase history

### Client-Side Changes:
1. **GameScene.js**:
   - Connect item spawning
   - Add buff visual effects
   - Implement shop UI
   - Handle upgrade applications

2. **Item.js**:
   - Expand item types
   - Add new visual effects
   - Implement consumption logic

3. **Player.js**:
   - Add buff system
   - Track active effects
   - Apply upgrade modifiers

4. **New Files**:
   - `js/systems/BuffSystem.js`
   - `js/ui/PointShopUI.js`
   - `js/data/LootTables.js`

### Network Events:
- `itemDropped` - NPC drops item
- `itemCollected` - Player picks up item
- `buffActivated` - Power-up used
- `buffExpired` - Effect ended
- `shopPurchase` - Buy from shop
- `upgradeApplied` - Permanent upgrade

### Asset Requirements:
- Food item sprites (9 types)
- Power-up sprites (8 types)
- Buff effect sprites
- Shop UI elements
- Particle effects

## Implementation Order:
1. Fix critical bugs (E key, game over, etc.)
2. Connect existing item system
3. Implement basic food drops
4. Add point shop with upgrades
5. Add power-ups for later waves
6. Polish and balance

## Estimated Timeline:
- Phase 1: 2-3 hours
- Phase 2: 3-4 hours
- Phase 3: 4-5 hours
- Phase 4: 2-3 hours
- Phase 5: 2-3 hours

Total: ~16-20 hours of implementation