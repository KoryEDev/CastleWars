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
    console.log('Setting up context menu listener on canvas:', canvas);
    
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      console.log('Right click detected at:', e.clientX, e.clientY);
      
      // Get mouse position relative to game canvas
      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      
      console.log('Canvas position:', canvasX, canvasY);
      
      // The game viewport starts at x=350 due to UI panel
      // So we need to adjust the canvas X to viewport X
      const viewportX = canvasX - 350;
      const viewportY = canvasY;
      
      console.log('Viewport position:', viewportX, viewportY);
      
      // Get the camera for world coordinate conversion
      const camera = this.scene.cameras.main;
      const worldX = viewportX + camera.scrollX;
      const worldY = viewportY + camera.scrollY;
      
      console.log('Camera scroll:', camera.scrollX, camera.scrollY);
      console.log('World coordinates:', worldX, worldY);
      
      // Check if clicking on a player
      const clickedPlayer = this.getPlayerAtPosition(worldX, worldY);
      
      if (clickedPlayer && clickedPlayer !== this.scene.playerSprite) {
        console.log('Clicked on player:', clickedPlayer.username);
        this.show(e.clientX, e.clientY, clickedPlayer);
      } else {
        console.log('No player clicked');
        this.hide();
      }
    });
  }

  getPlayerAtPosition(x, y) {
    // Check all player sprites in the scene
    const players = this.scene.children.list.filter(child => {
      return child instanceof Phaser.GameObjects.Sprite &&
        child.playerId &&
        child.playerId !== this.scene.playerId &&
        child.texture && child.texture.key && (
        child.texture.key.includes('stickman'));
    });
    
    for (const player of players) {
      // Get player position and size
      const playerX = player.x;
      const playerY = player.y;
      const width = player.displayWidth || 64;
      const height = player.displayHeight || 64;
      
      // Since origin is (0.5, 1), adjust bounds calculation
      const bounds = {
        left: playerX - width / 2,
        right: playerX + width / 2,
        top: playerY - height,
        bottom: playerY
      };
      
      // Check with a bit of tolerance for easier clicking
      const tolerance = 30;
      const containsPoint = x >= bounds.left - tolerance && 
                           x <= bounds.right + tolerance && 
                           y >= bounds.top - tolerance && 
                           y <= bounds.bottom + tolerance;
      
      if (containsPoint) {
        console.log('Found player at position with ID:', player.playerId);
        // Get player data from world state to have username and role
        const worldState = this.scene.multiplayer?.worldState;
        if (worldState && worldState.players && worldState.players[player.playerId]) {
          const playerData = worldState.players[player.playerId];
          player.username = playerData.username;
          player.role = playerData.role;
          console.log('Player clicked:', player.username, 'role:', player.role);
        }
        return player;
      }
    }
    return null;
  }

  show(x, y, targetPlayer) {
    this.targetPlayer = targetPlayer;
    this.targetUsername = targetPlayer.username || '';
    
    // Debug log
    console.log('Showing context menu for:', this.targetUsername, 'at', x, y);
    console.log('Target player object:', targetPlayer);
    
    if (!this.targetUsername) {
      console.error('No username found for target player');
      return;
    }
    
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
        ${roleSymbol} ${this.targetUsername ? this.targetUsername.charAt(0).toUpperCase() + this.targetUsername.slice(1) : ''}
      </span>
    `;
    
    this.menu.appendChild(header);
    
    // Menu options
    const options = [];
    
    // Everyone can trade and view stats
    options.push(
      { label: '💰 Trade', action: () => this.initiateTrade() },
      { label: '📊 View Stats', action: () => this.viewStats() }
    );
    
    // Staff-only options
    const localPlayerRole = this.scene.playerRole || 'player';
    const isStaff = ['owner', 'admin', 'ash', 'mod'].includes(localPlayerRole);
    const targetRole = targetPlayer.role || 'player';
    
    if (isStaff) {
      options.push(
        { label: '---', action: null }, // Separator
        { label: '📍 Teleport To', action: () => this.teleportTo(), staffOnly: true },
        { label: '🔄 Teleport Here', action: () => this.teleportHere(), staffOnly: true }
      );
      
      // Admin+ options
      if (['owner', 'admin', 'ash'].includes(localPlayerRole)) {
        options.push(
          { label: '📦 Manage Inventory', action: () => this.manageInventory(), staffOnly: true }
        );
        
        // Can't kick/ban owners
        if (targetRole !== 'owner') {
          options.push(
            { label: '👢 Kick Player', action: () => this.kickPlayer(), staffOnly: true },
            { label: '🚫 Ban Player', action: () => this.banPlayer(), staffOnly: true }
          );
        }
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



  teleportTo() {
    // Execute teleport command directly
    if (this.scene.multiplayer && this.scene.multiplayer.socket && this.targetUsername) {
      console.log('Teleporting to:', this.targetUsername);
      this.scene.multiplayer.socket.emit('command', { 
        command: 'tpto',
        target: this.scene.username,  // Current player name
        value: this.targetUsername      // Target to teleport to
      });
    }
  }

  teleportHere() {
    // Execute teleport command directly
    if (this.scene.multiplayer && this.scene.multiplayer.socket && this.targetUsername) {
      console.log('Teleporting here:', this.targetUsername);
      this.scene.multiplayer.socket.emit('command', { 
        command: 'teleport',
        target: this.targetUsername,  // Target to teleport here
        value: ''
      });
    }
  }

  kickPlayer() {
    if (confirm(`Kick player ${this.targetUsername}?`)) {
      if (this.scene.multiplayer && this.scene.multiplayer.socket && this.targetUsername) {
        console.log('Kicking player:', this.targetUsername);
        this.scene.multiplayer.socket.emit('command', { 
          command: 'kick',
          target: this.targetUsername,  // Player to kick
          value: ''
        });
      }
    }
  }

  banPlayer() {
    if (confirm(`Ban player ${this.targetUsername}?`)) {
      if (this.scene.multiplayer && this.scene.multiplayer.socket && this.targetUsername) {
        console.log('Banning player:', this.targetUsername);
        this.scene.multiplayer.socket.emit('command', { 
          command: 'ban',
          target: this.targetUsername,  // Player to ban
          value: ''
        });
      }
    }
  }

  manageInventory() {
    // Request the player's inventory data
    if (this.scene.multiplayer && this.scene.multiplayer.socket && this.targetUsername) {
      console.log('Requesting inventory for:', this.targetUsername);
      
      // Ensure admin inventory UI exists
      if (!this.scene.adminInventoryUI) {
        console.error('AdminInventoryUI not initialized');
        this.scene.showMessage('Admin UI not available', '#ff6b6b', 1500);
        return;
      }
      
      this.scene.multiplayer.socket.emit('requestPlayerInventory', { 
        username: this.targetUsername 
      });
    }
  }

  destroy() {
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
    }
  }
}