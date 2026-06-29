// Shared progression/economy logic (Track 3).
// Single source of truth for the XP curve and reward amounts, used by both servers.

const goldEconomy = require('../config/goldEconomy');

// XP required to advance FROM `level` to the next level. Gentle escalating curve.
function xpForLevel(level) {
  return 100 + (Math.max(1, level) - 1) * 50;
}

// Add experience to a player object (mutates level/experience). Returns level-up info.
function addExperience(player, amount) {
  player.level = player.level || 1;
  player.experience = (player.experience || 0) + amount;
  let levelsGained = 0;
  while (player.experience >= xpForLevel(player.level)) {
    player.experience -= xpForLevel(player.level);
    player.level += 1;
    levelsGained += 1;
  }
  return { leveledUp: levelsGained > 0, newLevel: player.level, levelsGained };
}

// XP reward amounts.
const XP = {
  kill: 25,
  headshot: 10,
  npcKill: 8,
  boss: 250,
  waveComplete: 40
};

// Gold for a player kill (base + optional headshot bonus).
function killGold(isHeadshot) {
  return goldEconomy.combat.kill + (isHeadshot ? goldEconomy.combat.headshot : 0);
}

// Gold for an NPC kill, scaled by tier.
function npcGold(tier) {
  const r = goldEconomy.pve.npcRewards;
  if (tier === 'boss') return r.boss;
  if (tier === 'advanced') return r.advanced;
  return r.basic;
}

// Which weapons require unlocking and their gold cost (0 = free/default).
const WEAPON_UNLOCKS = {
  pistol: 0,
  rifle: goldEconomy.weapons.rifle,
  shotgun: goldEconomy.weapons.shotgun,
  sniper: goldEconomy.weapons.sniper
};

module.exports = { xpForLevel, addExperience, XP, killGold, npcGold, WEAPON_UNLOCKS, goldEconomy };
