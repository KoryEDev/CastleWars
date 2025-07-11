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
    
    // Input rate limiting
    this.lastInputSent = 0;
    this.inputSendRate = 50; // Send inputs at most 20 times per second (every 50ms)
    this.lastInput = null;
    this.inputChanged = false;
    
    // Network quality monitoring
    this.lastPing = 0;
    this.pingInterval = null;
    this.connectionQuality = 'good';
    
    // Cache DOM elements to avoid repeated lookups
    this._waveElement = null;
    this._cachedElements = new Map();
    
    // Texture state tracking to avoid redundant switches
    this._spriteTextureStates = new Map();
    
    // DOM update throttling
    this._domUpdateTimer = 0;
    this._domUpdateRate = 100; // Update DOM at 10Hz instead of 60Hz
    this._pendingDomUpdates = {};
  }

  connect(username) {
    this.username = username;
    
    // Use the same origin as the page (so PvE connects to PvE server, PvP to PvP server)
    const socketUrl = window.location.origin;
    console.log('Connecting to socket server at:', socketUrl);
    
    this.socket = io(socketUrl, {
      transports: ['websocket'], // Force WebSocket only to prevent transport switching
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
      upgrade: false // Prevent transport upgrades
    });
    
    this.socket.on('connect', () => {
      this.localId = this.socket.id;
      console.log('MultiplayerManager connected');
      
      // Clear any lag state
      this.lastWorldStateTime = Date.now();
      this.worldStateTimeout = null;
      
      // Emit join only after connect to establish game session
      this.socket.emit('join', { username });
      
      // Start monitoring connection quality
      this.startConnectionMonitoring();
    });
    
    // Listen for world state updates
    this.socket.on('worldState', (state) => {
      const now = Date.now();
      
      // Check for delayed packets (rubberbanding indicator)
      if (this.lastWorldStateTime) {
        const delta = now - this.lastWorldStateTime;
        if (delta > 300) { // Only warn for significant lag (300ms+)
          console.warn(`[NETWORK] Large gap between world states: ${delta}ms`);
          // Rate limit the lag warnings
          if (!this.lastLagWarning || now - this.lastLagWarning > 5000) {
            this.scene.addGameLogEntry?.('warning', { 
              message: `Network lag detected: ${delta}ms delay`,
              type: 'warning' 
            });
            this.lastLagWarning = now;
          }
        }
      }
      
      this.lastWorldStateTime = now;
      this.worldState = state;
      this.renderWorld(state);
      
      // Reset timeout for detecting frozen connection
      if (this.worldStateTimeout) {
        clearTimeout(this.worldStateTimeout);
      }
      this.worldStateTimeout = setTimeout(() => {
        console.error('[NETWORK] No world state received for 2 seconds - connection may be frozen');
        this.handleFrozenConnection();
      }, 2000);
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      this.stopConnectionMonitoring();
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.stopConnectionMonitoring();
      
      if (this.worldStateTimeout) {
        clearTimeout(this.worldStateTimeout);
      }
    });
    
    // Monitor for reconnection
    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`Reconnected after ${attemptNumber} attempts`);
      this.scene.addGameLogEntry?.('success', { 
        message: 'Connection restored', 
        type: 'success' 
      });
    });
    
    // Add ping/pong for latency monitoring
    this.socket.on('pong', (serverTime) => {
      const latency = Date.now() - serverTime;
      this.lastPing = latency;
      if (latency > 150) {
        console.warn(`[NETWORK] High ping: ${latency}ms`);
      }
    });
  }

  sendInput(input) {
    if (!this.socket || !this.socket.connected) return;
    
    const now = Date.now();
    
    // Check if input has changed
    const inputStr = JSON.stringify(input);
    const hasChanged = inputStr !== JSON.stringify(this.lastInput);
    
    // Only send if enough time has passed AND (input changed OR we need periodic update)
    if (now - this.lastInputSent >= this.inputSendRate) {
      // Always send if input changed, or send periodic update every 200ms
      if (hasChanged || now - this.lastInputSent >= 200) {
        this.socket.emit('playerInput', input);
        this.lastInputSent = now;
        this.lastInput = input;
      }
    }
  }

  startConnectionMonitoring() {
    // Clear existing interval if any
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    // Ping every 5 seconds to monitor connection health
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.connected) {
        const startTime = Date.now();
        this.socket.emit('ping');
        
        // If no pong received within 1 second, connection might be stalled
        setTimeout(() => {
          const timeSincePing = Date.now() - startTime;
          if (timeSincePing > 1000 && this.lastPing === 0) {
            console.warn('[NETWORK] No pong response - connection may be stalled');
          }
        }, 1000);
      }
    }, 5000);
  }
  
  stopConnectionMonitoring() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  handleFrozenConnection() {
    console.error('[NETWORK] Connection appears frozen, attempting recovery...');
    
    // Show warning to player
    this.scene.addGameLogEntry?.('error', { 
      message: 'Connection frozen - attempting to recover...', 
      type: 'error' 
    });
    
    // Force reconnect
    if (this.socket) {
      this.socket.disconnect();
      setTimeout(() => {
        this.socket.connect();
      }, 1000);
    }
  }

  renderWorld(state) {
    // Throttle DOM updates to 10Hz
    const now = Date.now();
    const shouldUpdateDOM = now - this._domUpdateTimer >= this._domUpdateRate;
    
    // Update PvE UI elements if present (throttled)
    if (state.wave && window.location.port === '3001') {
      // Store pending update
      this._pendingDomUpdates.wave = state.wave.current;
      
      if (shouldUpdateDOM) {
        // Cache wave element on first use
        if (!this._waveElement) {
          this._waveElement = document.getElementById('ui-wave-number');
        }
        if (this._waveElement && this._pendingDomUpdates.wave !== undefined) {
          this._waveElement.textContent = this._pendingDomUpdates.wave.toString();
        }
      }
    }
    
    // Store parties for party member checking
    this.parties = state.parties || {};
    
    // Render NPCs if present
    if (state.npcs) {
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
        
        // DELETED: Redundant username text creation was here.
        // The username is now handled directly on the player sprite in GameScene.
      }
      
      // Update position
      this.otherSprites[id].setPosition(player.x, player.y);
      // Update username position and color based on party status
      if (this.otherUsernames[id]) {
        this.otherUsernames[id].setPosition(player.x, player.y - 81);
        
        // DELETED: Redundant style update was here.
      }
      
      // Apply death visual effect
      if (player.isDead) {
        this.otherSprites[id].setAlpha(0.3);
        this.otherSprites[id].setScale(0.8);
      } else {
        this.otherSprites[id].setAlpha(1);
        this.otherSprites[id].setScale(1);
      }
      
      // Handle sprite textures and flipping - OPTIMIZED
      const sprite = this.otherSprites[id];
      const currentState = this._spriteTextureStates.get(id) || {};
      
      // Determine desired texture and flip state
      let desiredTexture, desiredFlipX, desiredTint;
      
      if (player.role === 'owner') {
        const runningKey = this.scene.textures.exists('stickman_owner_running') ? 'stickman_owner_running' : 'stickman_running';
        const idleKey = this.scene.textures.exists('stickman_owner') ? 'stickman_owner' : 'stickman';
        
        if (player.vx < 0) {
          desiredTexture = runningKey;
          desiredFlipX = true;
        } else if (player.vx > 0) {
          desiredTexture = runningKey;
          desiredFlipX = false;
        } else {
          desiredTexture = idleKey;
          desiredFlipX = false;
        }
        desiredTint = 0xffffff;
      } else if (player.role === 'mod') {
        if (player.vx < 0) {
          desiredTexture = 'stickman_running';
          desiredFlipX = true;
        } else if (player.vx > 0) {
          desiredTexture = 'stickman_running';
          desiredFlipX = false;
        } else {
          desiredTexture = 'stickman';
          desiredFlipX = false;
        }
        desiredTint = 0xffe066; // Gold for mod
      } else {
        if (player.vx < 0) {
          desiredTexture = 'stickman_running';
          desiredFlipX = true;
        } else if (player.vx > 0) {
          desiredTexture = 'stickman_running';
          desiredFlipX = false;
        } else {
          desiredTexture = 'stickman';
          desiredFlipX = false;
        }
        desiredTint = 0xffffff;
      }
      
      // Only update sprite properties if they changed
      if (currentState.texture !== desiredTexture) {
        sprite.setTexture(desiredTexture);
        currentState.texture = desiredTexture;
      }
      if (currentState.flipX !== desiredFlipX) {
        sprite.setFlipX(desiredFlipX);
        currentState.flipX = desiredFlipX;
      }
      if (currentState.tint !== desiredTint) {
        sprite.setTint(desiredTint);
        currentState.tint = desiredTint;
      }
      
      // Store updated state
      this._spriteTextureStates.set(id, currentState);
    }
    
    // Remove sprites for players that have left
    for (const id in this.otherSprites) {
      if (!seen[id]) {
        // Remove sprite and corresponding text
        if (this.otherSprites[id]) {
          this.otherSprites[id].destroy();
          delete this.otherSprites[id];
        }
      }
    }
    
    // Update DOM timer if we performed DOM updates
    if (shouldUpdateDOM) {
      this._domUpdateTimer = now;
    }
  }
  
  renderNPCs(npcs) {
    const seenNPCs = {};
    
    for (const id in npcs) {
      const npc = npcs[id];
      seenNPCs[id] = true;
      
      // Create NPC sprite if it doesn't exist
      if (!this.npcSprites[id]) {
        
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
        
        // Check if texture exists
        if (!this.scene.textures.exists(spriteKey)) {
          console.error('[NPC RENDER] Texture not found:', spriteKey);
          return;
        }
        
        // Create NPC sprite with proper image
        this.npcSprites[id] = this.scene.add.sprite(npc.x, npc.y, spriteKey)
          .setOrigin(0.5, 1)
          .setDepth(100) // Ensure NPCs are visible above ground
          .setScrollFactor(1, 1); // Ensure it scrolls with camera;
        
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