export class GameUI {
  constructor(scene) {
    this.scene = scene;
    this.uiWidth = 350; // Width of the UI panel
    
    this.createUI();
    this.setupEventListeners();
  }

  createUI() {
    // Remove any existing UI
    const oldUI = document.getElementById('game-ui-panel');
    if (oldUI) oldUI.remove();
    
    // Create main UI container
    const uiPanel = document.createElement('div');
    uiPanel.id = 'game-ui-panel';
    uiPanel.style.position = 'fixed';
    uiPanel.style.left = '0';
    uiPanel.style.top = '0';
    uiPanel.style.width = this.uiWidth + 'px';
    uiPanel.style.height = '100vh';
    uiPanel.style.background = 'linear-gradient(to right, #1a1a2e 0%, #16213e 80%, #0f3460 100%)';
    uiPanel.style.borderRight = '4px solid #ffe066';
    uiPanel.style.boxShadow = '4px 0 20px rgba(0,0,0,0.8)';
    uiPanel.style.zIndex = '1000';
    uiPanel.style.display = 'flex';
    uiPanel.style.flexDirection = 'column';
    uiPanel.style.fontFamily = 'Arial, sans-serif';
    uiPanel.style.overflow = 'hidden';
    
    // Create sections
    this.createHeader(uiPanel);
    
    // Check if this is PvE mode (port 3001 or pve subdomain)
    const isPvE = window.location.port === '3001' || window.location.hostname.includes('pve.');
    if (isPvE) {
      this.createPvESection(uiPanel);
    }
    
    this.createHealthSection(uiPanel);
    this.createHotbarSection(uiPanel);
    this.createWeaponSection(uiPanel);
    this.createBuildSection(uiPanel);
    this.createStatsSection(uiPanel);
    this.createAchievementButton(uiPanel);
    this.createChatSection(uiPanel);
    // Controls section removed - now in help button
    
    document.body.appendChild(uiPanel);
    this.uiPanel = uiPanel;
    
    // Create help button
    this.createHelpButton();
    
    // Create weapon button
    this.createWeaponButton();
    
    // Adjust game canvas position
    this.adjustGameCanvas();
  }
  
  createHeader(parent) {
    const header = document.createElement('div');
    header.style.padding = '20px';
    header.style.borderBottom = '2px solid #ffe066';
    header.style.background = 'rgba(0,0,0,0.3)';
    
    const title = document.createElement('h1');
    title.textContent = 'CASTLE WARS';
    title.style.color = '#ffe066';
    title.style.fontSize = '28px';
    title.style.margin = '0';
    title.style.textAlign = 'center';
    title.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    title.style.letterSpacing = '3px';
    
    header.appendChild(title);
    parent.appendChild(header);
  }
  
  createPvESection(parent) {
    const section = document.createElement('div');
    section.style.padding = '20px';
    section.style.borderBottom = '2px solid rgba(255,224,102,0.3)';
    section.style.background = 'rgba(78,205,196,0.1)';
    
    const title = document.createElement('h3');
    title.textContent = 'PVE MODE';
    title.style.color = '#4ecdc4';
    title.style.fontSize = '16px';
    title.style.marginBottom = '15px';
    title.style.textAlign = 'center';
    
    // Create PvE stats grid
    const pveGrid = document.createElement('div');
    pveGrid.style.display = 'grid';
    pveGrid.style.gridTemplateColumns = '1fr 1fr';
    pveGrid.style.gap = '10px';
    
    // Wave counter
    const waveDiv = document.createElement('div');
    waveDiv.style.textAlign = 'center';
    waveDiv.style.background = 'rgba(0,0,0,0.4)';
    waveDiv.style.padding = '10px';
    waveDiv.style.borderRadius = '8px';
    waveDiv.style.border = '2px solid #4ecdc4';
    
    const waveLabel = document.createElement('div');
    waveLabel.textContent = 'WAVE';
    waveLabel.style.color = '#4ecdc4';
    waveLabel.style.fontSize = '12px';
    
    const waveValue = document.createElement('div');
    waveValue.id = 'ui-wave-number';
    waveValue.textContent = '0';
    waveValue.style.color = '#fff';
    waveValue.style.fontSize = '24px';
    waveValue.style.fontWeight = 'bold';
    
    waveDiv.appendChild(waveLabel);
    waveDiv.appendChild(waveValue);
    
    // Team lives counter
    const livesDiv = document.createElement('div');
    livesDiv.style.textAlign = 'center';
    livesDiv.style.background = 'rgba(0,0,0,0.4)';
    livesDiv.style.padding = '10px';
    livesDiv.style.borderRadius = '8px';
    livesDiv.style.border = '2px solid #ff6b6b';
    
    const livesLabel = document.createElement('div');
    livesLabel.textContent = 'TEAM LIVES';
    livesLabel.style.color = '#ff6b6b';
    livesLabel.style.fontSize = '12px';
    
    const livesValue = document.createElement('div');
    livesValue.id = 'ui-team-lives';
    livesValue.textContent = '20';
    livesValue.style.color = '#fff';
    livesValue.style.fontSize = '24px';
    livesValue.style.fontWeight = 'bold';
    
    livesDiv.appendChild(livesLabel);
    livesDiv.appendChild(livesValue);
    
    pveGrid.appendChild(waveDiv);
    pveGrid.appendChild(livesDiv);
    
    // Party info
    const partyDiv = document.createElement('div');
    partyDiv.id = 'ui-party-info';
    partyDiv.style.marginTop = '15px';
    partyDiv.style.padding = '10px';
    partyDiv.style.background = 'rgba(0,0,0,0.4)';
    partyDiv.style.borderRadius = '8px';
    partyDiv.style.border = '1px solid rgba(255,224,102,0.3)';
    partyDiv.style.fontSize = '14px';
    partyDiv.style.color = '#ccc';
    partyDiv.style.textAlign = 'center';
    partyDiv.textContent = 'No party - Press P to open party menu';
    
    section.appendChild(title);
    section.appendChild(pveGrid);
    section.appendChild(partyDiv);
    parent.appendChild(section);
  }
  
