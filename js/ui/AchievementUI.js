export class AchievementUI {
  constructor(scene) {
    this.scene = scene;
    this.notifications = [];
    this.isShowingNotification = false;
    this.achievementData = null;
    this.achievementSummary = null;
    
    // Achievement notification style
    this.notificationStyle = {
      fontSize: '18px',
      fontFamily: 'Arial Black',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center'
    };
    
    // Create achievement notification container
    this.createNotificationContainer();
    
    // Listen for achievement events
    if (this.scene.multiplayer && this.scene.multiplayer.socket) {
      this.setupSocketListeners();
    }
  }
  
  createNotificationContainer() {
    // Create a container for achievement notifications (top-right corner)
    const x = this.scene.cameras.main.width - 20;
    const y = 100;
    
    this.notificationContainer = this.scene.add.container(x, y);
    this.notificationContainer.setScrollFactor(0);
    this.notificationContainer.setDepth(1000);
  }
  
  setupSocketListeners() {
    const socket = this.scene.multiplayer.socket;
    
    // Listen for achievement unlocked
    socket.on('achievementUnlocked', (data) => {
      this.showAchievementNotification(data.achievement);
    });
    
    // Listen for achievement data
    socket.on('achievementData', (data) => {
      this.achievementData = data.progress;
      this.achievementSummary = data.summary;
      
      // Update UI if achievement menu is open
      if (this.achievementMenu && this.achievementMenu.visible) {
        this.updateAchievementMenu();
      }
    });
    
    // Listen for other players' achievements (social feature)
    socket.on('playerAchievementUnlocked', (data) => {
      if (data.playerId !== this.scene.username) {
        this.showSocialAchievementNotification(data.playerId, data.achievement);
      }
    });
  }
  
  showAchievementNotification(achievement) {
    // Queue the notification
    this.notifications.push({
      type: 'personal',
      achievement
    });
    
    // Process queue if not already showing
    if (!this.isShowingNotification) {
      this.processNotificationQueue();
    }
  }
  
  showSocialAchievementNotification(playerId, achievement) {
    // Only show social notifications for significant achievements
    if (achievement.points >= 50 || achievement.tier >= 3) {
      this.notifications.push({
        type: 'social',
        playerId,
        achievement
      });
      
      if (!this.isShowingNotification) {
        this.processNotificationQueue();
      }
    }
  }
  
  processNotificationQueue() {
    if (this.notifications.length === 0) {
      this.isShowingNotification = false;
      return;
    }
    
    this.isShowingNotification = true;
    const notification = this.notifications.shift();
    
    // Clear previous notification
    this.notificationContainer.removeAll(true);
    
    // Create achievement popup
    const width = 350;
    const height = 120;
    
    // Background with gradient
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x2a2a2a, 0.95);
    bg.fillRoundedRect(-width, -height/2, width, height, 10);
    
    // Add golden border for personal achievements
    if (notification.type === 'personal') {
      bg.lineStyle(3, 0xffd700, 1);
      bg.strokeRoundedRect(-width, -height/2, width, height, 10);
    }
    
    // Achievement icon background
    const iconBg = this.scene.add.graphics();
    iconBg.fillStyle(0x444444, 1);
    iconBg.fillCircle(-width + 60, 0, 40);
    
    // Achievement icon (emoji)
    const icon = this.scene.add.text(-width + 60, 0, notification.achievement.icon, {
      fontSize: '32px',
      fontFamily: 'Arial'
    });
    icon.setOrigin(0.5);
    
    // Title
    const title = notification.type === 'personal' ? 'Achievement Unlocked!' : `${notification.playerId} unlocked:`;
    const titleText = this.scene.add.text(-width + 120, -height/2 + 20, title, {
      ...this.notificationStyle,
      fontSize: '14px',
      color: notification.type === 'personal' ? '#ffd700' : '#aaaaaa'
    });
    
    // Achievement name
    const nameText = this.scene.add.text(-width + 120, -height/2 + 45, notification.achievement.name, {
      ...this.notificationStyle,
      fontSize: '20px',
      color: '#ffffff'
    });
    
    // Achievement description
    const descText = this.scene.add.text(-width + 120, -height/2 + 75, notification.achievement.description, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#cccccc',
      wordWrap: { width: width - 140 }
    });
    
    // Points
    const pointsText = this.scene.add.text(-30, 0, `+${notification.achievement.points}`, {
      ...this.notificationStyle,
      fontSize: '24px',
      color: '#ffd700'
    });
    pointsText.setOrigin(0.5);
    
    // Add all elements to container
    this.notificationContainer.add([bg, iconBg, icon, titleText, nameText, descText, pointsText]);
    
    // Animate in
    this.scene.tweens.add({
      targets: this.notificationContainer,
      x: this.scene.cameras.main.width - 20,
      duration: 300,
      ease: 'Power2'
    });
    
    // Play sound effect
    if (this.scene.sound && notification.type === 'personal') {
      // this.scene.sound.play('achievement', { volume: 0.5 });
    }
    
    // Auto-hide after delay
    this.scene.time.delayedCall(4000, () => {
      this.scene.tweens.add({
        targets: this.notificationContainer,
        x: this.scene.cameras.main.width + 400,
        duration: 300,
        ease: 'Power2',
        onComplete: () => {
          this.processNotificationQueue();
        }
      });
    });
  }
  
  showAchievementMenu() {
    // Request latest achievement data
    if (this.scene.multiplayer && this.scene.multiplayer.socket) {
      this.scene.multiplayer.socket.emit('getAchievements');
    }
    
    // Create fullscreen overlay
    const overlay = document.createElement('div');
    overlay.id = 'achievement-menu-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '10000';
    overlay.style.backdropFilter = 'blur(5px)';
    
    // Create menu container
    const menu = document.createElement('div');
    menu.style.backgroundColor = '#1a1a1a';
    menu.style.border = '2px solid #ffd700';
    menu.style.borderRadius = '15px';
    menu.style.padding = '30px';
    menu.style.maxWidth = '900px';
    menu.style.maxHeight = '80vh';
    menu.style.overflow = 'hidden';
    menu.style.display = 'flex';
    menu.style.flexDirection = 'column';
    menu.style.boxShadow = '0 0 30px rgba(255, 215, 0, 0.3)';
    
    // Header
    const header = document.createElement('div');
    header.style.marginBottom = '20px';
    header.style.textAlign = 'center';
    
    const title = document.createElement('h2');
    title.textContent = 'Achievements';
    title.style.color = '#ffd700';
    title.style.fontSize = '32px';
    title.style.margin = '0 0 10px 0';
    title.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
    header.appendChild(title);
    
    // Summary stats
    if (this.achievementSummary) {
      const stats = document.createElement('div');
      stats.style.color = '#ffffff';
      stats.style.fontSize = '16px';
      stats.innerHTML = `
        <span style="margin-right: 20px;">🏆 Total Points: <span style="color: #ffd700; font-weight: bold;">${this.achievementSummary.totalPoints}</span></span>
        <span>📊 Completed: <span style="color: #4ade80; font-weight: bold;">${this.achievementSummary.completedCount}/${this.achievementSummary.totalCount}</span></span>
      `;
      header.appendChild(stats);
    }
    
    menu.appendChild(header);
    
    // Categories tabs
    const tabs = document.createElement('div');
    tabs.style.display = 'flex';
    tabs.style.gap = '10px';
    tabs.style.marginBottom = '20px';
    tabs.style.borderBottom = '2px solid #333';
    tabs.style.paddingBottom = '10px';
    
    const categories = ['all', 'combat', 'building', 'economy', 'survival', 'special'];
    let activeCategory = 'all';
    
    categories.forEach(cat => {
      const tab = document.createElement('button');
      tab.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
      tab.style.background = 'none';
      tab.style.border = 'none';
      tab.style.color = cat === activeCategory ? '#ffd700' : '#888';
      tab.style.fontSize = '16px';
      tab.style.cursor = 'pointer';
      tab.style.padding = '5px 15px';
      tab.style.transition = 'color 0.3s';
      
      tab.onclick = () => {
        activeCategory = cat;
        this.updateAchievementList(achievementsList, activeCategory);
        
        // Update tab colors
        tabs.querySelectorAll('button').forEach(btn => {
          btn.style.color = btn.textContent.toLowerCase() === cat ? '#ffd700' : '#888';
        });
      };
      
      tabs.appendChild(tab);
    });
    
    menu.appendChild(tabs);
    
    // Achievements list container
    const achievementsList = document.createElement('div');
    achievementsList.style.overflowY = 'auto';
    achievementsList.style.flex = '1';
    achievementsList.style.paddingRight = '10px';
    menu.appendChild(achievementsList);
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.marginTop = '20px';
    closeBtn.style.padding = '10px 30px';
    closeBtn.style.backgroundColor = '#ffd700';
    closeBtn.style.color = '#000';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '5px';
    closeBtn.style.fontSize = '16px';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.alignSelf = 'center';
    
    closeBtn.onclick = () => {
      document.body.removeChild(overlay);
      this.achievementMenu = null;
    };
    
    menu.appendChild(closeBtn);
    overlay.appendChild(menu);
    document.body.appendChild(overlay);
    
    // Store reference
    this.achievementMenu = overlay;
    
    // Populate achievements
    if (this.achievementData) {
      this.updateAchievementList(achievementsList, activeCategory);
    }
    
    // Close on escape
    const handleEscape = (e) => {
      if (e.key === 'Escape' && this.achievementMenu) {
        document.body.removeChild(this.achievementMenu);
        this.achievementMenu = null;
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }
  
  updateAchievementList(container, category) {
    container.innerHTML = '';
    
    if (!this.achievementData) return;
    
    // Achievement definitions (client-side copy)
    const achievements = this.getAchievementDefinitions();
    
    // Filter by category
    const filteredAchievements = Object.values(achievements).filter(ach => 
      category === 'all' || ach.category === category
    );
    
    // Create achievement items
    filteredAchievements.forEach(achievement => {
      const progress = this.achievementData.find(p => p.achievementId === achievement.id) || {
        progress: 0,
        completed: false,
        tier: 0
      };
      
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.padding = '15px';
      item.style.marginBottom = '10px';
      item.style.backgroundColor = progress.completed ? '#1a3a1a' : '#2a2a2a';
      item.style.border = progress.completed ? '1px solid #4ade80' : '1px solid #444';
      item.style.borderRadius = '10px';
      item.style.transition = 'transform 0.2s';
      
      item.onmouseover = () => item.style.transform = 'scale(1.02)';
      item.onmouseout = () => item.style.transform = 'scale(1)';
      
      // Icon
      const icon = document.createElement('div');
      icon.style.fontSize = '36px';
      icon.style.marginRight = '20px';
      icon.style.filter = progress.completed ? 'none' : 'grayscale(1) opacity(0.5)';
      icon.textContent = achievement.icon;
      item.appendChild(icon);
      
      // Info
      const info = document.createElement('div');
      info.style.flex = '1';
      
      const name = document.createElement('h4');
      name.style.margin = '0 0 5px 0';
      name.style.color = progress.completed ? '#4ade80' : '#ffffff';
      name.textContent = achievement.type === 'tiered' && progress.tier > 0 ? 
        achievement.tiers[progress.tier - 1].name : achievement.name;
      info.appendChild(name);
      
      const desc = document.createElement('p');
      desc.style.margin = '0 0 10px 0';
      desc.style.color = '#aaa';
      desc.style.fontSize = '14px';
      desc.textContent = achievement.description;
      info.appendChild(desc);
      
      // Progress bar
      if (achievement.type === 'tiered') {
        const currentTier = achievement.tiers[progress.tier] || achievement.tiers[0];
        const progressBar = document.createElement('div');
        progressBar.style.width = '100%';
        progressBar.style.height = '8px';
        progressBar.style.backgroundColor = '#444';
        progressBar.style.borderRadius = '4px';
        progressBar.style.overflow = 'hidden';
        
        const fill = document.createElement('div');
        fill.style.height = '100%';
        fill.style.backgroundColor = '#ffd700';
        fill.style.width = `${Math.min((progress.progress / currentTier.requirement) * 100, 100)}%`;
        fill.style.transition = 'width 0.3s';
        progressBar.appendChild(fill);
        
        info.appendChild(progressBar);
        
        const progressText = document.createElement('div');
        progressText.style.fontSize = '12px';
        progressText.style.color = '#888';
        progressText.style.marginTop = '5px';
        progressText.textContent = `${progress.progress} / ${currentTier.requirement}`;
        info.appendChild(progressText);
      }
      
      item.appendChild(info);
      
      // Points
      const points = document.createElement('div');
      points.style.fontSize = '20px';
      points.style.fontWeight = 'bold';
      points.style.color = progress.completed ? '#4ade80' : '#666';
      
      if (achievement.type === 'tiered' && progress.tier > 0) {
        points.textContent = `+${achievement.tiers[progress.tier - 1].points}`;
      } else {
        points.textContent = `+${achievement.points}`;
      }
      
      item.appendChild(points);
      
      container.appendChild(item);
    });
  }
  
  updateAchievementMenu() {
    if (this.achievementMenu) {
      const achievementsList = this.achievementMenu.querySelector('div[style*="overflow"]');
      if (achievementsList) {
        const activeTab = Array.from(this.achievementMenu.querySelectorAll('button'))
          .find(btn => btn.style.color === 'rgb(255, 215, 0)');
        const category = activeTab ? activeTab.textContent.toLowerCase() : 'all';
        this.updateAchievementList(achievementsList, category);
      }
    }
  }
  
  destroy() {
    if (this.notificationContainer) {
      this.notificationContainer.destroy();
    }
    
    if (this.achievementMenu) {
      document.body.removeChild(this.achievementMenu);
      this.achievementMenu = null;
    }
    
    // Remove socket listeners
    if (this.scene.multiplayer && this.scene.multiplayer.socket) {
      const socket = this.scene.multiplayer.socket;
      socket.off('achievementUnlocked');
      socket.off('achievementData');
      socket.off('playerAchievementUnlocked');
    }
  }
  
  getAchievementDefinitions() {
    // Client-side copy of achievement definitions
    return {
      firstBlood: {
        id: 'firstBlood',
        name: 'First Blood',
        description: 'Get your first kill',
        category: 'combat',
        icon: '🗡️',
        requirement: 1,
        points: 10,
        type: 'single'
      },
      
      sharpshooter: {
        id: 'sharpshooter',
        name: 'Sharpshooter',
        description: 'Achieve 80% accuracy in a match',
        category: 'combat',
        icon: '🎯',
        requirement: 0.8,
        points: 25,
        type: 'single'
      },
      
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
        type: 'special'
      },
      
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
      
      survivor: {
        id: 'survivor',
        name: 'Survivor',
        description: 'Survive without dying',
        category: 'survival',
        icon: '🛡️',
        type: 'tiered',
        tiers: [
          { tier: 1, name: 'Lucky', requirement: 5, points: 15 },
          { tier: 2, name: 'Resilient', requirement: 15, points: 30 },
          { tier: 3, name: 'Untouchable', requirement: 30, points: 60 }
        ]
      },
      
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
          { tier: 1, name: 'Regular', requirement: 1, points: 10 },
          { tier: 2, name: 'Dedicated', requirement: 10, points: 25 },
          { tier: 3, name: 'Veteran', requirement: 50, points: 50 },
          { tier: 4, name: 'No Life', requirement: 100, points: 100 }
        ]
      }
    };
  }
} 