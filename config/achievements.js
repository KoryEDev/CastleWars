// Achievement System Configuration
const achievementDefinitions = {
  // Movement & Exploration
  firstSteps: {
    id: 'firstSteps',
    name: 'First Steps',
    description: 'Move for the first time',
    category: 'exploration',
    points: 10,
    condition: {
      type: 'movement',
      distance: 10
    }
  },
  
  explorer: {
    id: 'explorer',
    name: 'Explorer',
    description: 'Travel 1000 pixels',
    category: 'exploration',
    points: 20,
    condition: {
      type: 'movement',
      distance: 1000
    }
  },
  
  wanderer: {
    id: 'wanderer',
    name: 'Wanderer',
    description: 'Travel 10,000 pixels',
    category: 'exploration',
    points: 50,
    condition: {
      type: 'movement',
      distance: 10000
    }
  },
  
  // Weapon-Specific Achievements
  // Pistol
  pistolNovice: {
    id: 'pistolNovice',
    name: 'Pistol Novice',
    description: 'Fire 100 bullets with the pistol',
    category: 'weapons',
    points: 20,
    condition: {
      type: 'weaponShots',
      weapon: 'pistol',
      count: 100
    }
  },
  
  pistolExpert: {
    id: 'pistolExpert',
    name: 'Pistol Expert',
    description: 'Fire 1,000 bullets with the pistol',
    category: 'weapons',
    points: 50,
    condition: {
      type: 'weaponShots',
      weapon: 'pistol',
      count: 1000
    }
  },
  
  pistolMaster: {
    id: 'pistolMaster',
    name: 'Pistol Master',
    description: 'Fire 10,000 bullets with the pistol',
    category: 'weapons',
    points: 100,
    condition: {
      type: 'weaponShots',
      weapon: 'pistol',
      count: 10000
    }
  },
  
  // Rifle
  rifleNovice: {
    id: 'rifleNovice',
    name: 'Rifle Novice',
    description: 'Fire 100 bullets with the rifle',
    category: 'weapons',
    points: 20,
    condition: {
      type: 'weaponShots',
      weapon: 'rifle',
      count: 100
    }
  },
  
  rifleExpert: {
    id: 'rifleExpert',
    name: 'Rifle Expert',
    description: 'Fire 1,000 bullets with the rifle',
    category: 'weapons',
    points: 50,
    condition: {
      type: 'weaponShots',
      weapon: 'rifle',
      count: 1000
    }
  },
  
  rifleMaster: {
    id: 'rifleMaster',
    name: 'Rifle Master',
    description: 'Fire 10,000 bullets with the rifle',
    category: 'weapons',
    points: 100,
    condition: {
      type: 'weaponShots',
      weapon: 'rifle',
      count: 10000
    }
  },
  
  // Shotgun
  shotgunNovice: {
    id: 'shotgunNovice',
    name: 'Shotgun Novice',
    description: 'Fire 100 shells with the shotgun',
    category: 'weapons',
    points: 20,
    condition: {
      type: 'weaponShots',
      weapon: 'shotgun',
      count: 100
    }
  },
  
  shotgunExpert: {
    id: 'shotgunExpert',
    name: 'Shotgun Expert',
    description: 'Fire 1,000 shells with the shotgun',
    category: 'weapons',
    points: 50,
    condition: {
      type: 'weaponShots',
      weapon: 'shotgun',
      count: 1000
    }
  },
  
  shotgunMaster: {
    id: 'shotgunMaster',
    name: 'Shotgun Master',
    description: 'Fire 10,000 shells with the shotgun',
    category: 'weapons',
    points: 100,
    condition: {
      type: 'weaponShots',
      weapon: 'shotgun',
      count: 10000
    }
  },
  
  // Sniper
  sniperNovice: {
    id: 'sniperNovice',
    name: 'Sniper Novice',
    description: 'Fire 50 shots with the sniper',
    category: 'weapons',
    points: 20,
    condition: {
      type: 'weaponShots',
      weapon: 'sniper',
      count: 50
    }
  },
  
  sniperExpert: {
    id: 'sniperExpert',
    name: 'Sniper Expert',
    description: 'Fire 500 shots with the sniper',
    category: 'weapons',
    points: 50,
    condition: {
      type: 'weaponShots',
      weapon: 'sniper',
      count: 500
    }
  },
  
  sniperMaster: {
    id: 'sniperMaster',
    name: 'Sniper Master',
    description: 'Fire 5,000 shots with the sniper',
    category: 'weapons',
    points: 100,
    condition: {
      type: 'weaponShots',
      weapon: 'sniper',
      count: 5000
    }
  },
  
  // Minigun
  minigunNovice: {
    id: 'minigunNovice',
    name: 'Minigun Novice',
    description: 'Fire 500 bullets with the minigun',
    category: 'weapons',
    points: 20,
    condition: {
      type: 'weaponShots',
      weapon: 'minigun',
      count: 500
    }
  },
  
  minigunExpert: {
    id: 'minigunExpert',
    name: 'Minigun Expert',
    description: 'Fire 5,000 bullets with the minigun',
    category: 'weapons',
    points: 50,
    condition: {
      type: 'weaponShots',
      weapon: 'minigun',
      count: 5000
    }
  },
  
  minigunMaster: {
    id: 'minigunMaster',
    name: 'Minigun Master',
    description: 'Fire 50,000 bullets with the minigun',
    category: 'weapons',
    points: 100,
    condition: {
      type: 'weaponShots',
      weapon: 'minigun',
      count: 50000
    }
  },
  
  // PVP Achievements
  firstBlood: {
    id: 'firstBlood',
    name: 'First Blood',
    description: 'Get your first player kill',
    category: 'pvp',
    points: 25,
    condition: {
      type: 'playerKills',
      count: 1
    }
  },
  
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    description: 'Kill 10 players',
    category: 'pvp',
    points: 50,
    condition: {
      type: 'playerKills',
      count: 10
    }
  },
  
  gladiator: {
    id: 'gladiator',
    name: 'Gladiator',
    description: 'Kill 50 players',
    category: 'pvp',
    points: 100,
    condition: {
      type: 'playerKills',
      count: 50
    }
  },
  
  champion: {
    id: 'champion',
    name: 'Champion',
    description: 'Kill 100 players',
    category: 'pvp',
    points: 200,
    condition: {
      type: 'playerKills',
      count: 100
    }
  },
  
  // Death Achievements
  firstDeath: {
    id: 'firstDeath',
    name: 'First Death',
    description: 'Die for the first time',
    category: 'survival',
    points: 10,
    condition: {
      type: 'deaths',
      count: 1
    }
  },
  
  mortal: {
    id: 'mortal',
    name: 'Mortal',
    description: 'Die 10 times',
    category: 'survival',
    points: 20,
    condition: {
      type: 'deaths',
      count: 10
    }
  },
  
  persistent: {
    id: 'persistent',
    name: 'Persistent',
    description: 'Die 50 times and keep playing',
    category: 'survival',
    points: 50,
    condition: {
      type: 'deaths',
      count: 50
    }
  },
  
  // Economy Achievements (Fixed for existing gold)
  pocketChange: {
    id: 'pocketChange',
    name: 'Pocket Change',
    description: 'Accumulate 100 gold',
    category: 'economy',
    points: 15,
    condition: {
      type: 'goldTotal',
      amount: 100
    }
  },
  
  goldSaver: {
    id: 'goldSaver',
    name: 'Gold Saver',
    description: 'Accumulate 1,000 gold',
    category: 'economy',
    points: 30,
    condition: {
      type: 'goldTotal',
      amount: 1000
    }
  },
  
  wealthy: {
    id: 'wealthy',
    name: 'Wealthy',
    description: 'Accumulate 10,000 gold',
    category: 'economy',
    points: 60,
    condition: {
      type: 'goldTotal',
      amount: 10000
    }
  },
  
  richBeyondMeasure: {
    id: 'richBeyondMeasure',
    name: 'Rich Beyond Measure',
    description: 'Accumulate 100,000 gold',
    category: 'economy',
    points: 150,
    condition: {
      type: 'goldTotal',
      amount: 100000
    }
  },
  
  // PvE Achievements
  enemySlayer: {
    id: 'enemySlayer',
    name: 'Enemy Slayer',
    description: 'Kill 10 NPCs',
    category: 'pve',
    points: 20,
    condition: {
      type: 'npcKills',
      count: 10
    }
  },
  
  monsterHunter: {
    id: 'monsterHunter',
    name: 'Monster Hunter',
    description: 'Kill 50 NPCs',
    category: 'pve',
    points: 40,
    condition: {
      type: 'npcKills',
      count: 50
    }
  },
  
  exterminator: {
    id: 'exterminator',
    name: 'Exterminator',
    description: 'Kill 100 NPCs',
    category: 'pve',
    points: 80,
    condition: {
      type: 'npcKills',
      count: 100
    }
  },
  
  // Building Achievements
  firstBlock: {
    id: 'firstBlock',
    name: 'First Block',
    description: 'Place your first block',
    category: 'building',
    points: 10,
    condition: {
      type: 'blocksPlaced',
      count: 1
    }
  },
  
  builder: {
    id: 'builder',
    name: 'Builder',
    description: 'Place 100 blocks',
    category: 'building',
    points: 25,
    condition: {
      type: 'blocksPlaced',
      count: 100
    }
  },
  
  architect: {
    id: 'architect',
    name: 'Architect',
    description: 'Place 1,000 blocks',
    category: 'building',
    points: 75,
    condition: {
      type: 'blocksPlaced',
      count: 1000
    }
  }
};

module.exports = achievementDefinitions; 