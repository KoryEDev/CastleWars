export class AchievementUI {
  constructor(scene) {
    this.scene = scene;
    this.achievements = {};
    this.notifications = [];
    this.menuVisible = false;
    this.selectedCategory = 'all';
    this.hasLoadedInitialData = false;
    this.unlockQueue = []; // Queue for achievements unlocked before initial data is loaded
    
    this.createUI();
    this.setupSocketHandlers();
    
    // Request initial achievement data immediately to avoid race conditions
    if (this.scene.multiplayer && this.scene.multiplayer.socket) {
      this.scene.multiplayer.socket.emit('getAchievementProgress', {});
    } else {
      // Fallback if socket isn't ready, listen for a custom event
      this.scene.events.once('socketReady', () => {
        if (this.scene.multiplayer && this.scene.multiplayer.socket) {
          this.scene.multiplayer.socket.emit('getAchievementProgress', {});
        }
      });
    }
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
    
    // Add mobile touch support
    this.achievementButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.achievementButton.style.background = 'rgba(0, 0, 0, 0.9)';
      this.achievementButton.style.borderColor = 'rgba(255, 215, 0, 0.6)';
      this.achievementButton.style.transform = 'scale(1.1)';
    });
    
    this.achievementButton.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.achievementButton.style.background = 'rgba(0, 0, 0, 0.7)';
      this.achievementButton.style.borderColor = 'rgba(255, 215, 0, 0.3)';
      this.achievementButton.style.transform = 'scale(1)';
      this.showAchievementMenu();
    });
    
    document.body.appendChild(this.achievementButton);

    // Reposition button on desktop to avoid overlap with ping; hide on mobile
    if (this.scene.sys.game.device.os.desktop) {
      this.achievementButton.style.top = '60px';
    } else {
      this.achievementButton.style.display = 'none';
    }
    
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
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 2px solid #0f4c75;
      border-radius: 20px;
      padding: 30px;
      width: 90%;
      max-width: 1000px;
      height: 80vh;
      max-height: 700px;
      z-index: 10001;
      display: none;
      color: white;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
    `;
    
    // Add custom scrollbar styles
    const scrollbarStyle = document.createElement('style');
    scrollbarStyle.textContent = `
      #achievement-menu *::-webkit-scrollbar {
        width: 8px;
      }
      #achievement-menu *::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
      }
      #achievement-menu *::-webkit-scrollbar-thumb {
        background: #0f4c75;
        border-radius: 4px;
      }
      #achievement-menu *::-webkit-scrollbar-thumb:hover {
        background: #1e5f8e;
      }
      
      /* Mobile scrolling support */
      #achievement-scroll-container {
        -webkit-overflow-scrolling: touch;
        touch-action: pan-y;
      }
      
      .achievement-card {
        transition: all 0.3s ease;
      }
      
      .achievement-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
      }
      
      .category-tab {
        transition: all 0.3s ease;
      }
      
      .category-tab:hover:not(.active) {
        background: rgba(255, 255, 255, 0.1);
      }
      
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
      
      @keyframes fadeOut {
        from {
          opacity: 1;
        }
        to {
          opacity: 0;
        }
      }
      
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
      
      .achievement-unlocked {
        animation: pulse 0.5s ease-out;
      }
      
      /* Mobile-specific styles */
      @media (max-width: 768px) {
        #achievement-menu {
          padding: 20px !important;
          width: 95% !important;
          height: 90vh !important;
        }
        
        #achievement-grid {
          grid-template-columns: 1fr !important;
          gap: 15px !important;
        }
        
        .achievement-card {
          padding: 15px !important;
        }
        
        .category-tab {
          padding: 8px 16px !important;
          font-size: 13px !important;
        }
      }
    `;
    document.head.appendChild(scrollbarStyle);
    
    document.body.appendChild(this.achievementMenu);
    
    // Add keyboard handlers
    document.addEventListener('keydown', (e) => {
      if (e.key === 'v' || e.key === 'V') {
        if (!this.scene.commandPromptOpen) {
          e.preventDefault();
          this.showAchievementMenu();
        }
      } else if (e.key === 'Escape' && this.menuVisible) {
        this.hideAchievementMenu();
      }
    });
    
    // Click outside to close
    document.addEventListener('mousedown', (e) => {
      if (this.menuVisible && !this.achievementMenu.contains(e.target) && e.target !== this.achievementButton) {
        this.hideAchievementMenu();
      }
    });
  }
  
  setupSocketHandlers() {
    // Listen for achievement unlocks
    this.scene.multiplayer.socket.on('achievementsUnlocked', (achievements) => {
      if (!this.hasLoadedInitialData) {
        // If initial data hasn't been loaded, queue these unlocks
        this.unlockQueue.push(...achievements);
        return;
      }
      
      // Only show notifications for truly new achievements
      achievements.forEach(ach => {
        // Check if we already have this achievement unlocked
        const existingAch = this.achievements[ach.id];
        if (!existingAch || !existingAch.isUnlocked) {
          this.showNotification(ach);
        }
      });
      
      // Request updated achievement data to refresh the menu
      this.scene.multiplayer.socket.emit('getAchievementProgress', {});
    });
    
    // Listen for achievement data
    this.scene.multiplayer.socket.on('achievementData', (data) => {
      if (data.progress) {
        this.updateAchievementData(data.progress);
        
        // Mark that we've loaded initial data
        if (!this.hasLoadedInitialData) {
          this.hasLoadedInitialData = true;
          // Process any queued unlocks
          this.processUnlockQueue();
        }
        
        // If the menu is visible, update the display
        if (this.menuVisible) {
          // Rebuild the menu to update stats
          this.buildMenuContent();
          // Reapply tab handlers
          this.setupTabHandlers();
          // Update the achievement cards
          this.populateAchievements();
        }
      }
    });
  }
  
  processUnlockQueue() {
    if (this.unlockQueue.length > 0) {
      this.unlockQueue.forEach(ach => {
        const existingAch = this.achievements[ach.id];
        if (!existingAch || !existingAch.isUnlocked) {
          this.showNotification(ach);
        }
      });
      // Clear the queue
      this.unlockQueue = [];
    }
  }

  updateAchievementData(progress) {
    console.log('[AchievementUI] Received achievement data:', progress);
    this.achievements = progress;
  }
  
  showNotification(achievement) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.style.cssText = `
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 2px solid #ffd700;
      border-radius: 15px;
      padding: 20px;
      margin-bottom: 10px;
      animation: slideIn 0.5s ease-out;
      min-width: 350px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(10px);
      pointer-events: auto;
    `;
    
    const categoryIcons = {
      exploration: '🗺️',
      weapons: '🔫',
      pvp: '⚔️',
      survival: '💀',
      economy: '💰',
      pve: '👾',
      building: '🏗️'
    };
    
    const icon = categoryIcons[achievement.category] || '🏆';
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center;">
        <div style="
          font-size: 40px; 
          margin-right: 20px;
          text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
          animation: pulse 0.5s ease-out;
        ">${icon}</div>
        <div style="flex: 1;">
          <div style="color: #ffd700; font-weight: bold; font-size: 18px; text-shadow: 0 0 10px rgba(255, 215, 0, 0.3);">
            Achievement Unlocked!
          </div>
          <div style="color: #fff; font-size: 16px; margin-top: 4px; font-weight: 500;">
            ${achievement.name || 'Unknown'}
          </div>
          <div style="color: #b0b0b0; font-size: 14px; margin-top: 2px;">
            ${achievement.description || ''}
          </div>
        </div>
        <div style="text-align: center; margin-left: 20px;">
          <div style="font-size: 24px;">🏆</div>
          <div style="color: #ffd700; font-size: 16px; font-weight: bold;">
            +${achievement.gold || 0} gold
          </div>
        </div>
      </div>
    `;
    
    this.notificationContainer.appendChild(notification);
    
    // Play a sound effect if available
    if (this.scene.sound && this.scene.sound.play) {
      // this.scene.sound.play('achievement', { volume: 0.5 });
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
    
    // Hide mobile controls to prevent overlap
    const mobileUI = document.getElementById('mobile-ui');
    if (mobileUI) {
      mobileUI.style.display = 'none';
    }
    
    this.menuVisible = true;
    this.achievementMenu.style.display = 'block';
    
    // Request latest achievement data
    this.scene.multiplayer.socket.emit('getAchievementProgress', {});
    
    // Build menu content
    this.buildMenuContent();
    
    // Add tab click handlers after building content
    this.setupTabHandlers();
    
    // Populate achievements immediately if we have data
    if (this.hasLoadedInitialData) {
      this.populateAchievements();
    }
  }
  
  buildMenuContent() {
    // Calculate stats
    let totalGold = 0;
    let unlockedCount = 0;
    let totalCount = Object.keys(this.achievements).length;
    
    Object.values(this.achievements).forEach(ach => {
      if (ach.isUnlocked) {
        totalGold += ach.gold || 0;
        unlockedCount++;
      }
    });
    
    this.achievementMenu.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div>
            <h1 style="color: #ffd700; margin: 0; font-size: 36px; text-shadow: 0 0 20px rgba(255, 215, 0, 0.3);">
              🏆 Achievements
            </h1>
            <p style="color: #b0b0b0; margin: 5px 0 0 0; font-size: 16px;">
              ${unlockedCount} / ${totalCount} unlocked • ${totalGold} gold earned
            </p>
          </div>
          <button id="close-achievements" style="
            background: transparent;
            border: none;
            color: #fff;
            font-size: 32px;
            cursor: pointer;
            padding: 0;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.3s ease;
          " onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">×</button>
        </div>
        
        <!-- Category Tabs -->
        <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
          ${this.createCategoryTabs()}
        </div>
        
        <!-- Achievement Grid -->
        <div id="achievement-scroll-container" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding-right: 10px; overscroll-behavior: contain;">
          <div id="achievement-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; padding-bottom: 20px;">
            ${this.createAchievementCards()}
          </div>
        </div>
      </div>
    `;
    
    // Add close button handler
    const closeBtn = document.getElementById('close-achievements');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.hideAchievementMenu();
      });
      
      // Add mobile touch support for close button
      closeBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        closeBtn.style.background = 'rgba(255,255,255,0.2)';
      });
      
      closeBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        closeBtn.style.background = 'transparent';
        this.hideAchievementMenu();
      });
    }
    
    // Add tab click handlers
    this.populateAchievements();
  }
  
  createCategoryTabs() {
    const categories = {
      all: { name: 'All', icon: '🏆' },
      tutorial: { name: 'Tutorial', icon: '📚' },
      completed: { name: 'Completed', icon: '✅' },
      exploration: { name: 'Exploration', icon: '🗺️' },
      weapons: { name: 'Weapons', icon: '🔫' },
      pvp: { name: 'PvP', icon: '⚔️' },
      survival: { name: 'Survival', icon: '💀' },
      economy: { name: 'Economy', icon: '💰' },
      pve: { name: 'PvE', icon: '👾' },
      building: { name: 'Building', icon: '🏗️' }
    };
    
    return Object.entries(categories).map(([key, info]) => {
      const isActive = this.selectedCategory === key;
      return `
        <button class="category-tab ${isActive ? 'active' : ''}" data-category="${key}" style="
          background: ${isActive ? '#0f4c75' : 'rgba(255, 255, 255, 0.05)'};
          border: 1px solid ${isActive ? '#1e5f8e' : 'rgba(255, 255, 255, 0.1)'};
          color: ${isActive ? '#ffd700' : '#fff'};
          padding: 10px 20px;
          border-radius: 25px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          <span style="font-size: 18px;">${info.icon}</span>
          ${info.name}
        </button>
      `;
    }).join('');
  }
  
  createAchievementCards() {
    const categoryIcons = {
      tutorial: '📚',
      exploration: '🗺️',
      weapons: '🔫',
      pvp: '⚔️',
      survival: '💀',
      economy: '💰',
      pve: '👾',
      building: '🏗️'
    };
    
    let cards = '';
    
    Object.values(this.achievements).forEach(ach => {
      // Filter based on selected category
      if (this.selectedCategory === 'completed') {
        if (!ach.isUnlocked) return;
      } else if (this.selectedCategory === 'tutorial') {
        if (ach.category !== 'tutorial') return;
      } else if (this.selectedCategory !== 'all') {
        if (ach.category !== this.selectedCategory) return;
      }
      
      const isUnlocked = ach.isUnlocked;
      const icon = categoryIcons[ach.category] || '🏆';
      const progress = Math.floor(ach.progress || 0);
      const maxProgress = ach.maxProgress || 0;
      const percentage = ach.percentage || 0;
      
      cards += `
        <div class="achievement-card ${isUnlocked ? 'achievement-unlocked' : ''}" style="
          background: ${isUnlocked 
            ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 215, 0, 0.05) 100%)' 
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)'};
          border: 2px solid ${isUnlocked ? '#ffd700' : 'rgba(255, 255, 255, 0.2)'};
          border-radius: 15px;
          padding: 20px;
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(5px);
        ">
          <!-- Background Pattern -->
          <div style="
            position: absolute;
            top: -50%;
            right: -20%;
            width: 200px;
            height: 200px;
            background: ${isUnlocked ? '#ffd700' : '#666'};
            opacity: 0.05;
            border-radius: 50%;
            pointer-events: none;
          "></div>
          
          <div style="position: relative; z-index: 1;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 15px;">
                <div style="
                  font-size: 40px; 
                  filter: 
                  opacity: ${isUnlocked ? '1' : '0.4'};
                ">${icon}</div>
                <div>
                  <div style="
                    font-weight: bold; 
                    font-size: 18px;
                    color: ${isUnlocked ? '#ffd700' : '#999'};
                    margin-bottom: 4px;
                  ">
                    ${ach.name || 'Unknown Achievement'}
                  </div>
                  <div style="
                    font-size: 14px; 
                    color: ${isUnlocked ? '#fff' : '#666'};
                  ">
                    ${ach.description || 'No description'}
                  </div>
                </div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 24px;">${isUnlocked ? '🏆' : '🔒'}</div>
                <div style="
                  font-size: 14px; 
                  color: ${isUnlocked ? '#ffd700' : '#666'};
                  font-weight: bold;
                  margin-top: 4px;
                ">
                  ${ach.gold || 0} gold
                </div>
              </div>
            </div>
            
            ${!isUnlocked ? `
              <div style="margin-top: 15px;">
                <div style="
                  display: flex; 
                  justify-content: space-between; 
                  font-size: 12px; 
                  color: #999; 
                  margin-bottom: 5px;
                ">
                  <span>Progress</span>
                  <span>${progress} / ${maxProgress}</span>
                </div>
                <div style="
                  background: rgba(255, 255, 255, 0.1); 
                  height: 8px; 
                  border-radius: 4px; 
                  overflow: hidden;
                  position: relative;
                ">
                  <div style="
                    background: linear-gradient(90deg, #ffd700 0%, #ffed4e 100%); 
                    height: 100%; 
                    width: ${percentage}%; 
                    transition: width 0.5s ease;
                    box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
                  "></div>
                </div>
              </div>
            ` : ''}
            
            ${isUnlocked && ach.unlockedAt ? `
              <div style="
                margin-top: 10px;
                font-size: 12px;
                color: #888;
                text-align: right;
              ">
                Unlocked ${new Date(ach.unlockedAt).toLocaleDateString()}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });
    
    return cards || '<p style="color: #999; text-align: center; grid-column: 1 / -1;">No achievements in this category yet.</p>';
  }
  
  hideAchievementMenu() {
    this.menuVisible = false;
    this.achievementMenu.style.display = 'none';
    
    // Restore mobile controls
    const mobileUI = document.getElementById('mobile-ui');
    if (mobileUI) {
      mobileUI.style.display = 'block';
    }
  }
  
  populateAchievements() {
    const grid = document.getElementById('achievement-grid');
    if (grid) {
      grid.innerHTML = this.createAchievementCards();
    }
  }
  
  setupTabHandlers() {
    // Add click handlers for category tabs
    const tabs = document.querySelectorAll('.category-tab');
    tabs.forEach(tab => {
      // Remove existing event listeners by cloning
      const newTab = tab.cloneNode(true);
      tab.parentNode.replaceChild(newTab, tab);
      
      const handleTabClick = () => {
        // Re-query all tabs to get current DOM elements
        const allTabs = document.querySelectorAll('.category-tab');
        
        // Update visual state for all tabs
        allTabs.forEach(t => {
          t.classList.remove('active');
          // Reset inline styles
          if (t.dataset.category === newTab.dataset.category) {
            t.style.background = '#0f4c75';
            t.style.borderColor = '#1e5f8e';
            t.style.color = '#ffd700';
            t.classList.add('active');
          } else {
            t.style.background = 'rgba(255, 255, 255, 0.05)';
            t.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            t.style.color = '#fff';
          }
        });
        
        // Update selected category
        this.selectedCategory = newTab.dataset.category;
        
        // Re-populate achievements with new filter
        this.populateAchievements();
      };
      
      newTab.addEventListener('click', handleTabClick);
      
      // Add mobile touch support for tabs
      newTab.addEventListener('touchstart', (e) => {
        e.preventDefault();
        newTab.style.transform = 'scale(0.95)';
      });
      
      newTab.addEventListener('touchend', (e) => {
        e.preventDefault();
        newTab.style.transform = '';
        handleTabClick();
      });
    });
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
  }
}

export default AchievementUI; 