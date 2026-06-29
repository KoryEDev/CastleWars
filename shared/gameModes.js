// Game mode framework metadata (Track 6).
// Defines the available modes so the landing page / lobby can present them and the
// servers can branch behaviour. The King of the Hill objective is fully implemented
// (see server/modes/koth.js); the others are framework-registered entries.

const GAME_MODES = {
  pvp: { id: 'pvp', name: 'Deathmatch', team: false, description: 'Classic free-for-all combat.' },
  koth: { id: 'koth', name: 'King of the Hill', team: false, description: 'Hold the hill zone to score. First to the target wins.', objective: { targetScore: 30 } },
  tdm: { id: 'tdm', name: 'Team Deathmatch', team: true, description: 'Two teams, most kills wins.' },
  ctf: { id: 'ctf', name: 'Capture the Flag', team: true, description: 'Steal the enemy flag.' },
  gungame: { id: 'gungame', name: 'Gun Game', team: false, description: 'Each kill upgrades your weapon.' },
  br: { id: 'br', name: 'Battle Royale', team: false, description: 'Last one standing as the storm closes in.' },
  pve: { id: 'pve', name: 'PvE Survival', team: true, description: 'Co-op wave survival.' }
};

module.exports = { GAME_MODES };
