import GameScene from './GameScene.js';
import Multiplayer from '../multiplayer/Multiplayer.js';
import Player from '../entities/Player.js';
import Bullet from '../entities/Bullet.js';
import GameUI from '../ui/GameUI.js';
import PartyUI from '../ui/PartyUI.js';

export default class MobileGameScene extends GameScene {
    constructor() {
        super({ key: 'MobileGameScene' });
        this.isMobile = true;
        
        // Mobile-specific settings
        this.cameraZoom = 0.8; // Zoom out more for better visibility
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.buildMode = false;
        this.selectedBlock = 'wall';
    }
    
    create() {
        // Set mobile game scene reference
        window.mobileGameScene = this;
        
        // Initialize base game scene
        super.create();
        
        // Mobile-specific camera setup
        this.cameras.main.setZoom(this.cameraZoom);
        
        // Hide desktop UI elements
        if (this.gameUI) {
            this.gameUI.hideDesktopElements();
        }
        
        // Setup touch controls for aiming
        this.setupTouchAiming();
        
        // Setup pinch zoom
        this.setupPinchZoom();
        
        // Adjust UI for mobile
        this.adjustMobileUI();
    }
    
    setupTouchAiming() {
        // Track touch position for aiming
        this.input.on('pointerdown', (pointer) => {
            // Only process touches outside of control areas
            if (pointer.x < 200 || pointer.x > this.game.config.width - 200) {
                return;
            }
            
            this.touchStartX = pointer.x;
            this.touchStartY = pointer.y;
        });
        
        this.input.on('pointermove', (pointer) => {
            if (!this.playerSprite || !pointer.isDown) return;
            
            // Calculate aim angle based on touch position
            const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            const angle = Math.atan2(
                worldPoint.y - this.playerSprite.y,
                worldPoint.x - this.playerSprite.x
            );
            
            // Update aim angle
            if (this.multiplayer) {
                this.multiplayer.setAimAngle(angle);
            }
        });
    }
    
    setupPinchZoom() {
        let initialDistance = 0;
        let initialZoom = this.cameraZoom;
        
        this.input.on('pointerdown', () => {
            if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
                const dx = this.input.pointer1.x - this.input.pointer2.x;
                const dy = this.input.pointer1.y - this.input.pointer2.y;
                initialDistance = Math.sqrt(dx * dx + dy * dy);
                initialZoom = this.cameras.main.zoom;
            }
        });
        