  createHealthSection(parent) {
    const section = document.createElement('div');
    section.style.padding = '20px';
    section.style.borderBottom = '1px solid rgba(255,224,102,0.3)';
    
    // Player name
    const playerName = document.createElement('div');
    playerName.id = 'ui-player-name';
    playerName.style.color = '#ffe066';
    playerName.style.fontSize = '20px';
    playerName.style.fontWeight = 'bold';
    playerName.style.marginBottom = '10px';
    playerName.style.textTransform = 'capitalize';
    playerName.textContent = this.scene.username || 'Player';
    
    // Health bar container
    const healthContainer = document.createElement('div');
    healthContainer.style.background = 'rgba(0,0,0,0.5)';
    healthContainer.style.border = '2px solid #ffe066';
    healthContainer.style.borderRadius = '10px';
    healthContainer.style.padding = '5px';
    healthContainer.style.position = 'relative';
    
    // Health bar
    const healthBar = document.createElement('div');
    healthBar.id = 'ui-health-bar';
    healthBar.style.width = '100%';
    healthBar.style.height = '25px';
    healthBar.style.background = 'linear-gradient(90deg, #00ff00, #00dd00)';
    healthBar.style.borderRadius = '5px';
    healthBar.style.transition = 'width 0.3s ease';
    
    // Health text
    const healthText = document.createElement('div');
    healthText.id = 'ui-health-text';
    healthText.style.position = 'absolute';
    healthText.style.top = '50%';
    healthText.style.left = '50%';
    healthText.style.transform = 'translate(-50%, -50%)';
    healthText.style.color = '#fff';
    healthText.style.fontSize = '16px';
    healthText.style.fontWeight = 'bold';
    healthText.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    healthText.textContent = '100 / 100';
    
    healthContainer.appendChild(healthBar);
    healthContainer.appendChild(healthText);
    
    // Gold display
    const goldContainer = document.createElement('div');
    goldContainer.style.marginTop = '15px';
    goldContainer.style.background = 'rgba(0,0,0,0.5)';
    goldContainer.style.border = '2px solid #ffd700';
    goldContainer.style.borderRadius = '10px';
    goldContainer.style.padding = '10px';
    goldContainer.style.display = 'flex';
    goldContainer.style.alignItems = 'center';
    goldContainer.style.justifyContent = 'center';
    goldContainer.style.gap = '10px';
    
    const goldIcon = document.createElement('span');
    goldIcon.textContent = '💰';
    goldIcon.style.fontSize = '24px';
    
    const goldText = document.createElement('div');
    goldText.id = 'ui-gold-amount';
    goldText.style.color = '#ffd700';
    goldText.style.fontSize = '20px';
    goldText.style.fontWeight = 'bold';
    goldText.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    goldText.textContent = '0 Gold';
    
    goldContainer.appendChild(goldIcon);
    goldContainer.appendChild(goldText);
    
    section.appendChild(playerName);
    section.appendChild(healthContainer);
    section.appendChild(goldContainer);
    parent.appendChild(section);
    
    this.healthBar = healthBar;
    this.healthText = healthText;
    this.playerNameEl = playerName;
  }
  
