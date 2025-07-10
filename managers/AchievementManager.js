const Achievement = require('../models/Achievement');
const achievementDefinitions = require('../config/achievements');

class AchievementManager {
  constructor() {
    this.playerAchievements = new Map();
    this.definitions = achievementDefinitions;
    this.recentUnlocks = new Map(); // Track recent unlocks to prevent duplicates
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
  
  async checkAchievement(playerId, data) {
    try {
      const playerAchievements = this.getPlayerAchievements(playerId);
      const unlockedAchievements = [];
      
      // Check each achievement definition
      for (const [id, definition] of Object.entries(this.definitions)) {
        // Skip if already unlocked
        if (playerAchievements[id]?.isUnlocked) continue;
        
        // Check if we recently unlocked this (prevent duplicates)
        const recentKey = `${playerId}_${id}`;
        const lastUnlock = this.recentUnlocks.get(recentKey);
        if (lastUnlock && Date.now() - lastUnlock < 5000) continue; // 5 second cooldown
        
        // Check if achievement condition is met
        const isUnlocked = await this.checkCondition(definition, data, playerAchievements[id], playerId);
        
        if (isUnlocked) {
          // Mark as recently unlocked
          this.recentUnlocks.set(recentKey, Date.now());
          
          // Create or update achievement
          const achievement = await this.unlockAchievement(playerId, id, definition);
          if (achievement) {
            unlockedAchievements.push({
              id: definition.id,
              name: definition.name,
              description: definition.description,
              points: definition.points,
              category: definition.category
            });
          }
        }
      }
      
      // Clean up old recent unlocks
      for (const [key, time] of this.recentUnlocks.entries()) {
        if (Date.now() - time > 60000) { // Remove after 1 minute
          this.recentUnlocks.delete(key);
        }
      }
      
      return unlockedAchievements;
    } catch (error) {
      console.error('[Achievement] Error checking achievements:', error);
      return [];
    }
  }
  
  async checkCondition(definition, data, existingAchievement, playerId) {
    const condition = definition.condition;
    if (!condition) return false;
    
    switch (condition.type) {
      case 'movement':
        if (data.type === 'movement' && data.distance) {
          const currentProgress = existingAchievement?.progress || 0;
          const newProgress = Math.min(currentProgress + data.distance, condition.distance);
          
          // Update progress in database if changed significantly (avoid spam)
          if (!existingAchievement || Math.abs(newProgress - currentProgress) > 1) {
            const ach = existingAchievement || new Achievement({
              playerId: playerId,
              achievementId: definition.id,
              progress: 0,
              isUnlocked: false
            });
            
            ach.progress = newProgress;
            ach.lastUpdated = new Date();
            await ach.save();
            
            // Update cache
            const playerAchs = this.getPlayerAchievements(playerId);
            playerAchs[definition.id] = ach;
          }
          
          return newProgress >= condition.distance;
        }
        break;
        
      case 'weaponShots':
        if (data.type === 'shoot' && data.weapon === condition.weapon) {
          const currentProgress = existingAchievement?.progress || 0;
          const newProgress = currentProgress + (data.count || 1);
          
          // Update progress in database
          if (existingAchievement) {
            existingAchievement.progress = newProgress;
            existingAchievement.lastUpdated = new Date();
            await existingAchievement.save();
          } else {
            // Create new achievement with progress
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
        
      case 'playerKills':
        if (data.type === 'playerKill') {
          const currentProgress = existingAchievement?.progress || 0;
          const newProgress = currentProgress + 1;
          
          // Update progress in database
          if (existingAchievement) {
            existingAchievement.progress = newProgress;
            existingAchievement.lastUpdated = new Date();
            await existingAchievement.save();
          } else {
            // Create new achievement with progress
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
        
      case 'npcKills':
        if (data.type === 'npcKill') {
          const currentProgress = existingAchievement?.progress || 0;
          const newProgress = currentProgress + 1;
          
          // Update progress in database
          if (existingAchievement) {
            existingAchievement.progress = newProgress;
            existingAchievement.lastUpdated = new Date();
            await existingAchievement.save();
          }
          
          return newProgress >= condition.count;
        }
        break;
        
      case 'deaths':
        if (data.type === 'death') {
          const currentProgress = existingAchievement?.progress || 0;
          const newProgress = currentProgress + 1;
          
          // Update progress in database
          if (existingAchievement) {
            existingAchievement.progress = newProgress;
            existingAchievement.lastUpdated = new Date();
            await existingAchievement.save();
          }
          
          return newProgress >= condition.count;
        }
        break;
        
      case 'goldTotal':
        // Check current gold amount - this works for existing gold too
        if ((data.type === 'goldUpdate' || data.type === 'playerJoin') && data.currentGold !== undefined) {
          return data.currentGold >= condition.amount;
        }
        break;
        
      case 'blocksPlaced':
        if (data.type === 'blockPlace') {
          const currentProgress = existingAchievement?.progress || 0;
          const newProgress = currentProgress + 1;
          
          // Update progress in database
          if (existingAchievement) {
            existingAchievement.progress = newProgress;
            existingAchievement.lastUpdated = new Date();
            await existingAchievement.save();
          }
          
          return newProgress >= condition.count;
        }
        break;
    }
    
    return false;
  }
  
  async unlockAchievement(playerId, achievementId, definition) {
    try {
      const playerAchievements = this.getPlayerAchievements(playerId);
      
      // Check if already exists
      let achievement = playerAchievements[achievementId];
      
      if (achievement && !achievement.isUnlocked) {
        // Update existing achievement
        achievement.isUnlocked = true;
        achievement.unlockedAt = new Date();
        achievement.points = definition.points;
        await achievement.save();
      } else if (!achievement) {
        // Create new achievement
        achievement = new Achievement({
          playerId,
          achievementId,
          isUnlocked: true,
          unlockedAt: new Date(),
          points: definition.points,
          progress: definition.condition?.count || definition.condition?.amount || definition.condition?.distance || 0
        });
        await achievement.save();
      } else {
        // Already unlocked, skip
        return null;
      }
      
      // Update cache
      playerAchievements[achievementId] = achievement;
      
      return achievement;
    } catch (error) {
      console.error('[Achievement] Error unlocking achievement:', error);
      return null;
    }
  }
  
  async getPlayerStats(playerId) {
    try {
      const achievements = this.getPlayerAchievements(playerId);
      const unlocked = Object.values(achievements).filter(a => a.isUnlocked);
      const totalPoints = unlocked.reduce((sum, a) => sum + (a.points || 0), 0);
      
      // Group by category
      const byCategory = {};
      for (const [id, definition] of Object.entries(this.definitions)) {
        const category = definition.category || 'other';
        if (!byCategory[category]) {
          byCategory[category] = {
            total: 0,
            unlocked: 0,
            points: 0
          };
        }
        byCategory[category].total++;
        
        if (achievements[id]?.isUnlocked) {
          byCategory[category].unlocked++;
          byCategory[category].points += definition.points || 0;
        }
      }
      
      return {
        totalUnlocked: unlocked.length,
        totalAchievements: Object.keys(this.definitions).length,
        totalPoints,
        byCategory,
        achievements
      };
    } catch (error) {
      console.error('[Achievement] Error getting player stats:', error);
      return null;
    }
  }
  
  // Get achievement progress for UI
  async getAchievementProgress(playerId) {
    try {
      const playerAchievements = this.getPlayerAchievements(playerId);
      const progress = {};
      
      for (const [id, definition] of Object.entries(this.definitions)) {
        const achievement = playerAchievements[id];
        const condition = definition.condition;
        
        progress[id] = {
          id: definition.id,
          name: definition.name,
          description: definition.description,
          category: definition.category,
          points: definition.points,
          isUnlocked: achievement?.isUnlocked || false,
          unlockedAt: achievement?.unlockedAt,
          progress: achievement?.progress || 0,
          maxProgress: condition?.count || condition?.amount || condition?.distance || 0,
          percentage: 0
        };
        
        // Calculate percentage
        if (progress[id].maxProgress > 0) {
          progress[id].percentage = Math.min(100, Math.round((progress[id].progress / progress[id].maxProgress) * 100));
        }
      }
      
      return progress;
    } catch (error) {
      console.error('[Achievement] Error getting achievement progress:', error);
      return {};
    }
  }
}

module.exports = AchievementManager; 