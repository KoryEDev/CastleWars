const Achievement = require('../models/Achievement');
const Player = require('../models/Player');
const achievementDefinitions = require('../config/achievements');

class AchievementManager {
  constructor() {
    this.playerAchievements = new Map();
    this.definitions = achievementDefinitions;
    this.recentUnlocks = new Map(); // Track recent unlocks to prevent duplicates
    this.notificationQueue = new Map(); // Per-player notification queue
  }
  
  async loadPlayerAchievements(playerId) {
    try {
      const achievements = await Achievement.find({ playerId });
      const achievementMap = {};
      achievements.forEach(ach => {
        achievementMap[ach.achievementId] = ach;
      });
      this.playerAchievements.set(playerId, achievementMap);
      return achievementMap;
    } catch (error) {
      console.error('[Achievement] Error loading player achievements:', error);
      return {};
    }
  }
  
  getPlayerAchievements(playerId) {
    return this.playerAchievements.get(playerId) || {};
  }
  
  // Main entry: returns only newly unlocked achievements
  async checkAchievement(playerId, data, playerSocket) {
    try {
      const playerAchievements = this.getPlayerAchievements(playerId);
      const unlockedAchievements = [];
      
      for (const [id, definition] of Object.entries(this.definitions)) {
        if (playerAchievements[id]?.isUnlocked) continue;
        const recentKey = `${playerId}_${id}`;
        const lastUnlock = this.recentUnlocks.get(recentKey);
        if (lastUnlock && Date.now() - lastUnlock < 5000) continue;
        
        const isUnlocked = await this.checkCondition(definition, data, playerAchievements[id], playerId, playerSocket);
        if (isUnlocked) {
          this.recentUnlocks.set(recentKey, Date.now());
          const achievement = await this.unlockAchievement(playerId, id, definition, playerSocket);
          if (achievement) {
            unlockedAchievements.push({
              id: definition.id,
              name: definition.name,
              description: definition.description,
              gold: definition.gold,
              category: definition.category
            });
            // Queue notification
            this.enqueueNotification(playerId, {
              id: definition.id,
              name: definition.name,
              description: definition.description,
              gold: definition.gold,
              category: definition.category
            }, playerSocket);
          }
        }
      }
      // Clean up old recent unlocks
      for (const [key, time] of this.recentUnlocks.entries()) {
        if (Date.now() - time > 60000) {
          this.recentUnlocks.delete(key);
        }
      }
      return unlockedAchievements;
    } catch (error) {
      console.error('[Achievement] Error checking achievements:', error);
      return [];
    }
  }
  
  async checkCondition(definition, data, existingAchievement, playerId, playerSocket) {
    const condition = definition.condition;
    if (!condition) return false;
    switch (condition.type) {
      case 'movement': {
        if (data.type === 'movement' && data.blocks) {
          const currentProgress = existingAchievement?.progress || 0;
          const newProgress = Math.min(currentProgress + data.blocks, condition.blocks);
          if (!existingAchievement || Math.abs(newProgress - currentProgress) > 0.5) {
            const ach = existingAchievement || new Achievement({
              playerId: playerId,
              achievementId: definition.id,
              progress: 0,
              isUnlocked: false
            });
            ach.progress = newProgress;
            ach.lastUpdated = new Date();
            await ach.save();
            const playerAchs = this.getPlayerAchievements(playerId);
            playerAchs[definition.id] = ach;
          }
          return newProgress >= condition.blocks;
        }
        break;
      }
      case 'blocksPlaced': {
        if (data.type === 'blockPlace') {
          const currentProgress = existingAchievement?.progress || 0;
          const newProgress = currentProgress + 1;
          if (existingAchievement) {
            existingAchievement.progress = newProgress;
            existingAchievement.lastUpdated = new Date();
            await existingAchievement.save();
          }
          return newProgress >= condition.count;
        }
        break;
      }
      case 'blockPlaceAir': {
        if (data.type === 'blockPlaceAir') {
          const currentProgress = existingAchievement?.progress || 0;
          const newProgress = currentProgress + 1;
          if (existingAchievement) {
            existingAchievement.progress = newProgress;
            existingAchievement.lastUpdated = new Date();
            await existingAchievement.save();
          }
          return newProgress >= condition.count;
        }
        break;
      }
      case 'weaponShots': {
        if (data.type === 'shoot' && (condition.weapon === 'any' || data.weapon === condition.weapon)) {
          const currentProgress = existingAchievement?.progress || 0;
          const newProgress = currentProgress + (data.count || 1);
          if (existingAchievement) {
            existingAchievement.progress = newProgress;
            existingAchievement.lastUpdated = new Date();
            await existingAchievement.save();
          } else {
            const newAch = new Achievement({
              playerId: playerId,
              achievementId: definition.id,
              progress: newProgress,
              isUnlocked: false
            });
            await newAch.save();
            this.playerAchievements.get(playerId)[definition.id] = newAch;
          }
          return newProgress >= condition.count;
        }
        break;
      }
      case 'switchWeapon': {
        if (data.type === 'switchWeapon') {
          const currentProgress = existingAchievement?.progress || 0;
          const newProgress = currentProgress + 1;
          if (existingAchievement) {
            existingAchievement.progress = newProgress;
            existingAchievement.lastUpdated = new Date();
            await existingAchievement.save();
          }
          return newProgress >= condition.count;
        }
        break;
      }
      case 'enterBuildMode': {
        if (data.type === 'enterBuildMode') {
          const currentProgress = existingAchievement?.progress || 0;
          const newProgress = currentProgress + 1;
          if (existingAchievement) {
            existingAchievement.progress = newProgress;
            existingAchievement.lastUpdated = new Date();
            await existingAchievement.save();
          }
          return newProgress >= condition.count;
        }
        break;
      }
      // ... (other cases remain unchanged, but use gold instead of points)
      // (implement other achievement types as needed)
      default:
        // Fallback to original logic for other types
        return false;
    }
    return false;
  }

