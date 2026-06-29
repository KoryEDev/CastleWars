// Quest / daily challenge definitions (Track 15). Shared so server tracks and client
// displays the same set.

const DAILY_QUESTS = [
  { id: 'kills10', name: 'Slayer', desc: 'Defeat 10 enemies', metric: 'kills', target: 10, rewardGold: 50, rewardXp: 100 },
  { id: 'blocks15', name: 'Architect', desc: 'Place 15 blocks', metric: 'blocksPlaced', target: 15, rewardGold: 30, rewardXp: 60 },
  { id: 'wave5', name: 'Survivor', desc: 'Reach wave 5 in PvE', metric: 'wave', target: 5, rewardGold: 80, rewardXp: 150 }
];

module.exports = { DAILY_QUESTS };
