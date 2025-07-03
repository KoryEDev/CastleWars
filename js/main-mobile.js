// Main entry point for mobile version
import { LoginScene } from './scenes/LoginScene.js';
import MobileGameScene from './scenes/MobileGameScene.js';
import MobileTransitionScene from './scenes/MobileTransitionScene.js';

// Mobile-specific configuration
const config = {
    type: Phaser.AUTO,
    parent: 'game',
    width: window.innerWidth,
    height: window.innerHeight,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        min: {
            width: 320,
            height: 480
        },
        max: {
            width: 1024,
            height: 768
        }
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 2000 },
            debug: false
        }
    },
    dom: {
        createContainer: true
    },
    render: {
        antialias: false,
        pixelArt: true,
        powerPreference: 'low-power' // Optimize for mobile battery life
    },
    scene: [LoginScene, MobileTransitionScene, MobileGameScene]
};

// Initialize the game
const game = new Phaser.Game(config);

// Handle orientation changes
window.addEventListener('orientationchange', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});

// Prevent scrolling and zooming on mobile
document.addEventListener('touchmove', function(e) {
    e.preventDefault();
}, { passive: false });

document.addEventListener('gesturestart', function(e) {
    e.preventDefault();
});

// Virtual joystick implementation
class VirtualJoystick {
    constructor() {
        this.container = document.getElementById('joystick-container');
        this.base = document.getElementById('joystick-base');
        this.stick = document.getElementById('joystick-stick');
        
        this.active = false;
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.currentY = 0;
        this.stickDistance = 0;
        this.stickAngle = 0;
        
        this.maxDistance = 50; // Maximum stick movement radius
        
        this.setupEvents();
    }
    
    setupEvents() {
        // Touch start
        this.container.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.container.getBoundingClientRect();
            
            this.active = true;
            this.startX = touch.clientX - rect.left;
            this.startY = touch.clientY - rect.top;
            
            // Reset stick to center
            this.updateStickPosition(0, 0);
        });
        
        // Touch move
        this.container.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!this.active) return;
            
            const touch = e.touches[0];
            const rect = this.container.getBoundingClientRect();
            
            const currentX = touch.clientX - rect.left;
            const currentY = touch.clientY - rect.top;
            
            const deltaX = currentX - this.startX;
            const deltaY = currentY - this.startY;
            
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const angle = Math.atan2(deltaY, deltaX);
            
            // Limit stick movement to maxDistance
            this.stickDistance = Math.min(distance, this.maxDistance);
            this.stickAngle = angle;
            
            const limitedX = Math.cos(angle) * this.stickDistance;
            const limitedY = Math.sin(angle) * this.stickDistance;
            
            this.updateStickPosition(limitedX, limitedY);
        });
        
        // Touch end
        const touchEnd = () => {
            this.active = false;
            this.stickDistance = 0;
            this.stickAngle = 0;
            this.updateStickPosition(0, 0);
        };
        
        this.container.addEventListener('touchend', touchEnd);
        this.container.addEventListener('touchcancel', touchEnd);
    }
    
    updateStickPosition(x, y) {
        this.stick.style.transform = `translate(${x + 45}px, ${y + 45}px)`;
    }
    
    getInput() {
        if (!this.active || this.stickDistance < 10) {
            return { x: 0, y: 0 };
        }
        
        // Convert to normalized input (-1 to 1)
        const x = Math.cos(this.stickAngle) * (this.stickDistance / this.maxDistance);
        const y = Math.sin(this.stickAngle) * (this.stickDistance / this.maxDistance);
        
        return { x, y };
    }
}

// Action button handlers
class MobileControls {
    constructor() {
        this.joystick = new VirtualJoystick();
        this.buttonsPressed = {
            shoot: false,
            jump: false,
            build: false
        };
        
        this.setupActionButtons();
        this.setupMenuButtons();
    }
    
    setupActionButtons() {
        // Shoot button
        const shootBtn = document.getElementById('shoot-button');
        shootBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.buttonsPressed.shoot = true;
            if (window.mobileGameScene) {
                window.mobileGameScene.handleShoot();
            }
        });
        
        shootBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.buttonsPressed.shoot = false;
        });
        
        // Jump button
        const jumpBtn = document.getElementById('jump-button');
        jumpBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.buttonsPressed.jump = true;
            if (window.mobileGameScene) {
                window.mobileGameScene.handleJump();
            }
        });
        
        jumpBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.buttonsPressed.jump = false;
        });
        
        // Build button
        const buildBtn = document.getElementById('build-button');
        buildBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.buttonsPressed.build = true;
            if (window.mobileGameScene) {
                window.mobileGameScene.toggleBuildMode();
            }
        });
        
        buildBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.buttonsPressed.build = false;
        });
    }
    
    setupMenuButtons() {
        // Inventory button
        document.getElementById('inventory-button').addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (window.mobileGameScene) {
                window.mobileGameScene.toggleInventory();
            }
        });
        
        // Chat button
        document.getElementById('chat-button').addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (window.mobileGameScene) {
                window.mobileGameScene.toggleChat();
            }
        });
    }
    
    getMovementInput() {
        return this.joystick.getInput();
    }
    
    isButtonPressed(button) {
        return this.buttonsPressed[button] || false;
    }
}

// Initialize mobile controls
window.mobileControls = new MobileControls();

// Update mobile UI elements
function updateMobileUI(health, maxHealth, weapon, ammo) {
    document.getElementById('mobile-health').textContent = `${health}/${maxHealth}`;
    document.getElementById('mobile-weapon').textContent = weapon.toUpperCase();
    document.getElementById('mobile-ammo').textContent = ammo === -1 ? '∞' : ammo;
}

// Export for use in scenes
window.updateMobileUI = updateMobileUI;