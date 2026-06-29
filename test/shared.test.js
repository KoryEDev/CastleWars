// Unit tests for shared modules (Track 16). Run with: npm test  (node --test)
const test = require('node:test');
const assert = require('node:assert');

const progression = require('../shared/progression');
const { WEAPON_CONFIG, canUseWeapon, getValidatedWeaponDamage } = require('../shared/weaponConfig');
const { BLOCK_TYPES, BUILDING_HEALTH } = require('../shared/blockConfig');
const { CLASSES, getClass } = require('../shared/classes');
const { GAME_MODES } = require('../shared/gameModes');

test('xp curve increases with level', () => {
  assert.ok(progression.xpForLevel(2) > progression.xpForLevel(1));
  assert.strictEqual(progression.xpForLevel(1), 100);
});

test('addExperience levels a player up', () => {
  const p = { level: 1, experience: 0 };
  const res = progression.addExperience(p, progression.xpForLevel(1) + 5);
  assert.strictEqual(res.leveledUp, true);
  assert.strictEqual(p.level, 2);
  assert.strictEqual(p.experience, 5);
});

test('weapon access: staff weapons gated by role', () => {
  assert.strictEqual(canUseWeapon('pistol', 'player'), true);
  assert.strictEqual(canUseWeapon('minigun', 'player'), false);
  assert.strictEqual(canUseWeapon('minigun', 'admin'), true);
  assert.strictEqual(canUseWeapon('triangun', 'admin'), false);
  assert.strictEqual(canUseWeapon('triangun', 'owner'), true);
});

test('unauthorized weapon damage falls back to pistol damage', () => {
  assert.strictEqual(getValidatedWeaponDamage('minigun', 'player'), 15);
  assert.strictEqual(getValidatedWeaponDamage('sniper', 'player'), WEAPON_CONFIG.sniper.damage);
});

test('block config includes new Track 5 blocks with health', () => {
  assert.ok(BLOCK_TYPES.includes('glass'));
  assert.ok(BLOCK_TYPES.includes('reinforced'));
  assert.strictEqual(BUILDING_HEALTH.reinforced, 250);
});

test('classes resolve with a default fallback', () => {
  assert.ok(CLASSES.soldier);
  assert.strictEqual(getClass('nonexistent').name, CLASSES.soldier.name);
  assert.strictEqual(getClass('medic').ability.type, 'heal');
});

test('game modes include koth with a target score', () => {
  assert.ok(GAME_MODES.koth);
  assert.ok(GAME_MODES.koth.objective.targetScore > 0);
});
