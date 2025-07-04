// PlayerContextMenu.js
// Right-click context menu for player interactions

export class PlayerContextMenu {
  constructor(scene) {
    this.scene = scene;
    this.menu = null;
    this.targetPlayer = null;
    this.targetUsername = null;
    this.createMenu();
    this.setupEventListeners();
  }

  createMenu() {
    // Create the context menu container
    this.menu = document.createElement('div');
    this.menu.id = 'player-context-menu';
    this.menu.style.position = 'absolute';
    this.menu.style.display = 'none';
    this.menu.style.background = 'linear-gradient(135deg, rgba(34,34,68,0.98) 0%, rgba(44,44,88,0.98) 100%)';
    this.menu.style.border = '2px solid #ffe066';
    this.menu.style.borderRadius = '12px';
    this.menu.style.padding = '8px';
    this.menu.style.minWidth = '200px';
    this.menu.style.boxShadow = '0 8px 32px rgba(0,0,0,0.8)';
    this.menu.style.zIndex = '3000';
    this.menu.style.fontFamily = 'Arial, sans-serif';
    
    document.body.appendChild(this.menu);
  }

  setupEventListeners() {
    // Close menu when clicking elsewhere
    document.addEventListener('click', (e) => {
      if (!this.menu.contains(e.target)) {
        this.hide();
      }
    });

    // Prevent right-click context menu on game canvas
    const canvas = this.scene.game.canvas;
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      
      // Get mouse position relative to game
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - 350; // Adjust for UI panel
      const y = e.clientY - rect.top;
      
      // Convert to world coordinates
      const worldPoint = this.scene.cameras.main.getWorldPoint(x, y);
      
      // Check if clicking on a player
      const clickedPlayer = this.getPlayerAtPosition(worldPoint.x, worldPoint.y);
      
      if (clickedPlayer && clickedPlayer !== this.scene.playerSprite) {
        this.show(e.clientX, e.clientY, clickedPlayer);
      } else {
        this.hide();
      }
    });
  }

  getPlayerAtPosition(x, y) {
    // Check all player sprites
    for (const player of this.scene.otherPlayers.values()) {
      const bounds = player.getBounds();
      if (bounds.contains(x, y)) {
        return player;
      }
    }
    return null;
  }

  show(x, y, targetPlayer) {
    this.targetPlayer = targetPlayer;
    this.targetUsername = targetPlayer.username;
    
    // Clear previous content
    this.menu.innerHTML = '';
    
    // Player header
    const header = document.createElement('div');
    header.style.padding = '8px 12px';
    header.style.borderBottom = '2px solid #ffe066';
    header.style.marginBottom = '8px';
    header.style.color = '#ffe066';
    header.style.fontSize = '16px';
    header.style.fontWeight = 'bold';
    header.style.textAlign = 'center';
    
    // Add role color and symbol
    const roleColors = {
      owner: '#ff6b6b',
      admin: '#4ecdc4',
      ash: '#95e1d3',
      mod: '#f38181',
      vip: '#aa96da',
      player: '#ffffff'
    };
    
    const roleSymbols = {
      owner: '👑',
      admin: '⚡',
      ash: '🔰',
      mod: '🛡️',
      vip: '💎',
      player: ''
    };
    
    const role = targetPlayer.role || 'player';
    const roleColor = roleColors[role] || '#ffffff';
    const roleSymbol = roleSymbols[role] || '';
    
    header.innerHTML = `
      <span style="color: ${roleColor}">
        ${roleSymbol} ${this.targetUsername}
      </span>
    `;
    
    this.menu.appendChild(header);
    
    // Menu options
    const options = [];
    
    // Everyone can trade and view stats
    options.push(
      { label: '💰 Trade', action: () => this.initiateTrade() },
      { label: '📊 View Stats', action: () => this.viewStats() },
      { label: '👤 View Profile', action: () => this.viewProfile() }
    );
    
    // Staff-only options
    const localPlayerRole = this.scene.playerRole || 'player';
    const isStaff = ['owner', 'admin', 'ash', 'mod'].includes(localPlayerRole);
    
    if (isStaff) {
      options.push(
        { label: '---', action: null }, // Separator
        { label: '📍 Teleport To', action: () => this.teleportTo(), staffOnly: true },
        { label: '🔄 Teleport Here', action: () => this.teleportHere(), staffOnly: true }
      );
      
      // Admin+ options
      if (['owner', 'admin', 'ash'].includes(localPlayerRole)) {
        options.push(
          { label: '👢 Kick Player', action: () => this.kickPlayer(), staffOnly: true },
          { label: '🚫 Ban Player', action: () => this.banPlayer(), staffOnly: true }
        );
      }
    }
    
    // Create menu items
    options.forEach(option => {
      if (option.label === '---') {
        const separator = document.createElement('hr');
        separator.style.border = 'none';
        separator.style.borderTop = '1px solid rgba(255,224,102,0.3)';
        separator.style.margin = '8px 0';
        this.menu.appendChild(separator);
      } else {
        const item = document.createElement('div');
        item.style.padding = '10px 16px';
        item.style.cursor = 'pointer';
        item.style.borderRadius = '8px';
        item.style.transition = 'all 0.2s';
        item.style.color = option.staffOnly ? '#ffa500' : '#ffffff';
        item.style.fontSize = '14px';
        
        item.textContent = option.label;
        
        item.onmouseover = () => {
          item.style.background = 'rgba(255,224,102,0.2)';
          item.style.paddingLeft = '20px';
        };
        
        item.onmouseout = () => {
          item.style.background = 'transparent';
          item.style.paddingLeft = '16px';
        };
        
        item.onclick = () => {
          option.action();
          this.hide();
        };
        
        this.menu.appendChild(item);
      }
    });
    
    // Position menu
    this.menu.style.left = x + 'px';
    this.menu.style.top = y + 'px';
    this.menu.style.display = 'block';
    
    // Adjust position if menu goes off screen
    const menuRect = this.menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
      this.menu.style.left = (x - menuRect.width) + 'px';
    }
    if (menuRect.bottom > window.innerHeight) {
      this.menu.style.top = (y - menuRect.height) + 'px';
    }
  }

  hide() {
    this.menu.style.display = 'none';
    this.targetPlayer = null;
    this.targetUsername = null;
  }

  // Action methods
  initiateTrade() {
    if (this.scene.tradeUI) {
      this.scene.tradeUI.sendTradeRequest(this.targetUsername);
    }
  }

  viewStats() {
    // Request stats from server
    if (this.scene.multiplayer && this.scene.multiplayer.socket) {
      this.scene.multiplayer.socket.emit('requestPlayerStats', { username: this.targetUsername });
    }
  }

  viewProfile() {
    console.log('View profile:', this.targetUsername);
    // TODO: Implement profile viewing
  }

  teleportTo() {
    // Execute teleport command
    if (this.scene.multiplayer && this.scene.multiplayer.socket) {
      this.scene.multiplayer.socket.emit('chatMessage', { 
        message: `/tpto ${this.targetUsername}` 
      });
    }
  }

  teleportHere() {
    // Execute teleport command
    if (this.scene.multiplayer && this.scene.multiplayer.socket) {
      this.scene.multiplayer.socket.emit('chatMessage', { 
        message: `/tp ${this.targetUsername}` 
      });
    }
  }

  kickPlayer() {
    if (confirm(`Kick player ${this.targetUsername}?`)) {
      if (this.scene.multiplayer && this.scene.multiplayer.socket) {
        this.scene.multiplayer.socket.emit('chatMessage', { 
          message: `/kick ${this.targetUsername}` 
        });
      }
    }
  }

  banPlayer() {
    if (confirm(`Ban player ${this.targetUsername}?`)) {
      if (this.scene.multiplayer && this.scene.multiplayer.socket) {
        this.scene.multiplayer.socket.emit('chatMessage', { 
          message: `/ban ${this.targetUsername}` 
        });
      }
    }
  }

  destroy() {
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
    }
  }
}