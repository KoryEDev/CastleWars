// Gold Economy Configuration
module.exports = {
  // Starting gold for new players
  startingGold: 100,
  
  // Combat Rewards
  combat: {
    kill: 10,                    // Base kill reward
    headshot: 5,                 // Bonus for headshot
    firstBlood: 25,              // First kill of the match
    revenge: 15,                 // Killing your killer
    assist: 5,                   // Damaging enemy that dies
    
    // Kill streak bonuses
    streaks: {
      3: 15,   // 3 kills
      5: 25,   // 5 kills
      10: 50,  // 10 kills
      15: 100  // 15 kills
    },
    
    // Multi-kill bonuses (within 3 seconds)
    multiKills: {
      2: 10,   // Double kill
      3: 20,   // Triple kill
      4: 40,   // Quad kill
      5: 80    // Penta kill
    }
  },
  
  // Survival Rewards
  survival: {
    timeAlive: {
      interval: 30000,  // Every 30 seconds
      amount: 5
    },
    survivalStreak: {
      3: 20,   // 3 lives without dying
      5: 40,   // 5 lives without dying
      10: 100  // 10 lives without dying
    }
  },
  
  // Building Rewards
  building: {
    placeBlock: 1,              // Per block placed
    structureComplete: 10,      // Complete structure bonus
    blockDefended: 2,           // When your block blocks damage
    structureDuration: {
      interval: 60000,  // Every minute
      amount: 5         // If structure still stands
    }
  },
  
  // Resource Collection
  resources: {
    goldBlock: {
      minValue: 20,
      maxValue: 50,
      respawnTime: 120000  // 2 minutes
    },
    supplyDrop: {
      minGold: 30,
      maxGold: 100,
      interval: 180000     // 3 minutes
    },
    hiddenTreasure: {
      minValue: 50,
      maxValue: 200,
      locations: 5         // Number of treasure spots
    }
  },
  
  // Weapon Prices
  weapons: {
    // Basic weapons (starter)
    pistol: 0,      // Free starter
    rifle: 50,      // Upgrade from pistol
    
    // Mid-tier weapons
    shotgun: 150,
    sniper: 200,
    
    // High-tier weapons
    minigun: 500,
    tomatogun: 1000,  // Admin weapon
    triangun: 2000    // Owner weapon
  },
  
  // Item Prices
  items: {
    // Ammo
    ammo_small: 10,    // 30 rounds
    ammo_medium: 25,   // 90 rounds
    ammo_large: 50,    // 200 rounds
    
    // Health items
    health_small: 15,  // 25 HP
    health_medium: 30, // 50 HP
    health_large: 60,  // 100 HP
    
    // Building materials
    blocks_basic: 5,   // 10 blocks
    blocks_premium: 15 // 10 premium blocks
  },
  
  // Trading Configuration
  trading: {
    minGoldTrade: 10,
    maxGoldTrade: 10000,
    tradeFee: 0.05,  // 5% fee on gold trades
    
    // Item trading values (suggested prices)
    itemValues: {
      pistol: 25,
      rifle: 40,
      shotgun: 120,
      sniper: 160,
      minigun: 400,
      ammo: 1,      // Per bullet
      blocks: 0.5   // Per block
    }
  },
  
  // PvE Mode Specific
  pve: {
    waveCompletion: {
      baseReward: 50,
      waveMultiplier: 1.2,  // Increases each wave
      perfectBonus: 100     // No deaths
    },
    
    npcRewards: {
      basic: 5,
      advanced: 10,
      boss: 100
    },
    
    teamObjectives: {
      defendPosition: 50,
      buildFortress: 75,
      escortVIP: 100
    }
  },
  
  // Death Penalties
  penalties: {
    deathCost: 0,  // No gold loss on death (keep it fun)
    teamKillPenalty: -20  // Lose gold for team killing
  },
  
  // Daily/Login Bonuses
  dailyRewards: {
    day1: 50,
    day2: 75,
    day3: 100,
    day4: 150,
    day5: 200,
    day6: 300,
    day7: 500,
    streak7: 1000  // Weekly streak bonus
  }
};