// Achievement System Configuration
const achievementDefinitions = {
  // Tutorial Achievements
  tutorial_placeBlock: {
    id: 'tutorial_placeBlock',
    name: 'Place a Block',
    description: 'Place your first block',
    category: 'tutorial',
    gold: 20,
    condition: { type: 'blocksPlaced', count: 1 }
  },
  tutorial_placeBlockAir: {
    id: 'tutorial_placeBlockAir',
    name: 'Sky Builder',
    description: 'Place a block while jumping',
    category: 'tutorial',
    gold: 20,
    condition: { type: 'blockPlaceAir', count: 1 }
  },
  tutorial_fireShot: {
    id: 'tutorial_fireShot',
    name: 'First Shot',
    description: 'Fire your first bullet',
    category: 'tutorial',
    gold: 20,
    condition: { type: 'weaponShots', weapon: 'any', count: 1 }
  },
  tutorial_switchWeapon: {
    id: 'tutorial_switchWeapon',
    name: 'Switch It Up',
    description: 'Switch your weapon',
    category: 'tutorial',
    gold: 20,
    condition: { type: 'switchWeapon', count: 1 }
  },
  tutorial_buildMode: {
    id: 'tutorial_buildMode',
    name: 'Builder Mode',
    description: 'Enter build mode for the first time',
    category: 'tutorial',
    gold: 20,
    condition: { type: 'enterBuildMode', count: 1 }
  },

  // Movement & Exploration (blocks)
  firstSteps: {
    id: 'firstSteps',
    name: 'First Steps',
    description: 'Travel 8 blocks',
    category: 'exploration',
    gold: 10,
    condition: { type: 'movement', blocks: 8 }
  },
  explorer: {
    id: 'explorer',
    name: 'Explorer',
    description: 'Travel 80 blocks',
    category: 'exploration',
    gold: 20,
    condition: { type: 'movement', blocks: 80 }
  },
  wanderer: {
    id: 'wanderer',
    name: 'Wanderer',
    description: 'Travel 400 blocks',
    category: 'exploration',
    gold: 50,
    condition: { type: 'movement', blocks: 400 }
  },
  marathoner: {
    id: 'marathoner',
    name: 'Marathoner',
    description: 'Travel 1,500 blocks',
    category: 'exploration',
    gold: 100,
    condition: { type: 'movement', blocks: 1500 }
  },
  
  // Weapon-Specific Achievements
  // Pistol
  pistolNovice: {
    id: 'pistolNovice',
    name: 'Pistol Novice',
    description: 'Fire 100 bullets with the pistol',
    category: 'weapons',
    gold: 20,
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
    gold: 50,
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
    gold: 100,
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
    gold: 20,
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
    gold: 50,
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
    gold: 100,
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
    gold: 20,
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
    gold: 50,
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
    gold: 100,
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
    gold: 20,
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
    gold: 50,
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
    gold: 100,
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
    gold: 20,
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
    gold: 50,
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
    gold: 100,
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
    gold: 25,
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
    gold: 50,
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
    gold: 100,
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
    gold: 200,
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
    gold: 10,
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
    gold: 20,
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
    gold: 50,
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
    gold: 15,
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
    gold: 30,
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
    gold: 60,
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
    gold: 150,
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
    gold: 20,
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
    gold: 40,
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
    gold: 80,
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
    gold: 10,
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
    gold: 25,
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
    gold: 75,
    condition: {
      type: 'blocksPlaced',
      count: 1000
    }
  }
};

module.exports = achievementDefinitions; 