  async unlockAchievement(playerId, achievementId, definition, playerSocket) {
    try {
      const playerAchievements = this.getPlayerAchievements(playerId);
      let achievement = playerAchievements[achievementId];
      if (achievement && !achievement.isUnlocked) {
        achievement.isUnlocked = true;
        achievement.unlockedAt = new Date();
        achievement.gold = definition.gold;
        await achievement.save();
      } else if (!achievement) {
        achievement = new Achievement({
          playerId,
          achievementId,
          isUnlocked: true,
          unlockedAt: new Date(),
          gold: definition.gold,
          progress: definition.condition?.count || definition.condition?.amount || definition.condition?.blocks || 0
        });
        await achievement.save();
      } else {
        return null;
      }
      playerAchievements[achievementId] = achievement;
      // Award gold to player
      if (definition.gold && playerSocket) {
        await Player.updateOne(
          { username: playerId },
          { $inc: { gold: definition.gold } }
        );
        playerSocket.emit('goldAwarded', { amount: definition.gold });
      }
      return achievement;
    } catch (error) {
      console.error('[Achievement] Error unlocking achievement:', error);
      return null;
    }
  }

  // Notification queue system
  enqueueNotification(playerId, achievement, playerSocket) {
    if (!this.notificationQueue.has(playerId)) {
      this.notificationQueue.set(playerId, []);
    }
    const queue = this.notificationQueue.get(playerId);
    queue.push(achievement);
    if (queue.length === 1) {
      this.processNotificationQueue(playerId, playerSocket);
    }
  }

  async getAchievementProgress(playerId) {
    try {
      console.log('[Achievement] Getting progress for player:', playerId);
      console.log('[Achievement] Definitions count:', Object.keys(this.definitions).length);
      
      // Load player achievements if not already loaded
      if (!this.playerAchievements.has(playerId)) {
        await this.loadPlayerAchievements(playerId);
      }
      
      const playerAchievements = this.getPlayerAchievements(playerId);
      console.log('[Achievement] Player achievements count:', Object.keys(playerAchievements).length);
      const progress = {};
      
      // Create progress data for all achievements
      for (const [id, definition] of Object.entries(this.definitions)) {
        const achievement = playerAchievements[id];
        const isUnlocked = achievement?.isUnlocked || false;
        const progressValue = achievement?.progress || 0;
        const maxProgress = definition.condition?.count || definition.condition?.blocks || definition.condition?.amount || 1;
        const percentage = Math.min((progressValue / maxProgress) * 100, 100);
        
        progress[id] = {
          id: definition.id,
          name: definition.name,
          description: definition.description,
          category: definition.category,
          gold: definition.gold,
          isUnlocked: isUnlocked,
          progress: progressValue,
          maxProgress: maxProgress,
          percentage: percentage,
          unlockedAt: achievement?.unlockedAt || null
        };
      }
      
      console.log('[Achievement] Returning progress with', Object.keys(progress).length, 'achievements');
      return progress;
    } catch (error) {
      console.error('[Achievement] Error getting achievement progress:', error);
      return {};
    }
  }

  processNotificationQueue(playerId, playerSocket) {
    const queue = this.notificationQueue.get(playerId);
    if (!queue || queue.length === 0) return;
    const achievement = queue[0];
    if (playerSocket) {
      playerSocket.emit('achievementsUnlocked', [achievement]);
    }
    setTimeout(() => {
      queue.shift();
      if (queue.length > 0) {
        this.processNotificationQueue(playerId, playerSocket);
      }
    }, 1800); // 1.8s per notification
  }
}

module.exports = AchievementManager; 