  createHotbarSection(parent) {
    const section = document.createElement('div');
    section.id = 'ui-hotbar-section';
    section.style.padding = '20px';
    section.style.borderBottom = '1px solid rgba(255,224,102,0.3)';
    
    const title = document.createElement('h3');
    title.textContent = 'QUICKBAR';
    title.style.color = '#ffe066';
    title.style.fontSize = '16px';
    title.style.marginBottom = '15px';
    
    // Container for hotbar slots
    const hotbarContainer = document.createElement('div');
    hotbarContainer.id = 'ui-hotbar-container';
    hotbarContainer.style.display = 'grid';
    hotbarContainer.style.gridTemplateColumns = 'repeat(5, 1fr)';
    hotbarContainer.style.gap = '10px';
    hotbarContainer.style.maxWidth = '280px';
    
    section.appendChild(title);
    section.appendChild(hotbarContainer);
    parent.appendChild(section);
    
    this.hotbarContainer = hotbarContainer;
  }
  
  createWeaponSection(parent) {
    const section = document.createElement('div');
    section.id = 'ui-weapon-section';
    section.style.padding = '20px';
    section.style.borderBottom = '1px solid rgba(255,224,102,0.3)';
    section.style.display = 'none'; // Hidden by default
    
    const title = document.createElement('h3');
    title.textContent = 'WEAPONS';
    title.style.color = '#ffe066';
    title.style.fontSize = '16px';
    title.style.marginBottom = '15px';
    
    // Container for weapon slots
    const weaponContainer = document.createElement('div');
    weaponContainer.id = 'ui-weapon-container';
    weaponContainer.style.display = 'grid';
    weaponContainer.style.gridTemplateColumns = 'repeat(5, 1fr)';
    weaponContainer.style.gap = '10px';
    weaponContainer.style.maxWidth = '280px';
    
    section.appendChild(title);
    section.appendChild(weaponContainer);
    parent.appendChild(section);
    
    this.weaponSection = section;
    this.weaponContainer = weaponContainer;
  }

  createBuildSection(parent) {
    const section = document.createElement('div');
    section.id = 'ui-build-section';
    section.style.padding = '20px';
    section.style.borderBottom = '1px solid rgba(255,224,102,0.3)';
    section.style.display = 'none'; // Hidden by default
    
    const title = document.createElement('h3');
    title.textContent = 'BUILD MODE';
    title.style.color = '#ffe066';
    title.style.fontSize = '16px';
    title.style.marginBottom = '15px';
    
    // Container for build slots
    const buildContainer = document.createElement('div');
    buildContainer.id = 'ui-build-container';
    buildContainer.style.display = 'grid';
    buildContainer.style.gridTemplateColumns = 'repeat(4, 1fr)';
    buildContainer.style.gridTemplateRows = 'repeat(2, 1fr)';
    buildContainer.style.gap = '10px';
    buildContainer.style.maxWidth = '240px';
    
    section.appendChild(title);
    section.appendChild(buildContainer);
    parent.appendChild(section);
    
    this.buildSection = section;
    this.buildContainer = buildContainer;
  }
  
  createStatsSection(parent) {
    const section = document.createElement('div');
    section.style.padding = '20px';
    section.style.borderBottom = '1px solid rgba(255,224,102,0.3)';
    
    const title = document.createElement('h3');
    title.textContent = 'STATS';
    title.style.color = '#ffe066';
    title.style.fontSize = '16px';
    title.style.marginBottom = '10px';
    
    const statsGrid = document.createElement('div');
    statsGrid.style.display = 'grid';
    statsGrid.style.gridTemplateColumns = '1fr 1fr';
    statsGrid.style.gap = '10px';
    
    // Combat stats
    this.createStat(statsGrid, 'Kills:', '0', 'ui-kills');
    this.createStat(statsGrid, 'Deaths:', '0', 'ui-deaths');
    this.createStat(statsGrid, 'K/D:', '0.00', 'ui-kd');
    this.createStat(statsGrid, 'Streak:', '0', 'ui-streak');
    this.createStat(statsGrid, 'Headshots:', '0', 'ui-headshots');
    
    section.appendChild(title);
    section.appendChild(statsGrid);
    parent.appendChild(section);
  }
  
  createStat(parent, label, value, id) {
    const statDiv = document.createElement('div');
    statDiv.style.display = 'flex';
    statDiv.style.justifyContent = 'space-between';
    statDiv.style.color = '#fff';
    statDiv.style.fontSize = '14px';
    
    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    labelSpan.style.color = '#999';
    
    const valueSpan = document.createElement('span');
    valueSpan.id = id;
    valueSpan.textContent = value;
    valueSpan.style.fontWeight = 'bold';
    
    statDiv.appendChild(labelSpan);
    statDiv.appendChild(valueSpan);
    parent.appendChild(statDiv);
  }
  
