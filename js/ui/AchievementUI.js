export class AchievementUI {
  constructor(scene) {
    this.scene = scene;
    this.achievements = {};
    this.notifications = [];
    this.menuVisible = false;
    
    this.createUI();
    this.setupSocketHandlers();
  }
  
  createUI() {
    // Create a more subtle achievements button
    this.achievementButton = document.createElement('button');
    this.achievementButton.id = 'achievement-button';
    this.achievementButton.innerHTML = '🏆';
    this.achievementButton.title = 'Achievements (V)';
    this.achievementButton.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.7);
      color: #ffd700;
      border: 2px solid rgba(255, 215, 0, 0.3);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      font-size: 20px;
      cursor: pointer;
      z-index: 1000;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    this.achievementButton.addEventListener('mouseover', () => {
      this.achievementButton.style.background = 'rgba(0, 0, 0, 0.9)';
      this.achievementButton.style.borderColor = 'rgba(255, 215, 0, 0.6)';
      this.achievementButton.style.transform = 'scale(1.1)';
    });
    
    this.achievementButton.addEventListener('mouseout', () => {
      this.achievementButton.style.background = 'rgba(0, 0, 0, 0.7)';
      this.achievementButton.style.borderColor = 'rgba(255, 215, 0, 0.3)';
      this.achievementButton.style.transform = 'scale(1)';
    });
    
    this.achievementButton.addEventListener('click', () => {
      this.showAchievementMenu();
    });
    
    document.body.appendChild(this.achievementButton);
    
    // Create notification container
    this.notificationContainer = document.createElement('div');
    this.notificationContainer.id = 'achievement-notifications';
    this.notificationContainer.style.cssText = `
      position: fixed;
      top: 60px;
      right: 10px;
      z-index: 999;
      pointer-events: none;
    `;
    document.body.appendChild(this.notificationContainer);
    
    // Create achievement menu (hidden by default)
    this.achievementMenu = document.createElement('div');
    this.achievementMenu.id = 'achievement-menu';
    this.achievementMenu.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #ffd700;
      border-radius: 10px;
      padding: 20px;
      max-width: 800px;
      max-height: 600px;
      overflow-y: auto;
      z-index: 2000;
      display: none;
      color: white;
    `;
    
    document.body.appendChild(this.achievementMenu);
  }
  
  setupSocketHandlers() {
    // Listen for achievement unlocks
    this.scene.multiplayer.socket.on('achievementsUnlocked', (achievements) => {
      achievements.forEach(ach => {
        this.showNotification(ach);
      });
    });
    
    // Listen for achievement data
    this.scene.multiplayer.socket.on('achievementData', (data) => {
      if (data.progress) {
        this.updateAchievementData(data.progress);
      }
    });
  }
  
  updateAchievementData(progress) {
    this.achievements = progress;
  }
  
  showNotification(achievement) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.style.cssText = `
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      border: 2px solid #ffd700;
      border-radius: 10px;
      padding: 15px;
      margin-bottom: 10px;
      animation: slideIn 0.5s ease-out;
      min-width: 300px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center;">
        <div style="font-size: 30px; margin-right: 15px;">🏆</div>
        <div>
          <div style="color: #ffd700; font-weight: bold; font-size: 16px;">Achievement Unlocked!</div>
          <div style="color: #fff; font-size: 14px; margin-top: 2px;">${achievement.name || 'Unknown'}</div>
          <div style="color: #ccc; font-size: 12px; margin-top: 2px;">${achievement.description || ''}</div>
          <div style="color: #ffd700; font-size: 12px; margin-top: 4px;">+${achievement.points || 0} points</div>
        </div>
      </div>
    `;
    
    this.notificationContainer.appendChild(notification);
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    if (!document.querySelector('#achievement-animations')) {
      style.id = 'achievement-animations';
      document.head.appendChild(style);
    }
    
    // Remove after 5 seconds
    setTimeout(() => {
      notification.style.animation = 'fadeOut 0.5s ease-out forwards';
      setTimeout(() => notification.remove(), 500);
    }, 5000);
  }
  
  showAchievementMenu() {
    if (this.menuVisible) {
      this.hideAchievementMenu();
      return;
    }
    
    this.menuVisible = true;
    this.achievementMenu.style.display = 'block';
    
    // Request latest achievement data
    this.scene.multiplayer.socket.emit('getAchievementProgress', {});
    
    // Build menu content
    this.achievementMenu.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="color: #ffd700; margin: 0;">Achievements</h2>
        <button id="close-achievements" style="
          background: transparent;
          border: none;
          color: #fff;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
        ">×</button>
      </div>
      <div id="achievement-categories"></div>
    `;
    
    // Add close button handler
    document.getElementById('close-achievements').addEventListener('click', () => {
      this.hideAchievementMenu();
    });
    
    // Populate achievements
    this.populateAchievements();
    
    // Close on ESC or clicking outside
    this.handleMenuClose = (e) => {
      if (e.key === 'Escape' || e.key === 'v' || e.key === 'V') {
        this.hideAchievementMenu();
      }
    };
    
    this.handleOutsideClick = (e) => {
      if (!this.achievementMenu.contains(e.target) && e.target !== this.achievementButton) {
        this.hideAchievementMenu();
      }
    };
    
    document.addEventListener('keydown', this.handleMenuClose);
    document.addEventListener('mousedown', this.handleOutsideClick);
  }
  
  hideAchievementMenu() {
    this.menuVisible = false;
    this.achievementMenu.style.display = 'none';
    
    // Remove event listeners
    if (this.handleMenuClose) {
      document.removeEventListener('keydown', this.handleMenuClose);
    }
    if (this.handleOutsideClick) {
      document.removeEventListener('mousedown', this.handleOutsideClick);
    }
  }
  
  populateAchievements() {
    const categoriesContainer = document.getElementById('achievement-categories');
    if (!categoriesContainer) return;
    
    // Group achievements by category
    const categories = {};
    Object.values(this.achievements).forEach(ach => {
      const category = ach.category || 'other';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(ach);
    });
    
    // Category names and icons
    const categoryInfo = {
      exploration: { name: 'Exploration', icon: '🗺️' },
      weapons: { name: 'Weapons', icon: '🔫' },
      pvp: { name: 'Player vs Player', icon: '⚔️' },
      survival: { name: 'Survival', icon: '💀' },
      economy: { name: 'Economy', icon: '💰' },
      pve: { name: 'PvE Combat', icon: '👾' },
      building: { name: 'Building', icon: '🏗️' }
    };
    
    let html = '';
    
    Object.entries(categories).forEach(([category, achievements]) => {
      const info = categoryInfo[category] || { name: category, icon: '🏆' };
      
      html += `
        <div style="margin-bottom: 30px;">
          <h3 style="color: #ffd700; margin-bottom: 15px;">
            ${info.icon} ${info.name}
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px;">
      `;
      
      achievements.forEach(ach => {
        const isUnlocked = ach.isUnlocked;
        const progress = ach.progress || 0;
        const maxProgress = ach.maxProgress || 0;
        const percentage = ach.percentage || 0;
        
        html += `
          <div style="
            background: ${isUnlocked ? 'rgba(255, 215, 0, 0.1)' : 'rgba(0, 0, 0, 0.5)'};
            border: 1px solid ${isUnlocked ? '#ffd700' : '#444'};
            border-radius: 5px;
            padding: 10px;
            position: relative;
            overflow: hidden;
          ">
            <div style="display: flex; justify-content: space-between; align-items: start;">
              <div style="flex: 1;">
                <div style="font-weight: bold; color: ${isUnlocked ? '#ffd700' : '#999'};">
                  ${ach.name || 'Unknown Achievement'}
                </div>
                <div style="font-size: 12px; color: ${isUnlocked ? '#fff' : '#666'}; margin-top: 4px;">
                  ${ach.description || 'No description'}
                </div>
                ${!isUnlocked && maxProgress > 0 ? `
                  <div style="margin-top: 8px;">
                    <div style="background: rgba(255, 255, 255, 0.1); height: 4px; border-radius: 2px; overflow: hidden;">
                      <div style="background: #ffd700; height: 100%; width: ${percentage}%; transition: width 0.3s ease;"></div>
                    </div>
                    <div style="font-size: 11px; color: #999; margin-top: 2px;">
                      ${progress} / ${maxProgress}
                    </div>
                  </div>
                ` : ''}
              </div>
              <div style="text-align: right; margin-left: 10px;">
                <div style="font-size: 20px;">${isUnlocked ? '🏆' : '🔒'}</div>
                <div style="font-size: 12px; color: #ffd700; margin-top: 4px;">
                  ${ach.points || 0} pts
                </div>
              </div>
            </div>
          </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    });
    
    categoriesContainer.innerHTML = html || '<p style="color: #999; text-align: center;">No achievements yet. Start playing to unlock them!</p>';
  }
  
  destroy() {
    // Clean up UI elements
    if (this.achievementButton) {
      this.achievementButton.remove();
    }
    if (this.notificationContainer) {
      this.notificationContainer.remove();
    }
    if (this.achievementMenu) {
      this.achievementMenu.remove();
    }
    
    // Remove event listeners
    if (this.handleMenuClose) {
      document.removeEventListener('keydown', this.handleMenuClose);
    }
    if (this.handleOutsideClick) {
      document.removeEventListener('mousedown', this.handleOutsideClick);
    }
  }
}

export default AchievementUI; 