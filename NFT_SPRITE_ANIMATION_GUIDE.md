# NFT Sprite Generation & Animation Guide

## How NFT Image Generation Works

### 1. Layer-Based Composition
The system works like Photoshop layers - each trait is a transparent PNG that gets stacked:

```
Layer Order (bottom to top):
1. Background (solid/pattern)
2. Body base (body type shape)
3. Body color overlay
4. Outfit layer
5. Head/face features
6. Accessories
7. Special effects
8. Aura/glow effects
```

### 2. The Generation Process

```javascript
// Example sprite generation
class NFTSpriteGenerator {
  constructor() {
    // Pre-load all trait images
    this.traitImages = {
      body: {
        slim: 'assets/nft/body/slim.png',
        normal: 'assets/nft/body/normal.png',
        buff: 'assets/nft/body/buff.png',
        thick: 'assets/nft/body/thick.png'
      },
      outfit: {
        basic: 'assets/nft/outfit/basic.png',
        armor: 'assets/nft/outfit/armor.png',
        ninja: 'assets/nft/outfit/ninja.png',
        suit: 'assets/nft/outfit/suit.png',
        special: 'assets/nft/outfit/special.png'
      },
      // ... more traits
    };
  }
  
  async generateSprite(traits, isRunning = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;  // Standard sprite size
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    // 1. Draw background
    this.drawBackground(ctx, traits.background);
    
    // 2. Draw body with color tint
    const bodyImg = await this.loadImage(this.traitImages.body[traits.bodyType]);
    this.drawWithColorTint(ctx, bodyImg, traits.primaryColor);
    
    // 3. Draw outfit
    const outfitImg = await this.loadImage(this.traitImages.outfit[traits.outfit]);
    ctx.drawImage(outfitImg, 0, 0, 64, 64);
    
    // 4. Add accessories
    if (traits.headAccessory > 0) {
      const accessoryImg = await this.loadImage(
        this.traitImages.headAccessory[traits.headAccessory]
      );
      ctx.drawImage(accessoryImg, 0, 0, 64, 64);
    }
    
    // 5. Apply special effects
    if (traits.effect > 0) {
      this.applyEffect(ctx, traits.effect);
    }
    
    return canvas;
  }
  
  drawWithColorTint(ctx, image, colorIndex) {
    // Create temporary canvas for color manipulation
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 64;
    tempCanvas.height = 64;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Draw image
    tempCtx.drawImage(image, 0, 0, 64, 64);
    
    // Apply color overlay using composite operations
    tempCtx.globalCompositeOperation = 'source-atop';
    tempCtx.fillStyle = this.getColorFromIndex(colorIndex);
    tempCtx.fillRect(0, 0, 64, 64);
    
    // Draw tinted result
    ctx.drawImage(tempCanvas, 0, 0, 64, 64);
  }
}
```

## Implementing Running Animations

### 1. Multiple Sprite Sheets per NFT

For each NFT, we need to generate multiple sprites:
- Idle sprite (standing)
- Running frames (4-8 frames)
- Jump sprite
- Attack sprites

```javascript
class NFTAnimationGenerator {
  async generateAllAnimations(traits) {
    const animations = {
      idle: await this.generateIdleSprite(traits),
      run: await this.generateRunAnimation(traits),
      jump: await this.generateJumpSprite(traits),
      attack: await this.generateAttackAnimation(traits)
    };
    
    return animations;
  }
  
  async generateRunAnimation(traits) {
    const frames = [];
    const runPoses = ['run1', 'run2', 'run3', 'run4']; // 4 frame run cycle
    
    for (const pose of runPoses) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      
      // Load pose-specific body
      const bodyImg = await this.loadImage(
        `assets/nft/body/${traits.bodyType}_${pose}.png`
      );
      
      // Apply same layering as idle sprite
      this.drawWithColorTint(ctx, bodyImg, traits.primaryColor);
      
      // Add outfit for this pose
      const outfitImg = await this.loadImage(
        `assets/nft/outfit/${traits.outfit}_${pose}.png`
      );
      ctx.drawImage(outfitImg, 0, 0, 64, 64);
      
      // Add accessories (might shift position based on pose)
      // ... more layers
      
      frames.push(canvas);
    }
    
    return this.createSpriteSheet(frames);
  }
  
  createSpriteSheet(frames) {
    // Combine frames into horizontal sprite sheet
    const spriteSheet = document.createElement('canvas');
    spriteSheet.width = frames.length * 64;
    spriteSheet.height = 64;
    const ctx = spriteSheet.getContext('2d');
    
    frames.forEach((frame, index) => {
      ctx.drawImage(frame, index * 64, 0);
    });
    
    return spriteSheet;
  }
}
```

### 2. Integrating with Phaser

