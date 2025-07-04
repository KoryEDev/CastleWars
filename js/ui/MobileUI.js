export class MobileUI {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.elements = {};
        this.touchControls = {};
        this.joystick = null;
        this.buttons = {};
        this.quickMenuOpen = false;
        this.quickMenuOverlay = null;
        
        this.create();
    }
    
    create() {
        // Create main container
        this.container = document.createElement('div');
        this.container.id = 'mobile-ui';
        this.container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
        `;
        document.body.appendChild(this.container);
        
        // Create top HUD (health, ammo, weapon)
        this.createTopHUD();
        
        // Create virtual joystick
        this.createJoystick();
        
        // Create action buttons
        this.createActionButtons();
        
        // Create quick menu button
        this.createQuickMenu();
        
        // Apply mobile styles
        this.applyMobileStyles();
    }
    
    createTopHUD() {
        const hud = document.createElement('div');
        hud.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            right: 10px;
            height: 50px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            pointer-events: none;
        `;
        
        // Health bar
        const healthContainer = document.createElement('div');
        healthContainer.style.cssText = `
            background: rgba(0, 0, 0, 0.5);
            border-radius: 25px;
            padding: 5px 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        const healthIcon = document.createElement('span');
        healthIcon.innerHTML = '❤️';
        healthIcon.style.fontSize = '20px';
        
        const healthBar = document.createElement('div');
        healthBar.style.cssText = `
            width: 80px;
            height: 10px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 5px;
            overflow: hidden;
            position: relative;
        `;
        
        const healthFill = document.createElement('div');
        healthFill.id = 'mobile-health-fill';
        healthFill.style.cssText = `
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: #ff6b6b;
            transition: width 0.3s;
        `;
        healthBar.appendChild(healthFill);
        
        const healthText = document.createElement('span');
        healthText.id = 'mobile-health-text';
        healthText.style.cssText = `
            color: white;
            font-size: 14px;
            font-weight: bold;
            min-width: 30px;
        `;
        healthText.textContent = '100';
        
        healthContainer.appendChild(healthIcon);
        healthContainer.appendChild(healthBar);
        healthContainer.appendChild(healthText);
        
        // Weapon/ammo display
        const weaponContainer = document.createElement('div');
        weaponContainer.style.cssText = `
            background: rgba(0, 0, 0, 0.5);
            border-radius: 25px;
            padding: 5px 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        const weaponName = document.createElement('span');
        weaponName.id = 'mobile-weapon-name';
        weaponName.style.cssText = `
            color: white;
            font-size: 14px;
            font-weight: bold;
        `;
        weaponName.textContent = 'FIST';
        
        const ammoText = document.createElement('span');
        ammoText.id = 'mobile-ammo-text';
        ammoText.style.cssText = `
            color: #ffd700;
            font-size: 14px;
        `;
        ammoText.textContent = '∞';
        
        weaponContainer.appendChild(weaponName);
        weaponContainer.appendChild(ammoText);
        
        hud.appendChild(healthContainer);
        hud.appendChild(weaponContainer);
        this.container.appendChild(hud);
        
        this.elements.healthFill = healthFill;
        this.elements.healthText = healthText;
        this.elements.weaponName = weaponName;
        this.elements.ammoText = ammoText;
    }
    
    createJoystick() {
        const joystickContainer = document.createElement('div');
        joystickContainer.style.cssText = `
            position: absolute;
            bottom: 80px;
            left: 30px;
            width: 140px;
            height: 140px;
            pointer-events: auto;
        `;
        
        const joystickBase = document.createElement('div');
        joystickBase.style.cssText = `
            position: absolute;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            box-shadow: 0 0 20px rgba(0,0,0,0.5);
        `;
        
        const joystickStick = document.createElement('div');
        joystickStick.style.cssText = `
            position: absolute;
            width: 50px;
            height: 50px;
            background: radial-gradient(circle, rgba(255,255,255,0.8), rgba(255,255,255,0.4));
            border-radius: 50%;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            border: 2px solid rgba(255,255,255,0.5);
        `;
        
        joystickContainer.appendChild(joystickBase);
        joystickContainer.appendChild(joystickStick);
        this.container.appendChild(joystickContainer);
        
        // Store references
        this.joystick = {
            container: joystickContainer,
            base: joystickBase,
            stick: joystickStick,
            active: false,
            startX: 0,
            startY: 0
        };
        
        // Setup joystick controls
        this.setupJoystickControls();
    }
    
    createActionButtons() {
        // Jump button
        const jumpBtn = this.createButton({
            id: 'jump',
            icon: '⬆️',
            bottom: '140px',
            right: '30px',
            color: 'rgba(100, 150, 255, 0.7)',
            size: 70
        });
        
        // Shoot button
        const shootBtn = this.createButton({
            id: 'shoot',
            icon: '🔫',
            bottom: '80px',
            right: '110px',
            color: 'rgba(255, 100, 100, 0.7)',
            size: 80
        });
        
        // Build button
        const buildBtn = this.createButton({
            id: 'build',
            icon: '🏗️',
            bottom: '30px',
            right: '30px',
            color: 'rgba(100, 255, 100, 0.7)',
            size: 60
        });
        
        // Add aim assist area for mobile
        this.createAimArea();
    }
    
    createAimArea() {
        const aimArea = document.createElement('div');
        aimArea.id = 'mobile-aim-area';
        aimArea.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 60%;
            height: 60%;
            pointer-events: auto;
            z-index: 1;
        `;
        
        let touchId = null;
        let centerX = 0;
        let centerY = 0;
        
        const handleAimStart = (e) => {
            if (touchId !== null) return;
            const touch = e.touches[0];
            touchId = touch.identifier;
            const rect = aimArea.getBoundingClientRect();
            centerX = rect.left + rect.width / 2;
            centerY = rect.top + rect.height / 2;
        };
        
        const handleAimMove = (e) => {
            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];
                if (touch.identifier === touchId) {
                    const deltaX = touch.clientX - centerX;
                    const deltaY = touch.clientY - centerY;
                    this.touchControls.aimAngle = Math.atan2(deltaY, deltaX);
                    break;
                }
            }
        };
        
        const handleAimEnd = (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === touchId) {
                    touchId = null;
                    break;
                }
            }
        };
        
        aimArea.addEventListener('touchstart', handleAimStart, { passive: true });
        aimArea.addEventListener('touchmove', handleAimMove, { passive: true });
        aimArea.addEventListener('touchend', handleAimEnd, { passive: true });
        aimArea.addEventListener('touchcancel', handleAimEnd, { passive: true });
        
        this.container.appendChild(aimArea);
    }
    
    createButton(config) {
        const size = config.size || 60;
        const button = document.createElement('div');
        button.id = `mobile-${config.id}-btn`;
        button.style.cssText = `
            position: absolute;
            bottom: ${config.bottom};
            right: ${config.right};
            width: ${size}px;
            height: ${size}px;
            background: ${config.color};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${size * 0.4}px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            pointer-events: auto;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            transition: transform 0.1s;
            border: 2px solid rgba(255,255,255,0.3);
        `;
        button.innerHTML = config.icon;
        
        // Touch feedback
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            button.style.transform = 'scale(0.9)';
            this.handleButtonPress(config.id, true);
        });
        
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            button.style.transform = 'scale(1)';
            this.handleButtonPress(config.id, false);
        });
        
        this.container.appendChild(button);
        this.buttons[config.id] = button;
        return button;
    }
    
    createQuickMenu() {
        const menuBtn = document.createElement('div');
        menuBtn.style.cssText = `
            position: absolute;
            top: 70px;
            right: 10px;
            width: 50px;
            height: 50px;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            pointer-events: auto;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
        `;
        menuBtn.innerHTML = '☰';
        
        menuBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.toggleQuickMenu();
        });
        
        this.container.appendChild(menuBtn);
    }
    
    setupJoystickControls() {
        const { container, stick } = this.joystick;
        let active = false;
        let startX = 0;
        let startY = 0;
        const maxDistance = 50; // Maximum joystick movement radius
        
        const handleStart = (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = container.getBoundingClientRect();
            active = true;
            startX = touch.clientX - rect.left - 60; // Center of joystick
            startY = touch.clientY - rect.top - 60;
            this.joystick.active = true;
        };
        
        const handleMove = (e) => {
            if (!active) return;
            e.preventDefault();
            
            const touch = e.touches[0];
            const rect = container.getBoundingClientRect();
            const currentX = touch.clientX - rect.left - 60;
            const currentY = touch.clientY - rect.top - 60;
            
            let deltaX = currentX - startX;
            let deltaY = currentY - startY;
            
            // Limit to max distance
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            if (distance > maxDistance) {
                const angle = Math.atan2(deltaY, deltaX);
                deltaX = Math.cos(angle) * maxDistance;
                deltaY = Math.sin(angle) * maxDistance;
            }
            
            // Move the stick
            stick.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;
            
            // Update movement values
            this.touchControls.moveX = deltaX / maxDistance;
            this.touchControls.moveY = deltaY / maxDistance;
        };
        
        const handleEnd = () => {
            active = false;
            this.joystick.active = false;
            stick.style.transform = 'translate(-50%, -50%)';
            this.touchControls.moveX = 0;
            this.touchControls.moveY = 0;
        };
        
        container.addEventListener('touchstart', handleStart);
        container.addEventListener('touchmove', handleMove);
        container.addEventListener('touchend', handleEnd);
        container.addEventListener('touchcancel', handleEnd);
    }
    
    handleButtonPress(buttonId, pressed) {
        switch (buttonId) {
            case 'jump':
                this.touchControls.jump = pressed;
                break;
            case 'shoot':
                this.touchControls.shoot = pressed;
                break;
            case 'build':
                if (pressed) {
                    this.touchControls.build = !this.touchControls.build;
                    this.buttons.build.style.opacity = this.touchControls.build ? '1' : '0.7';
                }
                break;
        }
    }
    
    toggleQuickMenu() {
        if (this.quickMenuOpen) {
            this.closeQuickMenu();
        } else {
            this.openQuickMenu();
        }
    }
    
    openQuickMenu() {
        this.quickMenuOpen = true;
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'mobile-quick-menu';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            z-index: 2000;
            display: flex;
            flex-direction: column;
            padding: 20px;
            pointer-events: auto;
        `;
        
        // Create menu container
        const menuContainer = document.createElement('div');
        menuContainer.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 20px;
            max-width: 600px;
            margin: 0 auto;
            width: 100%;
        `;
        
        // Title
        const title = document.createElement('h2');
        title.textContent = 'Quick Menu';
        title.style.cssText = `
            color: #ffd700;
            text-align: center;
            font-size: 28px;
            margin: 0 0 20px 0;
        `;
        menuContainer.appendChild(title);
        
        // Menu buttons
        const menuButtons = [
            { text: 'Inventory', icon: '🎒', action: () => this.showMobileInventory() },
            { text: 'Chat', icon: '💬', action: () => this.showMobileChat() },
            { text: 'Stats', icon: '📊', action: () => this.showMobileStats() },
            { text: 'Settings', icon: '⚙️', action: () => console.log('Settings') },
            { text: 'Close', icon: '❌', action: () => this.closeQuickMenu() }
        ];
        
        menuButtons.forEach(btn => {
            const button = document.createElement('div');
            button.style.cssText = `
                background: rgba(255, 255, 255, 0.1);
                padding: 20px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                gap: 15px;
                font-size: 20px;
                color: white;
                border: 2px solid rgba(255, 255, 255, 0.2);
                transition: all 0.2s;
                pointer-events: auto;
            `;
            
            button.innerHTML = `<span style="font-size: 30px;">${btn.icon}</span><span>${btn.text}</span>`;
            
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                button.style.background = 'rgba(255, 255, 255, 0.2)';
                button.style.transform = 'scale(0.95)';
            });
            
            button.addEventListener('touchend', (e) => {
                e.preventDefault();
                button.style.background = 'rgba(255, 255, 255, 0.1)';
                button.style.transform = 'scale(1)';
                btn.action();
            });
            
            menuContainer.appendChild(button);
        });
        
        overlay.appendChild(menuContainer);
        document.body.appendChild(overlay);
        this.quickMenuOverlay = overlay;
    }
    
    closeQuickMenu() {
        this.quickMenuOpen = false;
        if (this.quickMenuOverlay) {
            this.quickMenuOverlay.remove();
            this.quickMenuOverlay = null;
        }
    }
    
    showMobileInventory() {
        this.closeQuickMenu();
        console.log('Show mobile inventory');
        // TODO: Implement mobile inventory UI
    }
    
    showMobileChat() {
        this.closeQuickMenu();
        console.log('Show mobile chat');
        // TODO: Implement mobile chat UI
    }
    
    showMobileStats() {
        this.closeQuickMenu();
        console.log('Show mobile stats');
        // TODO: Implement mobile stats UI
    }
    
    applyMobileStyles() {
        // Inject mobile-specific CSS
        const style = document.createElement('style');
        style.innerHTML = `
            /* Hide desktop UI elements on mobile */
            #game-ui-panel, #gameUI, .game-ui-panel, #inventory-panel, #chat-container, #help-button {
                display: none !important;
            }
            
            /* Ensure game canvas uses full screen */
            #game {
                width: 100vw !important;
                height: 100vh !important;
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
            }
            
            #game canvas {
                width: 100% !important;
                height: 100% !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
            }
            
            /* Prevent scrolling and bouncing on mobile */
            body {
                overflow: hidden;
                position: fixed;
                width: 100%;
                height: 100%;
                -webkit-user-select: none;
                user-select: none;
                touch-action: none;
                margin: 0;
                padding: 0;
            }
            
            /* Mobile UI font */
            #mobile-ui {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            }
            
            /* Ensure mobile UI is on top */
            #mobile-ui {
                z-index: 10000 !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    update() {
        // Update HUD elements
        if (this.scene.playerSprite) {
            const player = this.scene.playerSprite;
            
            // Update health
            const healthPercent = (player.health / player.maxHealth) * 100;
            this.elements.healthFill.style.width = healthPercent + '%';
            this.elements.healthText.textContent = Math.round(player.health);
            
            // Update weapon and ammo
            const weapon = player.currentWeapon || 'fist';
            this.elements.weaponName.textContent = weapon.toUpperCase();
            
            if (player.ammo !== undefined && player.ammo !== -1) {
                this.elements.ammoText.textContent = player.ammo;
            } else {
                this.elements.ammoText.textContent = '∞';
            }
        }
    }
    
    getMovement() {
        return {
            x: this.touchControls.moveX || 0,
            y: this.touchControls.moveY || 0
        };
    }
    
    getAimAngle() {
        return this.touchControls.aimAngle || 0;
    }
    
    isJumping() {
        return this.touchControls.jump || false;
    }
    
    isShooting() {
        return this.touchControls.shoot || false;
    }
    
    isBuildMode() {
        return this.touchControls.build || false;
    }
    
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}