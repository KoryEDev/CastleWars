// Achievement System Configuration
const achievements = {
  // Combat Achievements
  firstBlood: {
    id: 'firstBlood',
    name: 'First Blood',
    description: 'Get your first kill',
    category: 'combat',
    icon: '🗡️',
    requirement: 1,
    points: 10,
    type: 'single' // single completion achievement
  },
  
  sharpshooter: {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    description: 'Achieve 80% accuracy in a match',
    category: 'combat',
    icon: '🎯',
    requirement: 0.8,
    points: 25,
    type: 'single',
    checkCondition: (stats) => stats.accuracy >= 0.8 && stats.shotsFired >= 20
  },
  
  // Tiered kill achievements
  slayer: {
    id: 'slayer',
    name: 'Slayer',
    description: 'Eliminate enemies',
    category: 'combat',
    icon: '⚔️',
    type: 'tiered',
    tiers: [
      { tier: 1, name: 'Rookie Slayer', requirement: 10, points: 10 },
      { tier: 2, name: 'Veteran Slayer', requirement: 50, points: 25 },
      { tier: 3, name: 'Master Slayer', requirement: 100, points: 50 },
      { tier: 4, name: 'Legendary Slayer', requirement: 500, points: 100 },
      { tier: 5, name: 'Godlike Slayer', requirement: 1000, points: 200 }
    ]
  },
  
  headshotHunter: {
    id: 'headshotHunter',
    name: 'Headshot Hunter',
    description: 'Land headshots on enemies',
    category: 'combat',
    icon: '💀',
    type: 'tiered',
    tiers: [
      { tier: 1, name: 'Marksman', requirement: 5, points: 15 },
      { tier: 2, name: 'Sniper', requirement: 25, points: 30 },
      { tier: 3, name: 'Elite Sniper', requirement: 100, points: 60 }
    ]
  },
  
  // Building Achievements
  architect: {
    id: 'architect',
    name: 'Architect',
    description: 'Place blocks to build structures',
    category: 'building',
    icon: '🏗️',
    type: 'tiered',
    tiers: [
      { tier: 1, name: 'Builder', requirement: 50, points: 10 },
      { tier: 2, name: 'Constructor', requirement: 200, points: 25 },
      { tier: 3, name: 'Master Architect', requirement: 1000, points: 50 }
    ]
  },
  
  fortBuilder: {
    id: 'fortBuilder',
    name: 'Fort Builder',
    description: 'Build your first complete fortress',
    category: 'building',
    icon: '🏰',
    requirement: 1,
    points: 30,
    type: 'special' // Special achievement that requires custom logic
  },
  
  // Economy Achievements
  goldCollector: {
    id: 'goldCollector',
    name: 'Gold Collector',
    description: 'Accumulate gold',
    category: 'economy',
    icon: '💰',
    type: 'tiered',
    tiers: [
      { tier: 1, name: 'Penny Pincher', requirement: 100, points: 10 },
      { tier: 2, name: 'Gold Hoarder', requirement: 1000, points: 25 },
      { tier: 3, name: 'Wealthy Warrior', requirement: 10000, points: 50 },
      { tier: 4, name: 'Castle Tycoon', requirement: 100000, points: 100 }
    ]
  },
  
  // Survival Achievements
  survivor: {
    id: 'survivor',
    name: 'Survivor',
    description: 'Survive without dying',
    category: 'survival',
    icon: '🛡️',
    type: 'tiered',
    tiers: [
      { tier: 1, name: 'Lucky', requirement: 5, points: 15 }, // 5 minutes
      { tier: 2, name: 'Resilient', requirement: 15, points: 30 }, // 15 minutes
      { tier: 3, name: 'Untouchable', requirement: 30, points: 60 } // 30 minutes
    ]
  },
  
  // Streak Achievements
  killStreak: {
    id: 'killStreak',
    name: 'Kill Streak',
    description: 'Get consecutive kills without dying',
    category: 'combat',
    icon: '🔥',
    type: 'tiered',
    tiers: [
      { tier: 1, name: 'Hot Streak', requirement: 3, points: 15 },
      { tier: 2, name: 'Rampage', requirement: 5, points: 30 },
      { tier: 3, name: 'Unstoppable', requirement: 10, points: 50 },
      { tier: 4, name: 'Godlike', requirement: 20, points: 100 }
    ]
  },
  
  // PvE Achievements (for future)
  waveWarrior: {
    id: 'waveWarrior',
    name: 'Wave Warrior',
    description: 'Complete PvE waves',
    category: 'pve',
    icon: '🌊',
    type: 'tiered',
    tiers: [
      { tier: 1, name: 'Wave Rookie', requirement: 5, points: 20 },
      { tier: 2, name: 'Wave Veteran', requirement: 10, points: 40 },
      { tier: 3, name: 'Wave Master', requirement: 20, points: 80 }
    ]
  },
  
  // Special Achievements
  welcomeWarrior: {
    id: 'welcomeWarrior',
    name: 'Welcome to Castle Wars',
    description: 'Complete the tutorial',
    category: 'special',
    icon: '🎮',
    requirement: 1,
    points: 5,
    type: 'single'
  },
  
  dedicated: {
    id: 'dedicated',
    name: 'Dedicated Warrior',
    description: 'Play for total hours',
    category: 'special',
    icon: '⏰',
    type: 'tiered',
    tiers: [
      { tier: 1, name: 'Regular', requirement: 1, points: 10 }, // 1 hour
      { tier: 2, name: 'Dedicated', requirement: 10, points: 25 }, // 10 hours
      { tier: 3, name: 'Veteran', requirement: 50, points: 50 }, // 50 hours
      { tier: 4, name: 'No Life', requirement: 100, points: 100 } // 100 hours
    ]
  }
};

// Helper function to get all achievements as array
function getAllAchievements() {
  return Object.values(achievements);
}

// Helper function to get achievement by ID
function getAchievementById(id) {
  return achievements[id];
}

// Helper function to calculate total possible points
function getTotalPossiblePoints() {
  let total = 0;
  for (const achievement of Object.values(achievements)) {
    if (achievement.type === 'single' || achievement.type === 'special') {
      total += achievement.points;
    } else if (achievement.type === 'tiered' && achievement.tiers) {
      // Only highest tier counts
      total += achievement.tiers[achievement.tiers.length - 1].points;
    }
  }
  return total;
}

// Categories for UI organization
const categories = {
  combat: { name: 'Combat', icon: '⚔️', color: '#ff4444' },
  building: { name: 'Building', icon: '🏗️', color: '#4444ff' },
  economy: { name: 'Economy', icon: '💰', color: '#ffaa00' },
  survival: { name: 'Survival', icon: '🛡️', color: '#44ff44' },
  pve: { name: 'PvE', icon: '🌊', color: '#ff44ff' },
  special: { name: 'Special', icon: '⭐', color: '#ffff44' }
};

module.exports = {
  achievements,
  categories,
  getAllAchievements,
  getAchievementById,
  getTotalPossiblePoints
}; 