```javascript
// In Player.js
class NFTPlayer extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, nftData) {
    // Generate texture key based on NFT ID
    const textureKey = `nft_${nftData.tokenId}`;
    super(scene, x, y, textureKey);
    
    this.nftData = nftData;
    this.traits = nftData.traits;
    
    // Create animations if not already created
    if (!scene.anims.exists(`${textureKey}_run`)) {
      this.createNFTAnimations();
    }
  }
  
  async createNFTAnimations() {
    // Generate all sprite sheets
    const generator = new NFTAnimationGenerator();
    const animations = await generator.generateAllAnimations(this.traits);
    
    // Add textures to Phaser
    this.scene.textures.addCanvas(`${this.textureKey}_idle`, animations.idle);
    this.scene.textures.addCanvas(`${this.textureKey}_run`, animations.run);
    
    // Create Phaser animations
    this.scene.anims.create({
      key: `${this.textureKey}_run`,
      frames: this.scene.anims.generateFrameNumbers(`${this.textureKey}_run`, {
        start: 0,
        end: 3
      }),
      frameRate: 10,
      repeat: -1
    });
    
    this.scene.anims.create({
      key: `${this.textureKey}_idle`,
      frames: [{ key: `${this.textureKey}_idle`, frame: 0 }],
      frameRate: 1
    });
  }
  
  update() {
    if (this.body.velocity.x !== 0) {
      this.play(`${this.textureKey}_run`, true);
      this.setFlipX(this.body.velocity.x < 0);
    } else {
      this.play(`${this.textureKey}_idle`, true);
    }
  }
}
```

### 3. Optimized Loading System

```javascript
class NFTAssetManager {
  constructor() {
    this.cache = new Map();
    this.generating = new Map();
  }
  
  async loadNFTAssets(tokenId, traits) {
    const cacheKey = `nft_${tokenId}`;
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    // Check if already generating
    if (this.generating.has(cacheKey)) {
      return await this.generating.get(cacheKey);
    }
    
    // Start generation
    const generationPromise = this.generateAssets(tokenId, traits);
    this.generating.set(cacheKey, generationPromise);
    
    try {
      const assets = await generationPromise;
      this.cache.set(cacheKey, assets);
      this.generating.delete(cacheKey);
      return assets;
    } catch (error) {
      this.generating.delete(cacheKey);
      throw error;
    }
  }
  
  async generateAssets(tokenId, traits) {
    const generator = new NFTAnimationGenerator();
    
    // Generate all animations
    const idle = await generator.generateIdleSprite(traits);
    const run = await generator.generateRunAnimation(traits);
    const jump = await generator.generateJumpSprite(traits);
    
    // Convert to base64 for storage
    return {
      idle: idle.toDataURL(),
      run: run.toDataURL(),
      jump: jump.toDataURL()
    };
  }
}
```

### 4. Pre-generation Strategy

For better performance, generate common combinations ahead of time:

```javascript
// Backend service to pre-generate sprites
async function pregenerateCommonNFTs() {
  const db = new Database();
  const generator = new NFTAnimationGenerator();
  
  // Get most common trait combinations
  const commonTraits = await db.getMostCommonTraitCombos(100);
  
  for (const traits of commonTraits) {
    const assets = await generator.generateAllAnimations(traits);
    
    // Store in CDN
    await uploadToCDN({
      key: `nft_assets/${hashTraits(traits)}`,
      idle: assets.idle,
      run: assets.run,
      jump: assets.jump
    });
  }
}
```

### 5. Real-time Generation Fallback

```javascript
// In game loading
async function loadPlayerNFT(player) {
  const { tokenId, traits } = player.nftData;
  
  // Try CDN first
  const cdnUrl = `https://cdn.castlewars.io/nft_assets/${hashTraits(traits)}`;
  
  try {
    const assets = await fetch(cdnUrl).then(r => r.json());
    return assets;
  } catch (e) {
    // Generate on-the-fly
    console.log('Generating NFT assets in real-time...');
    return await assetManager.loadNFTAssets(tokenId, traits);
  }
}
```

## Asset Structure Example

```
assets/nft/
├── body/
│   ├── slim_idle.png
│   ├── slim_run1.png
│   ├── slim_run2.png
│   ├── slim_run3.png
│   ├── slim_run4.png
│   ├── normal_idle.png
│   ├── normal_run1.png
│   └── ...
├── outfit/
│   ├── basic_idle.png
│   ├── basic_run1.png
│   └── ...
├── accessories/
│   ├── hat_idle.png
│   ├── hat_run1.png
│   └── ...
└── effects/
    ├── fire_overlay.png
    └── ice_overlay.png
```

## Performance Considerations

1. **Cache Everything**: Once generated, cache sprites in memory and localStorage
2. **Progressive Loading**: Load idle first, then animations
3. **Resolution Options**: Generate low-res for gameplay, high-res for profile
4. **Batch Processing**: Generate multiple NFTs in parallel
5. **CDN Distribution**: Store popular combinations on CDN

This system allows each NFT to have unique running animations while maintaining good performance!