# Socket.IO Event Contracts

Single reference for realtime events so feature tracks don't collide on names.
C->S = client to server, S->C = server to client.

## Core (existing)
- `verifyLogin` (C->S): `{ username }` - validate login.
- `loginVerified` / `loginError` (S->C).
- `join` (C->S): `{ username, preferredWeapon }`.
- `initialState` (S->C): initial player/world data.
- `worldState` (S->C): authoritative snapshot `{ players, buildings, bullets, sun, weaponShopArea, ...(pve: npcs, wave, parties) }`.
- `playerInput` (C->S): `{ up, left, right, aimAngle }`.
- `bulletCreated` (C->S) / broadcast bullet (S->C).
- `playerDamaged`, `playerKill`, `bulletDestroyed`, `tomatoExploded` (S->C).
- `placeBlock` / `deleteBlock` (C->S); `buildingPlaced` / `buildingDeleted` / `placeFailed` (S->C).
- Chat: `chatMessage` (C->S) / `chat` (S->C).

## PvE (existing)
- `waveCountdown`, `waveStarted`, `waveCompleted`, `waveCleared` (S->C).
- `npcDamaged`, `npcKilled` (S->C).
- `blockDamaged`, `blockDestroyed` (S->C).
- `partyUpdate`, `playerDowned`, `playerStunned`, `playerEliminated`, `playerRevived` (S->C).
- `revivePlayer` / `attemptRevive` (C->S); `reviveStarted`, `reviveProgress` (S->C).
- `gameOver` (S->C); `restartGame` (C->S).

## Reserved by tracks (new)
- Track 1 Security: `authToken` (C->S handshake), `kickedForCheat` (S->C).
- Track 3 Progression: `xpGained`, `levelUp` (S->C); `purchaseItem`, `upgradeWeapon` (C->S).
- Track 4 Classes/Abilities: `selectClass` (C->S), `useAbility` (C->S), `abilityUsed`, `abilityCooldown` (S->C).
- Track 5 Loot/Crafting: `itemDropped`, `itemsSpawned` (S->C), `itemCollected` (C->S), `craftItem` (C->S).
- Track 6 Modes: `modeState`, `roundStart`, `roundEnd`, `flagTaken`, `flagCaptured`, `pointCaptured`, `zoneUpdate` (S->C).
- Track 7 PvE: `bossSpawned`, `bossUpdate`, `bossPhase`, `bossDefeated` (S->C); `buffActivated`, `buffExpired` (S->C).
- Track 8 Social: `clanUpdate`, `clanChat`, `friendRequest`, `friendUpdate`, `whisper` (both).
- Track 11 UI: `scoreboardData` (S->C).
- Track 15 Quests/Events: `questUpdate`, `questCompleted`, `worldEvent` (S->C).
