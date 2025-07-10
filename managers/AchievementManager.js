const AchievementProgress = require('../models/Achievement');
const Player = require('../models/Player');
const { achievements, getAchievementById } = require('../config/achievements');

class AchievementManager {
  constructor(io) {
    this.io = io;
    this.progressCache = new Map(); // Cache for performance
  }

  // Initialize achievement progress for a player
  async initializePlayerAchievements(playerId) {
    const existingProgress = await AchievementProgress.find({ playerId });
    const existingIds = new Set(existingProgress.map(p => p.achievementId));

    // Create progress entries for any missing achievements
    const newProgress = [];
    for (const achievement of Object.values(achievements)) {
      if (!existingIds.has(achievement.id)) {
        newProgress.push({
          playerId,
          achievementId: achievement.id,
          progress: 0,
          completed: false,
          tier: 0
        });
      }
    }

    if (newProgress.length > 0) {
      await AchievementProgress.insertMany(newProgress);
    }

    // Load into cache
    const allProgress = await AchievementProgress.find({ playerId });
    this.progressCache.set(playerId, allProgress);
    return allProgress;
  }

  // Get player's achievement progress
  async getPlayerProgress(playerId) {
    if (!this.progressCache.has(playerId)) {
      await this.initializePlayerAchievements(playerId);
    }
    return this.progressCache.get(playerId);
  }

  // Update achievement progress
  async updateProgress(playerId, achievementId, newProgress, additionalData = {}) {
    const achievement = getAchievementById(achievementId);
    if (!achievement) return null;

    // Get or create progress entry
    let progress = await AchievementProgress.findOne({ playerId, achievementId });
    if (!progress) {
      progress = new AchievementProgress({
        playerId,
        achievementId,
        progress: 0,
        completed: false,
        tier: 0
      });
    }

    // Skip if already completed (for single achievements)
    if (achievement.type === 'single' && progress.completed) {
      return progress;
    }

    // Update progress
    const previousProgress = progress.progress;
    const previousTier = progress.tier;
    progress.progress = newProgress;

    // Merge additional tracking data
    if (additionalData) {
      progress.data = { ...progress.data, ...additionalData };
    }

    // Check completion based on achievement type
    let unlocked = false;
    let unlockedTier = null;

    if (achievement.type === 'single' || achievement.type === 'special') {
      if (progress.progress >= achievement.requirement && !progress.completed) {
        progress.completed = true;
        progress.completedAt = new Date();
        unlocked = true;
      }
    } else if (achievement.type === 'tiered') {
      // Check which tier we've reached
      for (let i = achievement.tiers.length - 1; i >= 0; i--) {
        const tier = achievement.tiers[i];
        if (progress.progress >= tier.requirement && i + 1 > progress.tier) {
          progress.tier = i + 1;
          unlockedTier = tier;
          unlocked = true;
          
          // Mark as completed if highest tier reached
          if (i === achievement.tiers.length - 1) {
            progress.completed = true;
            progress.completedAt = new Date();
          }
          break;
        }
      }
    }

    // Save progress
    await progress.save();

    // Update cache
    const cachedProgress = this.progressCache.get(playerId) || [];
    const index = cachedProgress.findIndex(p => p.achievementId === achievementId);
    if (index >= 0) {
      cachedProgress[index] = progress;
    } else {
      cachedProgress.push(progress);
    }
    this.progressCache.set(playerId, cachedProgress);

    // Notify player if achievement unlocked
    if (unlocked) {
      this.notifyAchievementUnlocked(playerId, achievement, unlockedTier);
      
      // Award points to player
      const points = unlockedTier ? unlockedTier.points : achievement.points;
      await this.awardAchievementPoints(playerId, points);
    }

    return progress;
  }

  // Batch update for efficiency
  async batchUpdateProgress(updates) {
    const results = [];
    for (const update of updates) {
      const result = await this.updateProgress(
        update.playerId,
        update.achievementId,
        update.progress,
        update.data
      );
      results.push(result);
    }
    return results;
  }