        this.input.on('pointermove', () => {
            if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
                const dx = this.input.pointer1.x - this.input.pointer2.x;
                const dy = this.input.pointer1.y - this.input.pointer2.y;
                const currentDistance = Math.sqrt(dx * dx + dy * dy);
                
                const zoomDelta = (currentDistance - initialDistance) / 200;
                const newZoom = Phaser.Math.Clamp(initialZoom + zoomDelta, 0.5, 1.2);
                
                this.cameras.main.setZoom(newZoom);
                this.cameraZoom = newZoom;
            }
        });
    }
    
    adjustMobileUI() {
        // Adjust UI panel width for mobile
        if (this.gameUI && this.gameUI.panel) {
            this.gameUI.panel.style.width = '100%';
            this.gameUI.panel.style.left = '0';
            this.gameUI.panel.style.bottom = '0';
            this.gameUI.panel.style.height = 'auto';
            this.gameUI.panel.style.maxHeight = '200px';
            this.gameUI.panel.style.overflowY = 'auto';
        }
        
        // Hide certain desktop-only elements
        const elementsToHide = [
            'coords-display',
            'minimap',
            'command-input'
        ];
        
        elementsToHide.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = 'none';
            }
        });
    }
    
    update(time, delta) {
        // Get mobile input
        const mobileInput = window.mobileControls.getMovementInput();
        
        // Convert joystick input to movement keys
        const keys = {
            left: { isDown: mobileInput.x < -0.3 },
            right: { isDown: mobileInput.x > 0.3 },
            up: { isDown: mobileInput.y < -0.3 },
            space: { isDown: window.mobileControls.isButtonPressed('jump') }
        };
        
        // Override cursor keys with mobile input
        this.cursors = keys;
        
        // Call parent update
        super.update(time, delta);
        
        // Update mobile UI
        if (this.playerSprite) {
            const weapon = this.playerSprite.currentWeapon || 'fist';
            const ammo = this.playerSprite.ammo || -1;
            window.updateMobileUI(
                this.playerSprite.health,
                this.playerSprite.maxHealth,
                weapon,
                ammo
            );
        }
    }
    
    // Mobile-specific methods
    handleShoot() {
        if (!this.playerSprite || this.playerSprite.isDead) return;
        
        // Trigger shoot action
        this.playerSprite.isShooting = true;
        
        // Auto-release after a short delay
        this.time.delayedCall(100, () => {
            if (this.playerSprite) {
                this.playerSprite.isShooting = false;
            }
        });
    }
    
    handleJump() {
        if (!this.playerSprite || this.playerSprite.isDead) return;
        
        // Trigger jump
        if (this.playerSprite.body.touching.down) {
            this.playerSprite.setVelocityY(-800);
        }
    }
    
    toggleBuildMode() {
        this.buildMode = !this.buildMode;
        
        if (this.buildMode) {
            // Show building UI
            this.showMobileBuildingUI();
        } else {
            // Hide building UI
            this.hideMobileBuildingUI();
        }
    }
    
    showMobileBuildingUI() {
        // Create mobile building selector
        const buildUI = document.createElement('div');
        buildUI.id = 'mobile-build-ui';
        buildUI.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            padding: 10px;
            border-radius: 10px;
            display: flex;
            gap: 10px;
            z-index: 1001;
        `;
        
        const blocks = ['wall', 'door', 'wood', 'castle_tower'];
        blocks.forEach(block => {
            const btn = document.createElement('div');
            btn.style.cssText = `
                width: 50px;
                height: 50px;
                background-image: url('/assets/blocks/${block}.png');
                background-size: cover;
                border: 2px solid ${this.selectedBlock === block ? '#ffd700' : '#666'};
                border-radius: 5px;
            `;
            
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.selectedBlock = block;
                this.updateBuildUISelection();
            });
            
            buildUI.appendChild(btn);
        });
        
        document.body.appendChild(buildUI);
        
        // Add placement indicator
        this.buildIndicator = this.add.image(0, 0, `block_${this.selectedBlock}`);
        this.buildIndicator.setAlpha(0.5);
        this.buildIndicator.setDepth(1000);
    }
    
    hideMobileBuildingUI() {
        const buildUI = document.getElementById('mobile-build-ui');
        if (buildUI) {
            buildUI.remove();
        }
        
        if (this.buildIndicator) {
            this.buildIndicator.destroy();
            this.buildIndicator = null;
        }
    }
    
    updateBuildUISelection() {
        const buildUI = document.getElementById('mobile-build-ui');
        if (!buildUI) return;
        
        const buttons = buildUI.children;
        const blocks = ['wall', 'door', 'wood', 'castle_tower'];
        
        for (let i = 0; i < buttons.length; i++) {
            buttons[i].style.border = `2px solid ${blocks[i] === this.selectedBlock ? '#ffd700' : '#666'}`;
        }
    }
    
    toggleInventory() {
        if (this.inventoryUI) {
            this.inventoryUI.toggle();
        }
    }
    
    toggleChat() {
        // Create simple mobile chat interface
        const existingChat = document.getElementById('mobile-chat');
        if (existingChat) {
            existingChat.remove();
            return;
        }
        
        const chatUI = document.createElement('div');
        chatUI.id = 'mobile-chat';
        chatUI.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 200px;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            z-index: 1002;
        `;
        
        const messages = document.createElement('div');
        messages.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 10px;
            color: white;
            font-size: 14px;
        `;
        
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = `
            display: flex;
            padding: 10px;
            gap: 10px;
        `;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Type message...';
        input.style.cssText = `
            flex: 1;
            padding: 10px;
            border: none;
            border-radius: 5px;
            font-size: 16px;
        `;
        
        const sendBtn = document.createElement('button');
        sendBtn.textContent = 'Send';
        sendBtn.style.cssText = `
            padding: 10px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 16px;
        `;
        
        sendBtn.addEventListener('click', () => {
            if (input.value.trim()) {
                this.sendChatMessage(input.value);
                input.value = '';
            }
        });
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendBtn.click();
            }
        });
        
        inputContainer.appendChild(input);
        inputContainer.appendChild(sendBtn);
        
        chatUI.appendChild(messages);
        chatUI.appendChild(inputContainer);
        
        document.body.appendChild(chatUI);
        
        // Focus input
        input.focus();
        
        // Copy existing chat messages
        const existingMessages = document.querySelectorAll('#chat-messages .chat-message');
        existingMessages.forEach(msg => {
            const msgClone = msg.cloneNode(true);
            messages.appendChild(msgClone);
        });
        
        // Scroll to bottom
        messages.scrollTop = messages.scrollHeight;
    }
    
    // Override to prevent desktop keybindings
    setupKeybindings() {
        // Minimal keybindings for mobile
        this.input.keyboard.on('keydown-ESC', () => {
            if (this.buildMode) {
                this.toggleBuildMode();
            }
        });
    }
}