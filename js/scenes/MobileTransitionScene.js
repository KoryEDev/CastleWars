import TransitionScene from './TransitionScene.js';

export default class MobileTransitionScene extends TransitionScene {
    constructor() {
        super({ key: 'MobileTransitionScene' });
    }
    
    create() {
        // Get server type from data
        const serverType = this.data.get('serverType') || 'pvp';
        
        // Set background color
        this.cameras.main.setBackgroundColor(0x000000);
        
        // Add mobile-friendly loading text
        const loadingText = this.add.text(
            this.game.config.width / 2,
            this.game.config.height / 2 - 50,
            'Loading Mobile Version...',
            {
                fontSize: '24px',
                fill: '#ffffff',
                fontFamily: 'Arial'
            }
        ).setOrigin(0.5);
        
        // Add server type text
        const serverText = this.add.text(
            this.game.config.width / 2,
            this.game.config.height / 2,
            `Connecting to ${serverType.toUpperCase()} Server`,
            {
                fontSize: '18px',
                fill: '#aaaaaa',
                fontFamily: 'Arial'
            }
        ).setOrigin(0.5);
        
        // Add touch tips
        const tips = [
            'Use the joystick to move',
            'Tap buttons to jump, shoot, and build',
            'Pinch to zoom in/out',
            'Tap the inventory button to manage items'
        ];
        
        const tipText = this.add.text(
            this.game.config.width / 2,
            this.game.config.height / 2 + 100,
            tips[0],
            {
                fontSize: '16px',
                fill: '#888888',
                fontFamily: 'Arial',
                align: 'center',
                wordWrap: { width: this.game.config.width - 40 }
            }
        ).setOrigin(0.5);
        
        // Cycle through tips
        let tipIndex = 0;
        this.time.addEvent({
            delay: 2000,
            loop: true,
            callback: () => {
                tipIndex = (tipIndex + 1) % tips.length;
                tipText.setText(tips[tipIndex]);
            }
        });
        
        // Add loading spinner
        const spinner = this.add.graphics();
        let angle = 0;
        
        this.time.addEvent({
            delay: 50,
            loop: true,
            callback: () => {
                spinner.clear();
                spinner.lineStyle(3, 0xffffff, 1);
                
                const x = this.game.config.width / 2;
                const y = this.game.config.height / 2 + 50;
                const radius = 20;
                
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2 + angle;
                    const alpha = 1 - (i / 8) * 0.7;
                    
                    spinner.lineStyle(3, 0xffffff, alpha);
                    spinner.beginPath();
                    spinner.arc(x, y, radius, a, a + 0.5);
                    spinner.strokePath();
                }
                
                angle += 0.1;
            }
        });
        
        // Transition to mobile game scene after a short delay
        this.time.delayedCall(2000, () => {
            const username = this.data.get('username');
            this.scene.start('MobileGameScene', { serverType, username });
        });
        
        // Handle window resize
        this.scale.on('resize', this.resize, this);
    }
    
    resize(gameSize) {
        const width = gameSize.width;
        const height = gameSize.height;
        
        this.cameras.main.setSize(width, height);
        
        // Reposition elements
        const texts = this.children.list.filter(child => child.type === 'Text');
        texts.forEach(text => {
            text.x = width / 2;
        });
    }
}