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
  }

  connect(username) {
    this.username = username;
    
    // Determine the socket URL based on current location
    let socketUrl = '';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      socketUrl = `http://${window.location.hostname}:3000`;
    } else {
      // For production, use the same protocol as the page
      socketUrl = `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}`;
    }
    
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
        this.otherUsernames[id] = this.scene.add.text(player.x, player.y - 50, player.username.charAt(0).toUpperCase() + player.username.slice(1), {
          fontSize: '16px',
          fontFamily: 'Arial',
          color: '#ffffff',
          backgroundColor: '#00000080',
          padding: { x: 4, y: 2 }
        }).setOrigin(0.5, 0.5).setDepth(1000).setY(player.y - 81);
      }
      
      // Update position
      this.otherSprites[id].setPosition(player.x, player.y);
      // Update username position
      if (this.otherUsernames[id]) {
        this.otherUsernames[id].setPosition(player.x, player.y - 81);
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
} 