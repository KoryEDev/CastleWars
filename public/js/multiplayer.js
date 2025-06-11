const io = window.io;

export default class MultiplayerManager {
  constructor(scene) {
    this.scene = scene;
    this.socket = null;
    this.username = null;
    this.otherSprites = {};
    this.otherUsernames = {};
    this.localId = null;
    this.worldState = null;
    this.npcSprites = {};
    this.npcHealthBars = {};
  }

  connect(username) {
    this.username = username;
    
    // Use the same origin as the page (so PvE connects to PvE server, PvP to PvP server)
    const socketUrl = window.location.origin;
    
    console.log('Connecting to socket server at:', socketUrl);
    
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'], // Try websocket first, fall back to polling
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      forceNew: true
    });
    
    this.socket.on('connect', () => {
      this.localId = this.socket.id;
      console.log('MultiplayerManager connected with ID:', this.localId);
      // Emit join only after connect to establish game session
      this.socket.emit('join', { username });
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      console.error('Error type:', error.type);
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });
    
    // Listen for world state updates
    this.socket.on('worldState', (state) => {
      this.worldState = state;
      this.renderWorld(state);
    });
  }

  sendInput(input) {
    if (this.socket) {
      this.socket.emit('playerInput', input);
    }
  }

  renderWorld(state) {
    // Update PvE UI elements if present
    if (state.wave && window.location.port === '3001') {
      const waveEl = document.getElementById('ui-wave-number');
      if (waveEl && state.wave.current !== undefined) {
        waveEl.textContent = state.wave.current.toString();
      }
    }
    
    // Store parties for party member checking
    this.parties = state.parties || {};
    
    // Render NPCs if present
    if (state.npcs) {
      console.log('[MULTIPLAYER] World state includes NPCs:', Object.keys(state.npcs).length);
      this.renderNPCs(state.npcs);
    }
    
    // Track which player IDs are present this frame
    const seen = {};
    for (const id in state.players) {
      // Skip local player - handled by GameScene
      if (id === this.localId) {
        continue;
      }
      
      const player = state.players[id];
      seen[id] = true;
      
      // Create sprite for other players if it doesn't exist
      if (!this.otherSprites[id]) {
        console.log(`Creating sprite for other player: ${id}`);
        // Use owner sprite if player is owner
        const spriteKey = player.role === 'owner' && this.scene.textures.exists('stickman_owner') ? 'stickman_owner' : 'stickman';
        this.otherSprites[id] = this.scene.add.sprite(player.x, player.y, spriteKey).setOrigin(0.5, 1);
        // Create username text for other player
        const isPartyMember = this.isInSameParty(player);
        const nameColor = isPartyMember ? '#4ecdc4' : '#ffffff'; // Cyan for party members
        const backgroundColor = isPartyMember ? '#00403080' : '#00000080'; // Tinted background for party members
        
        this.otherUsernames[id] = this.scene.add.text(player.x, player.y - 50, player.username.charAt(0).toUpperCase() + player.username.slice(1), {
          fontSize: '16px',
          fontFamily: 'Arial',
          color: nameColor,
          backgroundColor: backgroundColor,
          padding: { x: 4, y: 2 }
        }).setOrigin(0.5, 0.5).setDepth(1000).setY(player.y - 81);
      }
      
      // Update position
      this.otherSprites[id].setPosition(player.x, player.y);
      // Update username position and color based on party status
      if (this.otherUsernames[id]) {
        this.otherUsernames[id].setPosition(player.x, player.y - 81);
        
        // Update color if party status changed
        const isPartyMember = this.isInSameParty(player);
        const nameColor = isPartyMember ? '#4ecdc4' : '#ffffff';
        const backgroundColor = isPartyMember ? '#00403080' : '#00000080';
        this.otherUsernames[id].setStyle({ color: nameColor, backgroundColor: backgroundColor });
      }
      
      // Apply death visual effect
      if (player.isDead) {
        this.otherSprites[id].setAlpha(0.3);
        this.otherSprites[id].setScale(0.8);
      } else {
        this.otherSprites[id].setAlpha(1);
        this.otherSprites[id].setScale(1);
      }
      
      // Handle sprite textures and flipping
      if (player.role === 'owner') {
        const runningKey = this.scene.textures.exists('stickman_owner_running') ? 'stickman_owner_running' : 'stickman_running';
        const idleKey = this.scene.textures.exists('stickman_owner') ? 'stickman_owner' : 'stickman';
        
        if (player.vx < 0) {
          this.otherSprites[id].setTexture(runningKey);
          this.otherSprites[id].setFlipX(true);
        } else if (player.vx > 0) {
          this.otherSprites[id].setTexture(runningKey);
          this.otherSprites[id].setFlipX(false);
        } else {
          this.otherSprites[id].setTexture(idleKey);
          this.otherSprites[id].setFlipX(false);
        }
        this.otherSprites[id].setTint(0xffffff);
      } else if (player.role === 'mod') {
        if (player.vx < 0) {
          this.otherSprites[id].setTexture('stickman_running');
          this.otherSprites[id].setFlipX(true);
        } else if (player.vx > 0) {
          this.otherSprites[id].setTexture('stickman_running');
          this.otherSprites[id].setFlipX(false);
        } else {
          this.otherSprites[id].setTexture('stickman');
          this.otherSprites[id].setFlipX(false);
        }
        this.otherSprites[id].setTint(0xffe066); // Gold for mod
      } else {
        if (player.vx < 0) {
          this.otherSprites[id].setTexture('stickman_running');
          this.otherSprites[id].setFlipX(true);
        } else if (player.vx > 0) {
          this.otherSprites[id].setTexture('stickman_running');
          this.otherSprites[id].setFlipX(false);
        } else {
          this.otherSprites[id].setTexture('stickman');
          this.otherSprites[id].setFlipX(false);
        }
        this.otherSprites[id].setTint(0xffffff);
      }
    }
    
    // Remove sprites for players no longer present
    for (const id in this.otherSprites) {
      if (!seen[id]) {
        console.log(`Removing sprite for disconnected player: ${id}`);
        this.otherSprites[id].destroy();
        if (this.otherUsernames[id]) {
          this.otherUsernames[id].destroy();
          delete this.otherUsernames[id];
        }
        delete this.otherSprites[id];
      }
    }
  }
  
  renderNPCs(npcs) {
    const seenNPCs = {};
    
    console.log('[NPC RENDER] Rendering NPCs:', Object.keys(npcs).length);
    
    for (const id in npcs) {
      const npc = npcs[id];
      seenNPCs[id] = true;
      
      // Create NPC sprite if it doesn't exist
      if (!this.npcSprites[id]) {
        console.log('[NPC RENDER] Creating sprite for NPC:', npc.type, 'at', npc.x, npc.y);
        
        // Map NPC types to sprites
        const npcSpriteMap = {
          grunt: 'npc_monster',
          archer: 'npc_ranger',
          mage: 'npc_mage',
          brute: 'npc_monster',
          siegetower: 'npc_monster',
          assassin: 'npc_ranger',
          bomber: 'npc_monster',
          necromancer: 'npc_mage',
          skeleton: 'npc_monster'
        };
        
        // Get sprite key or fallback
        const spriteKey = npcSpriteMap[npc.type] || 'npc_monster';
        
        console.log('[NPC RENDER] Using sprite key:', spriteKey);
        
        // Check if texture exists
        if (!this.scene.textures.exists(spriteKey)) {
          console.error('[NPC RENDER] Texture not found:', spriteKey);
          return;
        }
        
        // Create NPC sprite with proper image
        this.npcSprites[id] = this.scene.add.sprite(npc.x, npc.y, spriteKey)
          .setOrigin(0.5, 1)
          .setDepth(100) // Ensure NPCs are visible above ground
          .setScrollFactor(1, 1); // Ensure it scrolls with camera
        
        console.log('[NPC RENDER] Created sprite:', this.npcSprites[id], 'visible:', this.npcSprites[id].visible);
        
        // Add slight tint for variety
        if (npc.type === 'brute') {
          this.npcSprites[id].setTint(0xFF8888); // Reddish for brutes
        } else if (npc.type === 'skeleton') {
          this.npcSprites[id].setTint(0xCCCCCC); // Grayish for skeletons
        }
        
        // Create health bar background
        const healthBarBg = this.scene.add.rectangle(npc.x, npc.y - 60, 40, 6, 0x000000)
          .setStrokeStyle(1, 0xffffff)
          .setDepth(999);
        
        // Create health bar fill
        const healthBarFill = this.scene.add.rectangle(npc.x - 20, npc.y - 60, 40, 6, 0xff0000)
          .setOrigin(0, 0.5)
          .setDepth(1000);
        
        // Create NPC type label
        const typeLabel = this.scene.add.text(npc.x, npc.y - 70, npc.type.toUpperCase(), {
          fontSize: '12px',
          fontFamily: 'Arial',
          color: '#ffffff',
          backgroundColor: '#00000080',
          padding: { x: 4, y: 2 }
        }).setOrigin(0.5, 0.5).setDepth(1001);
        
        this.npcHealthBars[id] = {
          bg: healthBarBg,
          fill: healthBarFill,
          label: typeLabel
        };
      }
      
      // Update NPC position
      this.npcSprites[id].setPosition(npc.x, npc.y);
      
      // Update health bar position and size
      if (this.npcHealthBars[id]) {
        const healthPercent = npc.health / npc.maxHealth;
        this.npcHealthBars[id].bg.setPosition(npc.x, npc.y - 60);
        this.npcHealthBars[id].fill.setPosition(npc.x - 20, npc.y - 60);
        this.npcHealthBars[id].fill.setDisplaySize(40 * healthPercent, 6);
        this.npcHealthBars[id].label.setPosition(npc.x, npc.y - 70);
      }
      
      // Flip sprite based on velocity
      if (npc.vx < 0) {
        this.npcSprites[id].setFlipX(true);
      } else if (npc.vx > 0) {
        this.npcSprites[id].setFlipX(false);
      }
      
      // Add attacking animation by scaling
      if (npc.state === 'attacking') {
        this.npcSprites[id].setScale(1.2, 1.2);
      } else {
        this.npcSprites[id].setScale(1, 1);
      }
    }
    
    // Remove sprites for NPCs no longer present
    for (const id in this.npcSprites) {
      if (!seenNPCs[id]) {
        this.npcSprites[id].destroy();
        if (this.npcHealthBars[id]) {
          this.npcHealthBars[id].bg.destroy();
          this.npcHealthBars[id].fill.destroy();
          this.npcHealthBars[id].label.destroy();
          delete this.npcHealthBars[id];
        }
        delete this.npcSprites[id];
      }
    }
  }
  
  isInSameParty(otherPlayer) {
    if (!this.worldState || !this.worldState.players || !this.parties) return false;
    
    // Get local player from world state
    const localPlayer = this.worldState.players[this.localId];
    if (!localPlayer || !localPlayer.party) return false;
    
    // Check if other player is in the same party
    return otherPlayer.party && otherPlayer.party === localPlayer.party;
  }
} 