// FloatingTextManager.js
// Centralized manager for all floating/popup texts to ensure proper cleanup

export class FloatingTextManager {
  constructor(scene) {
    this.scene = scene;
    this.activeTexts = new Map();
    this.textIdCounter = 0;
    
    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 2000); // Check every 2 seconds
  }
  
  createFloatingText(config) {
    const {
      x,
      y,
      text,
      style = {},
      duration = 2000,
      animation = 'fadeUp',
      onComplete = null
    } = config;
    
    // Generate unique ID
    const textId = `floating_${this.textIdCounter++}`;
    
    // Default style
    const defaultStyle = {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    };
    
    // Create text object
    const textObj = this.scene.add.text(x, y, text, {
      ...defaultStyle,
      ...style
    });
    
    // Mark as floating text
    textObj.isFloatingText = true;
    textObj.textId = textId;
    textObj.createTime = Date.now();
    textObj.maxDuration = duration + 1000; // Add buffer
    
    // Set depth
    if (config.depth !== undefined) {
      textObj.setDepth(config.depth);
    } else {
      textObj.setDepth(10000);
    }
    
    // Set scroll factor if needed
    if (config.scrollFactor !== undefined) {
      textObj.setScrollFactor(config.scrollFactor);
    }
    
    // Track the text
    this.activeTexts.set(textId, {
      text: textObj,
      createTime: Date.now(),
      duration: duration,
      tween: null
    });
    
    // Apply animation
    let tween = null;
    switch (animation) {
      case 'fadeUp':
        tween = this.scene.tweens.add({
          targets: textObj,
          y: y - 40,
          alpha: 0,
          duration: duration,
          ease: 'Power2',
          onComplete: () => this.destroyText(textId, onComplete)
        });
        break;
        
      case 'fadeOut':
        tween = this.scene.tweens.add({
          targets: textObj,
          alpha: 0,
          duration: duration,
          ease: 'Power2',
          onComplete: () => this.destroyText(textId, onComplete)
        });
        break;
        
      case 'scale':
        tween = this.scene.tweens.add({
          targets: textObj,
          scaleX: 1.2,
          scaleY: 1.2,
          alpha: 0,
          duration: duration,
          ease: 'Power2',
          onComplete: () => this.destroyText(textId, onComplete)
        });
        break;
        
      default:
        // No animation, just destroy after duration
        this.scene.time.delayedCall(duration, () => {
          this.destroyText(textId, onComplete);
        });
    }
    
    // Store tween reference
    if (tween && this.activeTexts.has(textId)) {
      this.activeTexts.get(textId).tween = tween;
    }
    
    // Absolute failsafe
    this.scene.time.delayedCall(duration + 2000, () => {
      this.destroyText(textId);
    });
    
    return textObj;
  }
  
  destroyText(textId, callback = null) {
    const textData = this.activeTexts.get(textId);
    if (!textData) return;
    
    // Clean up tweens first
    if (textData.text && this.scene.cleanupTweensOnObject) {
      this.scene.cleanupTweensOnObject(textData.text);
    }
    
    // Destroy text
    if (textData.text && textData.text.active) {
      textData.text.destroy();
    }
    
    // Remove tween (fallback)
    if (textData.tween) {
      this.scene.tweens.remove(textData.tween);
    }
    
    // Remove from tracking
    this.activeTexts.delete(textId);
    
    // Call callback if provided
    if (callback && typeof callback === 'function') {
      callback();
    }
  }
  
  performCleanup() {
    const now = Date.now();
    const toDestroy = [];
    
    // Check all active texts
    this.activeTexts.forEach((textData, textId) => {
      // Check if text has exceeded its lifetime
      if (now - textData.createTime > textData.duration + 2000) {
        toDestroy.push(textId);
      }
      // Also check if text object was destroyed externally
      else if (!textData.text || !textData.text.active) {
        toDestroy.push(textId);
      }
    });
    
    // Destroy stale texts
    toDestroy.forEach(textId => {
      this.destroyText(textId);
    });
  }
  
  destroyAll() {
    // Destroy all tracked texts
    const allIds = Array.from(this.activeTexts.keys());
    allIds.forEach(textId => {
      this.destroyText(textId);
    });
    
    // Clear the map
    this.activeTexts.clear();
  }
  
  destroy() {
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Destroy all texts
    this.destroyAll();
  }
}