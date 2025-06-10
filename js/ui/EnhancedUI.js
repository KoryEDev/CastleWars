export class EnhancedUI {
  constructor(scene) {
    this.scene = scene;
    this.isResizing = false;
    
    this.createUI();
    this.setupEventListeners();
  }

  createUI() {
    // Remove old UI panels if exist
    const oldPanel = document.getElementById('ui-panel');
    if (oldPanel) oldPanel.remove();
    const oldBottomPanel = document.getElementById('bottom-ui-panel');
    if (oldBottomPanel) oldBottomPanel.remove();
    
    // Create main L-shaped UI container
    const uiPanel = document.createElement('div');
    uiPanel.id = 'ui-panel';
    uiPanel.style.position = 'fixed';
    uiPanel.style.left = '0';
    uiPanel.style.bottom = '0';
    uiPanel.style.pointerEvents = 'none';
    uiPanel.style.zIndex = '997'; // Below inventory hotbar (999)
    document.body.appendChild(uiPanel);
    
    // Create the L-shaped background panel
    this.createLShapedPanel(uiPanel);
    
    // Create health bar (separate from L-panel)
    this.createHealthBar(document.body);
    
    // Store reference
    this.uiPanel = uiPanel;
  }

  createLShapedPanel(parent) {
    // Create L-shaped background container
    const lPanel = document.createElement('div');
    lPanel.id = 'l-shaped-panel';
    lPanel.style.position = 'fixed';
    lPanel.style.left = '0';
    lPanel.style.bottom = '0';
    lPanel.style.pointerEvents = 'auto';
    
    // Calculate responsive dimensions
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const isMobile = screenWidth < 768;
    
    // Vertical part of L (left side) - reduced width
    const verticalPanel = document.createElement('div');
    verticalPanel.id = 'vertical-panel';
    verticalPanel.style.position = 'absolute';
    verticalPanel.style.left = '0';
    verticalPanel.style.bottom = '0';
    verticalPanel.style.width = isMobile ? '250px' : '280px'; // Reduced from 350px
    verticalPanel.style.height = isMobile ? '350px' : '400px'; // Reduced from 500px
    verticalPanel.style.background = 'linear-gradient(to right, rgba(34,34,68,0.95) 0%, rgba(44,44,88,0.9) 70%, rgba(34,34,68,0.85) 100%)';
    verticalPanel.style.borderRight = '3px solid #ffe066';
    verticalPanel.style.borderTop = '3px solid #ffe066';
    verticalPanel.style.borderTopRightRadius = '20px';
    verticalPanel.style.boxShadow = '4px -4px 20px rgba(0,0,0,0.6), inset -1px 1px 0 rgba(255,224,102,0.3)';
    verticalPanel.style.overflow = 'hidden';
    verticalPanel.style.transition = 'height 0.3s ease';
    
    // Horizontal part of L (bottom)
    const horizontalPanel = document.createElement('div');
    horizontalPanel.style.position = 'absolute';
    horizontalPanel.style.left = '0';
    horizontalPanel.style.bottom = '0';
    horizontalPanel.style.width = '100%';
    horizontalPanel.style.height = isMobile ? '100px' : '120px';
    horizontalPanel.style.background = 'linear-gradient(to top, rgba(34,34,68,0.95) 0%, rgba(44,44,88,0.9) 50%, rgba(34,34,68,0.85) 100%)';
    horizontalPanel.style.borderTop = '3px solid #ffe066';
    horizontalPanel.style.boxShadow = '0 -4px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,224,102,0.3)';
    horizontalPanel.style.zIndex = '998'; // Above game, below modals
    
    // Add decorative elements to vertical panel
    const verticalDecor = document.createElement('div');
    verticalDecor.style.position = 'absolute';
    verticalDecor.style.right = '0';
    verticalDecor.style.top = '0';
    verticalDecor.style.width = '100%';
    verticalDecor.style.height = '100%';
    verticalDecor.style.background = 'linear-gradient(to left, rgba(255,224,102,0.1) 0%, transparent 50%)';
    verticalDecor.style.clipPath = 'polygon(50% 0, 100% 0, 100% 100%, 0 100%)';
    verticalPanel.appendChild(verticalDecor);
    
    // Add decorative elements to horizontal panel
    const horizontalDecor = document.createElement('div');
    horizontalDecor.style.position = 'absolute';
    horizontalDecor.style.left = isMobile ? '250px' : '280px';
    horizontalDecor.style.top = '0';
    horizontalDecor.style.width = `calc(100% - ${isMobile ? '250px' : '280px'})`;
    horizontalDecor.style.height = '100%';
    horizontalDecor.style.background = 'linear-gradient(to right, rgba(255,224,102,0.1) 0%, transparent 20%)';
    horizontalPanel.appendChild(horizontalDecor);
    
    // Add glow line at top of horizontal panel
    const glowLine = document.createElement('div');
    glowLine.style.position = 'absolute';
    glowLine.style.top = '0';
    glowLine.style.left = isMobile ? '250px' : '280px';
    glowLine.style.width = `calc(100% - ${isMobile ? '250px' : '280px'})`;
    glowLine.style.height = '3px';
    glowLine.style.background = 'linear-gradient(to right, #ffe066 0%, rgba(255,224,102,0.3) 50%, transparent 100%)';
    glowLine.style.boxShadow = '0 0 10px #ffe066';
    horizontalPanel.appendChild(glowLine);
    
    // Drag handle for vertical panel
    const dragHandle = document.createElement('div');
    dragHandle.style.position = 'absolute';
    dragHandle.style.top = '10px';
    dragHandle.style.right = '10px';
    dragHandle.style.width = '30px';
    dragHandle.style.height = '30px';
    dragHandle.style.background = 'rgba(255,224,102,0.2)';
    dragHandle.style.border = '2px solid #ffe066';
    dragHandle.style.borderRadius = '50%';
    dragHandle.style.cursor = 'move';
    dragHandle.style.display = 'flex';
    dragHandle.style.alignItems = 'center';
    dragHandle.style.justifyContent = 'center';
    dragHandle.style.transition = 'all 0.2s';
    dragHandle.innerHTML = '<span style="color: #ffe066; font-size: 16px;">⋮⋮</span>';
    
    dragHandle.onmouseover = () => {
      dragHandle.style.background = 'rgba(255,224,102,0.4)';
      dragHandle.style.transform = 'scale(1.1)';
    };
    
    dragHandle.onmouseout = () => {
      dragHandle.style.background = 'rgba(255,224,102,0.2)';
      dragHandle.style.transform = 'scale(1)';
    };
    
    verticalPanel.appendChild(dragHandle);
    
    // Create content containers
    const chatSection = document.createElement('div');
    chatSection.style.position = 'absolute';
    chatSection.style.top = '50px';
    chatSection.style.left = '15px';
    chatSection.style.right = '15px';
    chatSection.style.bottom = '15px';
    chatSection.style.display = 'flex';
    chatSection.style.flexDirection = 'column';
    chatSection.style.gap = '15px';
    
    // Create chat UI within the vertical panel
    this.createChatUI(chatSection);
    
    verticalPanel.appendChild(chatSection);
    
    // Removed weapon UI - using inventory hotbar instead
    
    // Create ammo display in horizontal panel
    const ammoSection = document.createElement('div');
    ammoSection.style.position = 'absolute';
    ammoSection.style.right = '20px';
    ammoSection.style.top = '50%';
    ammoSection.style.transform = 'translateY(-50%)';
    
    this.createAmmoUI(ammoSection);
    
    horizontalPanel.appendChild(ammoSection);
    
    // Add panels to L-shaped container
    lPanel.appendChild(horizontalPanel);
    lPanel.appendChild(verticalPanel);
    parent.appendChild(lPanel);
    
    // Setup drag functionality
    this.setupDrag(dragHandle, verticalPanel, lPanel);
    
    // Store references
    this.lPanel = lPanel;
    this.verticalPanel = verticalPanel;
    this.horizontalPanel = horizontalPanel;
  }

  createChatUI(parent) {
    // Chat header
    const chatHeader = document.createElement('div');
    chatHeader.style.padding = '10px';
    chatHeader.style.background = 'rgba(255, 224, 102, 0.1)';
    chatHeader.style.border = '1px solid rgba(255, 224, 102, 0.3)';
    chatHeader.style.borderRadius = '8px';
    
    const chatTitle = document.createElement('div');
    chatTitle.style.color = '#ffe066';
    chatTitle.style.fontSize = '16px';
    chatTitle.style.fontWeight = 'bold';
    chatTitle.style.textTransform = 'uppercase';
    chatTitle.style.letterSpacing = '1px';
    chatTitle.style.textAlign = 'center';
    chatTitle.textContent = 'Chat & Game Log';
    
    chatHeader.appendChild(chatTitle);
    
    // Chat messages area
    const chatMessages = document.createElement('div');
    chatMessages.id = 'chat-messages';
    chatMessages.style.flex = '1';
    chatMessages.style.overflowY = 'auto';
    chatMessages.style.padding = '10px';
    chatMessages.style.background = 'rgba(0, 0, 0, 0.3)';
    chatMessages.style.border = '1px solid rgba(255, 224, 102, 0.2)';
    chatMessages.style.borderRadius = '8px';
    chatMessages.style.fontFamily = 'Arial, sans-serif';
    chatMessages.style.fontSize = '14px';
    chatMessages.style.color = '#fff';
    chatMessages.style.lineHeight = '1.5';
    
    // Custom scrollbar
    const scrollbarStyle = document.createElement('style');
    scrollbarStyle.textContent = `
      #chat-messages::-webkit-scrollbar {
        width: 8px;
      }
      #chat-messages::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 4px;
      }
      #chat-messages::-webkit-scrollbar-thumb {
        background: #ffe066;
        border-radius: 4px;
      }
      #chat-messages::-webkit-scrollbar-thumb:hover {
        background: #ffcc00;
      }
    `;
    document.head.appendChild(scrollbarStyle);
    
    parent.appendChild(chatHeader);
    parent.appendChild(chatMessages);
    
    this.chatMessages = chatMessages;
  }


  createAmmoUI(parent) {
    const ammoDisplay = document.createElement('div');
    ammoDisplay.style.background = 'rgba(0, 0, 0, 0.5)';
    ammoDisplay.style.border = '2px solid #ffe066';
    ammoDisplay.style.borderRadius = '10px';
    ammoDisplay.style.padding = '10px 20px';
    ammoDisplay.style.display = 'flex';
    ammoDisplay.style.alignItems = 'center';
    ammoDisplay.style.gap = '10px';
    
    const ammoIcon = document.createElement('div');
    ammoIcon.style.fontSize = '24px';
    ammoIcon.textContent = '🔫';
    
    const ammoText = document.createElement('div');
    ammoText.id = 'ammo-text';
    ammoText.style.color = '#ffe066';
    ammoText.style.fontSize = '20px';
    ammoText.style.fontWeight = 'bold';
    ammoText.textContent = '12 / 12';
    
    ammoDisplay.appendChild(ammoIcon);
    ammoDisplay.appendChild(ammoText);
    parent.appendChild(ammoDisplay);
    
    this.ammoText = ammoText;
  }

  setupDrag(handle, panel, container) {
    let isDragging = false;
    let startY = 0;
    let startHeight = 400;
    
    handle.onmousedown = (e) => {
      isDragging = true;
      startY = e.clientY;
      startHeight = parseInt(panel.style.height);
      document.body.style.cursor = 'move';
      e.preventDefault();
    };
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const deltaY = startY - e.clientY;
      const isMobile = window.innerWidth < 768;
      const minHeight = isMobile ? 250 : 300;
      const maxHeight = isMobile ? 500 : 600;
      const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
      
      panel.style.height = newHeight + 'px';
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = 'default';
      }
    });
  }

  // Weapon slot creation removed - using inventory hotbar instead

  createHealthBar(parent) {
    const healthContainer = document.createElement('div');
    healthContainer.style.position = 'absolute';
    healthContainer.style.top = '20px';
    healthContainer.style.left = '50%';
    healthContainer.style.transform = 'translateX(-50%)';
    healthContainer.style.pointerEvents = 'none';
    healthContainer.style.textAlign = 'center';
    
    // Username display
    const usernameText = document.createElement('div');
    usernameText.id = 'username-text';
    usernameText.style.color = '#ffe066';
    usernameText.style.fontSize = '18px';
    usernameText.style.fontWeight = 'bold';
    usernameText.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.8)';
    usernameText.style.marginBottom = '5px';
    usernameText.style.letterSpacing = '1px';
    usernameText.textContent = this.scene.username || 'Player';
    
    const healthBar = document.createElement('div');
    healthBar.style.width = '300px';
    healthBar.style.height = '30px';
    healthBar.style.background = 'rgba(0, 0, 0, 0.8)';
    healthBar.style.border = '2px solid #fff';
    healthBar.style.borderRadius = '15px';
    healthBar.style.overflow = 'hidden';
    healthBar.style.position = 'relative';
    healthBar.style.margin = '0 auto';
    
    const healthFill = document.createElement('div');
    healthFill.id = 'health-fill';
    healthFill.style.width = '100%';
    healthFill.style.height = '100%';
    healthFill.style.background = 'linear-gradient(90deg, #00ff00, #00dd00)';
    healthFill.style.transition = 'width 0.3s ease';
    
    const healthText = document.createElement('div');
    healthText.id = 'health-text';
    healthText.style.position = 'absolute';
    healthText.style.top = '50%';
    healthText.style.left = '50%';
    healthText.style.transform = 'translate(-50%, -50%)';
    healthText.style.color = '#fff';
    healthText.style.fontSize = '16px';
    healthText.style.fontWeight = 'bold';
    healthText.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
    healthText.textContent = '100 / 100';
    
    healthBar.appendChild(healthFill);
    healthBar.appendChild(healthText);
    healthContainer.appendChild(usernameText);
    healthContainer.appendChild(healthBar);
    parent.appendChild(healthContainer);
    
    this.healthFill = healthFill;
    this.healthText = healthText;
    this.usernameText = usernameText;
  }


  // Weapon-specific UI removed - using inventory hotbar instead


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
    
    // Role styling
    const roleColors = {
      owner: '#ffe066',
      admin: '#9b59b6',
      mod: '#95a5a6',
      player: '#ffffff'
    };
    
    const roleSymbols = {
      owner: '',  // Using crown image instead
      admin: '★',
      mod: '◆',
      player: ''
    };
    
    const roleTitles = {
      owner: 'Owner',
      admin: 'Admin',
      mod: 'Moderator',
      player: ''
    };
    
    switch(data.type) {
      case 'chat':
        const color = roleColors[data.role] || '#ffffff';
        const symbol = roleSymbols[data.role] || '';
        const username = capitalizeFirst(data.username);
        
        // Add crown image for owners
        let crownImg = '';
        if (data.role === 'owner') {
          crownImg = `<img src="/assets/Staff Items/owner crown.png" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 4px;">`;
        }
        
        content = `<span style="color: #999; font-size: 12px;">[${timestamp}]</span> ` +
                  crownImg +
                  `<span style="color: ${color};">${symbol} ${username}:</span> ` +
                  `<span style="color: #fff;">${data.message}</span>`;
        break;
        
      case 'kill':
        const killer = capitalizeFirst(data.killer);
        const victim = capitalizeFirst(data.victim);
        content = `<span style="color: #ff4444;">☠ ${killer} eliminated ${victim}</span>`;
        break;
        
      case 'join':
        const joinUsername = capitalizeFirst(data.username);
        const joinRole = data.role || 'player';
        const joinColor = roleColors[joinRole];
        const joinSymbol = roleSymbols[joinRole];
        const joinTitle = roleTitles[joinRole];
        
        if (joinRole !== 'player') {
          // Add crown for owner
          let joinCrown = '';
          if (joinRole === 'owner') {
            joinCrown = `<img src="/assets/Staff Items/owner crown.png" style="width: 20px; height: 20px; vertical-align: middle; margin-right: 4px;">`;
          }
          // Special announcement for staff/owner
          content = `<span style="color: ${joinColor}; font-weight: bold; font-size: 16px;">` +
                    joinCrown +
                    `${joinSymbol} ${joinTitle} ${joinUsername} has joined the game!</span>`;
        } else {
          content = `<span style="color: #44ff44;">→ ${joinUsername} joined the game</span>`;
        }
        break;
        
      case 'leave':
        const leaveUsername = capitalizeFirst(data.username);
        const leaveRole = data.role || 'player';
        const leaveColor = roleColors[leaveRole];
        const leaveSymbol = roleSymbols[leaveRole];
        
        if (leaveRole !== 'player') {
          // Add crown for owner
          let leaveCrown = '';
          if (leaveRole === 'owner') {
            leaveCrown = `<img src="/assets/Staff Items/owner crown.png" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 4px;">`;
          }
          content = `<span style="color: ${leaveColor};">` +
                    leaveCrown +
                    `${leaveSymbol} ${leaveUsername} left the game</span>`;
        } else {
          content = `<span style="color: #ff4444;">← ${leaveUsername} left the game</span>`;
        }
        break;
        
      case 'announcement':
        content = `<span style="color: #ffe066; font-weight: bold;">📢 ${data.message}</span>`;
        break;
        
      default:
        content = `<span style="color: #fff;">${data.message}</span>`;
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

  updateHealth(current, max) {
    const percent = (current / max) * 100;
    this.healthFill.style.width = percent + '%';
    this.healthText.textContent = `${current} / ${max}`;
    
    // Change color based on health
    if (percent > 60) {
      this.healthFill.style.background = 'linear-gradient(90deg, #00ff00, #00dd00)';
    } else if (percent > 30) {
      this.healthFill.style.background = 'linear-gradient(90deg, #ffff00, #ffdd00)';
    } else {
      this.healthFill.style.background = 'linear-gradient(90deg, #ff0000, #dd0000)';
    }
  }

  updateAmmo(current, max) {
    this.ammoText.textContent = `${current} / ${max}`;
    
    // Change color based on ammo
    if (current === 0) {
      this.ammoText.style.color = '#ff0000';
    } else if (current <= max * 0.3) {
      this.ammoText.style.color = '#ffff00';
    } else {
      this.ammoText.style.color = '#ffe066';
    }
  }

  setupEventListeners() {
    // Handle window resize
    window.addEventListener('resize', () => {
      this.handleResize();
    });
  }
  
  handleResize() {
    const isMobile = window.innerWidth < 768;
    
    if (this.verticalPanel) {
      this.verticalPanel.style.width = isMobile ? '250px' : '280px';
      this.verticalPanel.style.height = isMobile ? '350px' : '400px';
    }
    
    if (this.horizontalPanel) {
      this.horizontalPanel.style.height = isMobile ? '100px' : '120px';
    }
    
    // Update weapon section position
    const weaponSection = this.horizontalPanel.querySelector('div[style*="left"]');
    if (weaponSection) {
      weaponSection.style.left = isMobile ? '260px' : '300px';
    }
  }
  
  // Weapon slot synchronization removed - handled by inventory system

  destroy() {
    const uiPanel = document.getElementById('ui-panel');
    if (uiPanel) {
      uiPanel.remove();
    }
  }
}