  // Check achievements based on player stats
  async checkStatBasedAchievements(playerId, stats) {
    const updates = [];

    // Kill achievements
    if (stats.kills !== undefined) {
      updates.push({
        playerId,
        achievementId: 'slayer',
        progress: stats.kills
      });

      // First blood
      if (stats.kills === 1) {
        updates.push({
          playerId,
          achievementId: 'firstBlood',
          progress: 1
        });
      }
    }

    // Headshot achievements
    if (stats.headshots !== undefined) {
      updates.push({
        playerId,
        achievementId: 'headshotHunter',
        progress: stats.headshots
      });
    }

    // Building achievements
    if (stats.blocksPlaced !== undefined) {
      updates.push({
        playerId,
        achievementId: 'architect',
        progress: stats.blocksPlaced
      });
    }

    // Gold achievements
    if (stats.gold !== undefined) {
      updates.push({
        playerId,
        achievementId: 'goldCollector',
        progress: stats.gold
      });
    }

    // Kill streak achievements
    if (stats.currentKillStreak !== undefined) {
      const progress = await this.getPlayerProgress(playerId);
      const streakProgress = progress.find(p => p.achievementId === 'killStreak');
      const currentMax = streakProgress?.data?.maxStreak || 0;
      
      if (stats.currentKillStreak > currentMax) {
        updates.push({
          playerId,
          achievementId: 'killStreak',
          progress: stats.currentKillStreak,
          data: { maxStreak: stats.currentKillStreak }
        });
      }
    }

    // Play time achievements (convert seconds to hours)
    if (stats.playTime !== undefined) {
      updates.push({
        playerId,
        achievementId: 'dedicated',
        progress: Math.floor(stats.playTime / 3600)
      });
    }

    // Accuracy achievement
    if (stats.shotsFired >= 20 && stats.shotsHit !== undefined) {
      const accuracy = stats.shotsHit / stats.shotsFired;
      if (accuracy >= 0.8) {
        updates.push({
          playerId,
          achievementId: 'sharpshooter',
          progress: 1,
          data: { accuracy, shotsFired: stats.shotsFired }
        });
      }
    }

    // Batch update all achievements
    if (updates.length > 0) {
      await this.batchUpdateProgress(updates);
    }
  }

  // Award achievement points to player
  async awardAchievementPoints(playerId, points) {
    try {
      const player = await Player.findOne({ username: playerId });
      if (player) {
        if (!player.achievementPoints) player.achievementPoints = 0;
        player.achievementPoints += points;
        await player.save();
      }
    } catch (error) {
      console.error('Error awarding achievement points:', error);
    }
  }

  // Notify player of achievement unlock
  notifyAchievementUnlocked(playerId, achievement, tier = null) {
    const notification = {
      type: 'achievement_unlocked',
      achievement: {
        id: achievement.id,
        name: tier ? tier.name : achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        points: tier ? tier.points : achievement.points,
        tier: tier ? tier.tier : null
      }
    };

    // Send to specific player
    const playerSocket = this.getPlayerSocket(playerId);
    if (playerSocket) {
      playerSocket.emit('achievementUnlocked', notification);
    }

    // Also broadcast to all players for social features
    this.io.emit('playerAchievementUnlocked', {
      playerId,
      ...notification
    });
  }

  // Get player socket (helper method)
  getPlayerSocket(playerId) {
    // Search through all connected sockets to find the player
    const sockets = this.io.sockets.sockets;
    
    for (const [socketId, socket] of sockets) {
      // Check various possible ways the username might be stored
      if (socket.username === playerId || 
          socket.playerId === playerId ||
          socket.data?.username === playerId ||
          socket.data?.playerId === playerId) {
        return socket;
      }
    }
    
    // Also check through gameState if available
    if (global.gameState && global.gameState.players) {
      for (const [socketId, player] of Object.entries(global.gameState.players)) {
        if (player.username === playerId) {
          return this.io.sockets.sockets.get(socketId);
        }
      }
    }
    
    return null;
  }

  // Get achievement summary for player
  async getPlayerAchievementSummary(playerId) {
    const progress = await this.getPlayerProgress(playerId);
    const summary = {
      totalPoints: 0,
      completedCount: 0,
      totalCount: Object.keys(achievements).length,
      categoryProgress: {},
      recentUnlocks: []
    };

    // Calculate points and completion
    for (const prog of progress) {
      const achievement = getAchievementById(prog.achievementId);
      if (!achievement) continue;

      // Initialize category if needed
      if (!summary.categoryProgress[achievement.category]) {
        summary.categoryProgress[achievement.category] = {
          completed: 0,
          total: 0,
          points: 0
        };
      }
      summary.categoryProgress[achievement.category].total++;

      // Count completed achievements
      if (prog.completed) {
        summary.completedCount++;
        summary.categoryProgress[achievement.category].completed++;
      }

      // Calculate points based on tier
      if (achievement.type === 'tiered' && prog.tier > 0) {
        const tierPoints = achievement.tiers[prog.tier - 1].points;
        summary.totalPoints += tierPoints;
        summary.categoryProgress[achievement.category].points += tierPoints;
      } else if (prog.completed && (achievement.type === 'single' || achievement.type === 'special')) {
        summary.totalPoints += achievement.points;
        summary.categoryProgress[achievement.category].points += achievement.points;
      }

      // Add to recent unlocks if completed recently
      if (prog.completedAt && prog.completedAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
        summary.recentUnlocks.push({
          achievementId: prog.achievementId,
          completedAt: prog.completedAt,
          achievement
        });
      }
    }

    // Sort recent unlocks by date
    summary.recentUnlocks.sort((a, b) => b.completedAt - a.completedAt);
    summary.recentUnlocks = summary.recentUnlocks.slice(0, 5); // Keep only 5 most recent

    return summary;
  }
}

module.exports = AchievementManager; 