  createAchievementButton(parent) {
    const section = document.createElement('div');
    section.style.padding = '20px';
    section.style.borderBottom = '1px solid rgba(255,224,102,0.3)';
    section.style.textAlign = 'center';
    
    const button = document.createElement('button');
    button.textContent = '🏆 Achievements';
    button.style.width = '100%';
    button.style.padding = '12px 20px';
    button.style.background = 'linear-gradient(135deg, #ffe066 0%, #ffcc00 100%)';
    button.style.border = '2px solid #2a2a44';
    button.style.borderRadius = '8px';
    button.style.color = '#2a2a44';
    button.style.fontSize = '16px';
    button.style.fontWeight = 'bold';
    button.style.cursor = 'pointer';
    button.style.transition = 'all 0.3s';
    button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
    
    button.onmouseenter = () => {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 6px 16px rgba(255,224,102,0.6)';
    };
    
    button.onmouseleave = () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
    };
    
    button.onclick = () => {
      if (this.scene && this.scene.achievementUI) {
        this.scene.achievementUI.showAchievementMenu();
      }
    };
    
    section.appendChild(button);
    parent.appendChild(section);
  }
  
  createChatSection(parent) {
    const section = document.createElement('div');
    section.style.flex = '1';
    section.style.padding = '15px'; // Reduced padding
    section.style.paddingBottom = '10px'; // Less bottom padding
    section.style.display = 'flex';
    section.style.flexDirection = 'column';
    section.style.minHeight = '0';
    section.style.maxHeight = 'calc(100vh - 450px)'; // More space for chat
    section.style.overflow = 'hidden';
    
    const title = document.createElement('h3');
    title.textContent = 'CHAT';
    title.style.color = '#ffe066';
    title.style.fontSize = '16px';
    title.style.marginBottom = '10px';
    
    // Chat messages container
    const chatMessages = document.createElement('div');
    chatMessages.id = 'ui-chat-messages';
    chatMessages.style.flex = '1';
    chatMessages.style.background = 'rgba(0,0,0,0.4)';
    chatMessages.style.border = '1px solid rgba(255,224,102,0.3)';
    chatMessages.style.borderRadius = '8px';
    chatMessages.style.padding = '10px';
    chatMessages.style.overflowY = 'auto';
    chatMessages.style.fontSize = '14px';
    chatMessages.style.lineHeight = '1.6';
    chatMessages.style.minHeight = '150px'; // Ensure minimum height for multiple messages
    chatMessages.style.maxHeight = '300px'; // Set a reasonable max height
    
    // Custom scrollbar (only if not already added)
    if (!document.getElementById('ui-chat-scrollbar-styles')) {
      const style = document.createElement('style');
      style.id = 'ui-chat-scrollbar-styles';
      style.textContent = `
        #ui-chat-messages::-webkit-scrollbar {
          width: 8px;
        }
        #ui-chat-messages::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.3);
          border-radius: 4px;
        }
        #ui-chat-messages::-webkit-scrollbar-thumb {
          background: #ffe066;
          border-radius: 4px;
        }
        #ui-chat-messages::-webkit-scrollbar-thumb:hover {
          background: #ffcc00;
        }
      `;
      document.head.appendChild(style);
    }
    
    section.appendChild(title);
    section.appendChild(chatMessages);
    parent.appendChild(section);
    
    this.chatMessages = chatMessages;
  }
  
  createControlsSection(parent) {
    const section = document.createElement('div');
    section.style.padding = '20px';
    section.style.borderTop = '2px solid #ffe066';
    section.style.background = 'rgba(0,0,0,0.3)';
    section.style.flexShrink = '0'; // Prevent controls from shrinking
    section.style.marginTop = 'auto'; // Push controls to bottom
    
    const controls = [
      { key: 'WASD/Arrows', action: 'Move' },
      { key: 'Space/W/Up', action: 'Jump' },
      { key: 'Click', action: 'Shoot' },
      { key: 'R', action: 'Reload' },
      { key: 'E', action: 'Inventory' },
      { key: '1-5', action: 'Select Item' },
      { key: 'Shift', action: 'Build Mode' },
      { key: 'X', action: 'Delete Block' },
      { key: 'T', action: 'Chat' }
    ];
    
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr 2fr';
    grid.style.gap = '8px';
    grid.style.fontSize = '14px';
    
    controls.forEach(control => {
      const key = document.createElement('div');
      key.style.color = '#ffe066';
      key.style.fontWeight = 'bold';
      key.style.backgroundColor = 'rgba(0,0,0,0.4)';
      key.style.padding = '4px 8px';
      key.style.borderRadius = '4px';
      key.style.border = '1px solid rgba(255,224,102,0.3)';
      key.style.textAlign = 'center';
      key.textContent = control.key;
      
      const action = document.createElement('div');
      action.style.color = '#ffffff';
      action.style.padding = '4px';
      action.textContent = control.action;
      
      grid.appendChild(key);
      grid.appendChild(action);
    });
    
    section.appendChild(grid);
    parent.appendChild(section);
  }
  
  adjustGameCanvas() {
    // Don't adjust the game container position - let Phaser handle the viewport
    // The viewport adjustment in GameScene will handle the offset
  }
  
  updateHealth(current, max) {
    const percent = (current / max) * 100;
    this.healthBar.style.width = percent + '%';
    this.healthText.textContent = `${current} / ${max}`;
    
    // Change color based on health
    if (percent > 60) {
      this.healthBar.style.background = 'linear-gradient(90deg, #00ff00, #00dd00)';
    } else if (percent > 30) {
      this.healthBar.style.background = 'linear-gradient(90deg, #ffff00, #ffdd00)';
    } else {
      this.healthBar.style.background = 'linear-gradient(90deg, #ff0000, #dd0000)';
    }
  }
  
  addChatMessage(data) {
    const messageEl = document.createElement('div');
    messageEl.style.marginBottom = '8px';
    messageEl.style.wordWrap = 'break-word';
    messageEl.style.animation = 'fadeIn 0.3s ease-in';
    
    // Add animation keyframes
    if (!document.getElementById('chat-animations')) {
      const style = document.createElement('style');
      style.id = 'chat-animations';
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Format message based on type
    let content = '';
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    // Helper function to capitalize first letter
    const capitalizeFirst = (str) => {
      if (!str) return str;
      return str.charAt(0).toUpperCase() + str.slice(1);
    };
    
    // Role colors
    const roleColors = {
      owner: '#ffe066',
      admin: '#9b59b6',
      ash: '#ff69b4',
      mod: '#95a5a6',
      player: '#ffffff'
    };
    
    switch(data.type) {
      case 'chat':
        const color = roleColors[data.role] || '#ffffff';
        const username = capitalizeFirst(data.username);
        
        // Add crown image for owners
        let crownImg = '';
        if (data.role === 'owner') {
          crownImg = `<img src="/assets/Staff Items/owner crown.png" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 4px;">`;
        }
        
        content = `<span style="color: #666; font-size: 11px;">[${timestamp}]</span> ` +
                  crownImg +
                  `<span style="color: ${color}; font-weight: bold;">${username}:</span> ` +
                  `<span style="color: #fff;">${data.message}</span>`;
        break;
        
      case 'kill':
        const killer = capitalizeFirst(data.killer);
        const victim = capitalizeFirst(data.victim);
        const killerRole = data.killerRole || 'player';
        const victimRole = data.victimRole || 'player';
        const killerColor = roleColors[killerRole];
        const victimColor = roleColors[victimRole];
        
        // Add symbols/icons for special roles
        let killerPrefix = '';
        let victimPrefix = '';
        
        if (killerRole === 'owner') {
          killerPrefix = `<img src="/assets/Staff Items/owner crown.png" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 2px;">`;
        } else if (killerRole === 'admin') {
          killerPrefix = '<span style="color: #9b59b6;">★</span> ';
        } else if (killerRole === 'ash') {
          killerPrefix = '<span style="color: #ff69b4;">★</span> ';
        } else if (killerRole === 'mod') {
          killerPrefix = '<span style="color: #95a5a6;">♦</span> ';
        }
        
        if (victimRole === 'owner') {
          victimPrefix = `<img src="/assets/Staff Items/owner crown.png" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 2px;">`;
        } else if (victimRole === 'admin') {
          victimPrefix = '<span style="color: #9b59b6;">★</span> ';
        } else if (victimRole === 'ash') {
          victimPrefix = '<span style="color: #ff69b4;">★</span> ';
        } else if (victimRole === 'mod') {
          victimPrefix = '<span style="color: #95a5a6;">♦</span> ';
        }
        
        content = `<span style="color: #ff4444;">☠</span> ` +
                  killerPrefix +
                  `<span style="color: ${killerColor}; font-weight: bold;">${killer}</span>` +
                  `<span style="color: #ff4444;"> eliminated </span>` +
                  victimPrefix +
                  `<span style="color: ${victimColor}; font-weight: bold;">${victim}</span>`;
        break;
        
      case 'join':
        const joinUsername = capitalizeFirst(data.username);
        const joinRole = data.role || 'player';
        const joinColor = roleColors[joinRole];
        
        if (joinRole !== 'player') {
          let joinCrown = '';
          if (joinRole === 'owner') {
            joinCrown = `<img src="/assets/Staff Items/owner crown.png" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 4px;">`;
          }
          content = `<span style="color: ${joinColor}; font-weight: bold;">` +
                    joinCrown +
                    `${capitalizeFirst(joinRole)} ${joinUsername} has joined!</span>`;
        } else {
          content = `<span style="color: #44ff44;">→ ${joinUsername} joined</span>`;
        }
        break;
        
      case 'leave':
        const leaveUsername = capitalizeFirst(data.username);
        content = `<span style="color: #ff4444;">← ${leaveUsername} left</span>`;
        break;
        
      case 'announcement':
        content = `<span style="color: #ffe066; font-weight: bold;">📢 ${data.message}</span>`;
        break;
        
      case 'message':
        // Command results and system messages
        content = `<span style="color: #ffcc00;">⚠ ${data.text || data.message || 'undefined'}</span>`;
        break;
        
      default:
        content = `<span style="color: #fff;">${data.message || data.text || 'undefined'}</span>`;
    }
    
    messageEl.innerHTML = content;
    this.chatMessages.appendChild(messageEl);
    
    // Keep only last 50 messages
    while (this.chatMessages.children.length > 50) {
      this.chatMessages.removeChild(this.chatMessages.firstChild);
    }
    
    // Auto-scroll to bottom
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }
  
  setupEventListeners() {
    // Handle window resize - store reference for cleanup
    this._resizeHandler = () => {
      this.adjustGameCanvas();
    };
    window.addEventListener('resize', this._resizeHandler);
    
    // Also adjust on initialization delay to ensure proper layout
    this._adjustTimeout = setTimeout(() => {
      this.adjustGameCanvas();
    }, 100);
  }
  
  setBuildMode(enabled) {
    if (enabled) {
      // Hide weapon section if open
      this.setWeaponMode(false);
      
      // Show build section, highlight it
      this.buildSection.style.display = 'block';
      this.buildSection.style.background = 'rgba(255,224,102,0.1)';
      this.buildSection.style.boxShadow = 'inset 0 0 20px rgba(255,224,102,0.2)';
      
      // Dim the hotbar section
      const hotbarSection = document.getElementById('ui-hotbar-section');
      if (hotbarSection) {
        hotbarSection.style.opacity = '0.5';
      }
    } else {
      // Hide build section
      this.buildSection.style.display = 'none';
      
      // Restore hotbar section
      const hotbarSection = document.getElementById('ui-hotbar-section');
      if (hotbarSection) {
        hotbarSection.style.opacity = '1';
      }
    }
  }

  setWeaponMode(enabled) {
    if (enabled) {
      // Hide build section if open
      this.setBuildMode(false);
      
      // Show weapon section, highlight it
      this.weaponSection.style.display = 'block';
      this.weaponSection.style.background = 'rgba(255,224,102,0.1)';
      this.weaponSection.style.boxShadow = 'inset 0 0 20px rgba(255,224,102,0.2)';
      
      // Populate weapon slots if not already done
      this.populateWeaponSlots();
      
      // Dim the hotbar section
      const hotbarSection = document.getElementById('ui-hotbar-section');
      if (hotbarSection) {
        hotbarSection.style.opacity = '0.5';
      }
    } else {
      // Hide weapon section
      this.weaponSection.style.display = 'none';
      
      // Restore hotbar section
      const hotbarSection = document.getElementById('ui-hotbar-section');
      if (hotbarSection) {
        hotbarSection.style.opacity = '1';
      }
    }
  }
  
  updateStats(stats) {
    if (!stats) return;
    
    const killsEl = document.getElementById('ui-kills');
    const deathsEl = document.getElementById('ui-deaths');
    const kdEl = document.getElementById('ui-kd');
    const streakEl = document.getElementById('ui-streak');
    const headshotsEl = document.getElementById('ui-headshots');
    
    if (killsEl) killsEl.textContent = stats.kills || 0;
    if (deathsEl) deathsEl.textContent = stats.deaths || 0;
    if (kdEl) {
      const kd = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : stats.kills.toFixed(2);
      kdEl.textContent = kd;
    }
    if (streakEl) streakEl.textContent = stats.currentKillStreak || 0;
    if (headshotsEl) headshotsEl.textContent = stats.headshots || 0;
  }
  
  updateGold(amount) {
    const goldText = document.getElementById('ui-gold-amount');
    if (goldText) {
      goldText.textContent = `${amount || 0} Gold`;
    }
  }

  destroy() {
    // Remove event listeners
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    
    // Clear timeout
    if (this._adjustTimeout) {
      clearTimeout(this._adjustTimeout);
    }
    
    // Remove style elements
    const stylesToRemove = ['ui-chat-scrollbar-styles', 'chat-animations'];
    stylesToRemove.forEach(id => {
      const style = document.getElementById(id);
      if (style) {
        style.remove();
      }
    });
    
    // Remove DOM elements
    if (this.uiPanel) {
      this.uiPanel.remove();
    }
    if (this.helpButton) {
      this.helpButton.remove();
    }
    if (this.helpTooltip) {
      this.helpTooltip.remove();
    }
  }
  
  createHelpButton() {
    // Check if this is PvE mode (port 3001 or pve subdomain)
    const isPvE = window.location.port === '3001' || window.location.hostname.includes('pve.');
    
    // Create help button
    const helpButton = document.createElement('button');
    helpButton.textContent = '?';
    helpButton.style.position = 'fixed';
    helpButton.style.bottom = '20px';
    helpButton.style.left = '370px'; // Position after UI panel
    helpButton.style.width = '50px';
    helpButton.style.height = '50px';
    helpButton.style.borderRadius = '50%';
    helpButton.style.background = 'linear-gradient(135deg, #ffe066 0%, #ffcc00 100%)';
    helpButton.style.border = '3px solid #2a2a44';
    helpButton.style.color = '#2a2a44';
    helpButton.style.fontSize = '24px';
    helpButton.style.fontWeight = 'bold';
    helpButton.style.cursor = 'pointer';
    helpButton.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
    helpButton.style.zIndex = '2000';
    helpButton.style.transition = 'all 0.3s';
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.style.position = 'fixed';
    tooltip.style.bottom = '80px';
    tooltip.style.left = '370px';
    tooltip.style.background = '#2a2a44';
    tooltip.style.border = '3px solid #ffe066';
    tooltip.style.borderRadius = '15px';
    tooltip.style.padding = '20px';
    tooltip.style.minWidth = '300px';
    tooltip.style.boxShadow = '0 6px 20px rgba(0,0,0,0.8)';
    tooltip.style.zIndex = '2001';
    tooltip.style.display = 'none';
    tooltip.style.color = '#ffffff';
    tooltip.style.fontSize = '14px';
    tooltip.style.lineHeight = '1.8';
    
    // Add controls content
    tooltip.innerHTML = `
      <h3 style="color: #ffe066; margin: 0 0 15px 0; font-size: 18px;">Controls</h3>
      <div style="display: grid; grid-template-columns: 120px 1fr; gap: 8px;">
        <div style="color: #ffe066; font-weight: bold;">WASD/Arrows</div>
        <div>Move</div>
        <div style="color: #ffe066; font-weight: bold;">Space/W/Up</div>
        <div>Jump</div>
        <div style="color: #ffe066; font-weight: bold;">Mouse</div>
        <div>Aim</div>
        <div style="color: #ffe066; font-weight: bold;">Click</div>
        <div>Shoot</div>
        <div style="color: #ffe066; font-weight: bold;">R</div>
        <div>Reload</div>
        <div style="color: #ffe066; font-weight: bold;">E</div>
        <div>Inventory</div>
        <div style="color: #ffe066; font-weight: bold;">1-5</div>
        <div>Select Item</div>
        <div style="color: #ffe066; font-weight: bold;">Q</div>
        <div>Weapon Menu</div>
        <div style="color: #ffe066; font-weight: bold;">Shift</div>
        <div>Build Mode</div>
        <div style="color: #ffe066; font-weight: bold;">X</div>
        <div>Delete Block</div>
        <div style="color: #ffe066; font-weight: bold;">T</div>
        <div>Chat</div>
        <div style="color: #ffe066; font-weight: bold;">V</div>
        <div>Achievements</div>
        ${isPvE ? `<div style="color: #ffe066; font-weight: bold;">P</div>
        <div>Party Menu</div>` : ''}
        <div style="color: #ffe066; font-weight: bold;">/help</div>
        <div>Commands</div>
      </div>
    `;
    
    // Add hover events
    helpButton.onmouseenter = () => {
      tooltip.style.display = 'block';
      helpButton.style.transform = 'scale(1.1)';
      helpButton.style.boxShadow = '0 6px 16px rgba(255,224,102,0.6)';
    };
    
    helpButton.onmouseleave = () => {
      tooltip.style.display = 'none';
      helpButton.style.transform = 'scale(1)';
      helpButton.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
    };
    
    // Also hide tooltip if mouse leaves it
    tooltip.onmouseleave = () => {
      tooltip.style.display = 'none';
      helpButton.style.transform = 'scale(1)';
      helpButton.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
    };
    
    document.body.appendChild(helpButton);
    document.body.appendChild(tooltip);
    
    this.helpButton = helpButton;
    this.helpTooltip = tooltip;
  }
  
  updateGold(amount) {
    const goldText = document.getElementById('ui-gold-amount');
    if (goldText) {
      goldText.textContent = `${amount || 0} Gold`;
    }
  }

  createWeaponButton() {
    // Create weapon switch button
    const weaponButton = document.createElement('button');
    weaponButton.id = 'weapon-switch-button';
    weaponButton.innerHTML = '🔫';
    weaponButton.title = 'Switch Weapon (Q)';
    weaponButton.style.cssText = `
      position: fixed;
      bottom: 140px;
      right: 20px;
      width: 50px;
      height: 50px;
      background: rgba(0,0,0,0.8);
      border: 2px solid #ffe066;
      border-radius: 10px;
      color: #ffe066;
      font-size: 24px;
      cursor: pointer;
      transition: all 0.3s;
      z-index: 1001;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    `;
    
    // Add hover effects
    weaponButton.addEventListener('mouseenter', () => {
      weaponButton.style.transform = 'scale(1.1)';
      weaponButton.style.boxShadow = '0 6px 16px rgba(255,224,102,0.6)';
      weaponButton.style.background = 'rgba(255,224,102,0.1)';
    });
    
    weaponButton.addEventListener('mouseleave', () => {
      weaponButton.style.transform = 'scale(1)';
      weaponButton.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
      weaponButton.style.background = 'rgba(0,0,0,0.8)';
    });
    
    // Add click handler
    weaponButton.addEventListener('click', () => {
      const isWeaponMode = this.weaponSection.style.display === 'block';
      this.setWeaponMode(!isWeaponMode);
    });
    
    document.body.appendChild(weaponButton);
    this.weaponButton = weaponButton;
  }

  populateWeaponSlots() {
    // Clear existing slots
    this.weaponContainer.innerHTML = '';
    
    // Define all available weapons
    const weapons = [
      { type: 'pistol', name: 'Pistol', sprite: 'Orange_pistol', key: '1' },
      { type: 'shotgun', name: 'Shotgun', sprite: 'shotgun', key: '2' },
      { type: 'rifle', name: 'Rifle', sprite: 'rifle', key: '3' },
      { type: 'sniper', name: 'Sniper', sprite: 'sniper', key: '4' },
      { type: 'tomatogun', name: 'Tomato Gun', sprite: 'tomatogun', key: '5' }
    ];
    
    weapons.forEach(weapon => {
      const slot = document.createElement('div');
      slot.style.cssText = `
        width: 48px;
        height: 48px;
        background: rgba(0,0,0,0.7);
        border: 2px solid rgba(255,224,102,0.5);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        position: relative;
        transition: all 0.2s;
      `;
      
      // Add weapon image
      const img = document.createElement('img');
      img.src = `/assets/weapons/${weapon.sprite}.png`;
      img.style.cssText = `
        width: 36px;
        height: 36px;
        object-fit: contain;
        image-rendering: pixelated;
      `;
      img.onerror = () => {
        // Fallback to text if image fails
        slot.innerHTML = `<span style="font-size: 10px; color: #ffe066;">${weapon.name}</span>`;
      };
      
      // Add key indicator
      const keyIndicator = document.createElement('div');
      keyIndicator.style.cssText = `
        position: absolute;
        top: -8px;
        left: -8px;
        width: 20px;
        height: 20px;
        background: #333;
        border: 2px solid #ffe066;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: #ffe066;
        font-weight: bold;
      `;
      keyIndicator.textContent = weapon.key;
      
      slot.appendChild(img);
      slot.appendChild(keyIndicator);
      
      // Add hover effects
      slot.addEventListener('mouseenter', () => {
        slot.style.borderColor = '#ffe066';
        slot.style.transform = 'scale(1.1)';
        slot.style.boxShadow = '0 0 10px rgba(255,224,102,0.5)';
      });
      
      slot.addEventListener('mouseleave', () => {
        slot.style.borderColor = 'rgba(255,224,102,0.5)';
        slot.style.transform = 'scale(1)';
        slot.style.boxShadow = 'none';
      });
      
      // Add click handler
      slot.addEventListener('click', () => {
        // Send weapon switch event
        if (this.scene && this.scene.playerSprite) {
          const weaponIndex = weapons.findIndex(w => w.type === weapon.type);
          this.scene.playerSprite.switchWeapon(weaponIndex);
          
          // Update visual selection
          this.updateWeaponSelection(weapon.type);
          
          // Close weapon menu after selection
          setTimeout(() => {
            this.setWeaponMode(false);
          }, 200);
        }
      });
      
      this.weaponContainer.appendChild(slot);
    });
  }
  
  updateWeaponSelection(selectedType) {
    // Update visual selection in weapon slots
    const slots = this.weaponContainer.children;
    const weapons = ['pistol', 'shotgun', 'rifle', 'sniper', 'tomatogun'];
    
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (weapons[i] === selectedType) {
        slot.style.background = 'rgba(255,224,102,0.2)';
        slot.style.borderColor = '#ffe066';
        slot.style.boxShadow = '0 0 15px rgba(255,224,102,0.6)';
      } else {
        slot.style.background = 'rgba(0,0,0,0.7)';
        slot.style.borderColor = 'rgba(255,224,102,0.5)';
        slot.style.boxShadow = 'none';
      }
    }
  }

  destroy() {
    // Remove event listeners
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    
    // Clear timeout
    if (this._adjustTimeout) {
      clearTimeout(this._adjustTimeout);
    }
    
    // Remove UI elements
    if (this.uiPanel) {
      this.uiPanel.remove();
    }
    if (this.helpButton) {
      this.helpButton.remove();
    }
    if (this.helpTooltip) {
      this.helpTooltip.remove();
    }
    if (this.weaponButton) {
      this.weaponButton.remove();
    }
  }
}