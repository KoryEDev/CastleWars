# NFT Sprite PNG Requirements (Standing + Running Only)

## Minimum PNG Files Needed

### 1. Base Body Types (4 types × 2 poses = 8 PNGs)
```
bodies/
├── slim_standing.png
├── slim_running.png
├── normal_standing.png
├── normal_running.png
├── buff_standing.png
├── buff_running.png
├── thick_standing.png
└── thick_running.png
```
**Total: 8 PNGs**

### 2. Outfits (5 types × 4 body types × 2 poses = 40 PNGs)
```
outfits/
├── basic_slim_standing.png
├── basic_slim_running.png
├── armor_slim_standing.png
├── armor_slim_running.png
├── ninja_slim_standing.png
├── ninja_slim_running.png
└── ... (same for normal, buff, thick)
```
**Total: 40 PNGs**

### 3. Head Accessories (5 types × 2 poses = 10 PNGs)
```
accessories/
├── none.png (empty/transparent)
├── bandana_standing.png
├── bandana_running.png
├── hat_standing.png
├── hat_running.png
├── crown_standing.png
├── crown_running.png
├── helmet_standing.png
└── helmet_running.png
```
**Total: 10 PNGs**

### 4. Face Expressions (5 types × 1 pose = 5 PNGs)
```
faces/
├── happy.png
├── serious.png
├── angry.png
├── cool.png (sunglasses)
└── mysterious.png (mask)
```
**Total: 5 PNGs** (faces don't change when running)

### 5. Special Effects Overlays (6 types = 6 PNGs)
```
effects/
├── none.png (empty)
├── fire.png (animated overlay)
├── ice.png (frost overlay)
├── lightning.png (electric aura)
├── shadow.png (dark aura)
└── rainbow.png (prismatic effect)
```
**Total: 6 PNGs** (same effect for both poses)

### 6. Backgrounds (10 types = 10 PNGs)
```
backgrounds/
├── solid_blue.png
├── solid_red.png
├── gradient_sunset.png
├── pattern_stars.png
├── pattern_clouds.png
└── ... (5 more)
```
**Total: 10 PNGs**

## Grand Total: 79 PNG Files

## But Wait! We Can Optimize Further:

### Smart Optimization Approach (Only 35 PNGs!)

Instead of creating outfit variations for each body type, we can use:

1. **Base Bodies** (8 PNGs)
   - 4 body types × 2 poses

2. **Universal Outfits** (10 PNGs)
   - 5 outfit types × 2 poses
   - Design them to fit all body types with slight stretching

3. **Accessories** (6 PNGs)
   - 3 actual accessories × 2 poses
   - (skip "none" and use transparency)

4. **Faces** (5 PNGs)
   - 5 expressions (position them universally)

5. **Effects** (6 PNGs)
   - 6 effect overlays

**New Total: 35 PNGs**

## Color Variations (No Extra PNGs!)

Use code to apply color tints:
- 10 primary colors
- 10 secondary colors
- Applied via canvas filters

This gives us:
- 4 bodies × 5 outfits × 4 accessories × 5 faces × 6 effects × 10 colors = **24,000 unique combinations**

## File Structure:
```
assets/nft/
├── bodies/
│   ├── slim_stand.png (64x64)
│   ├── slim_run.png (64x64)
│   └── ... (6 more)
├── outfits/
│   ├── basic_stand.png (64x64, transparent)
│   ├── basic_run.png (64x64, transparent)
│   └── ... (8 more)
├── accessories/
│   ├── bandana_stand.png (64x64, transparent)
│   └── ... (5 more)
├── faces/
│   ├── happy.png (20x20, just the face area)
│   └── ... (4 more)
└── effects/
    ├── fire.png (80x80, larger for glow)
    └── ... (5 more)
```

## Implementation Code:

```javascript
class NFTSpriteBuilder {
  async buildCharacter(traits, isRunning = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    const pose = isRunning ? 'run' : 'stand';
    
    // 1. Body (with primary color)
    const bodyImg = await this.loadImage(`bodies/${traits.bodyType}_${pose}.png`);
    ctx.filter = `hue-rotate(${traits.primaryColor * 36}deg)`;
    ctx.drawImage(bodyImg, 0, 0);
    ctx.filter = 'none';
    
    // 2. Outfit (with secondary color)
    const outfitImg = await this.loadImage(`outfits/${traits.outfit}_${pose}.png`);
    ctx.filter = `hue-rotate(${traits.secondaryColor * 36}deg)`;
    ctx.drawImage(outfitImg, 0, 0);
    ctx.filter = 'none';
    
    // 3. Face (always same position)
    const faceImg = await this.loadImage(`faces/${traits.face}.png`);
    ctx.drawImage(faceImg, 22, 10); // Positioned on head
    
    // 4. Accessory
    if (traits.accessory !== 'none') {
      const accImg = await this.loadImage(`accessories/${traits.accessory}_${pose}.png`);
      ctx.drawImage(accImg, 0, 0);
    }
    
    // 5. Effect overlay
    if (traits.effect !== 'none') {
      ctx.globalAlpha = 0.7;
      const effectImg = await this.loadImage(`effects/${traits.effect}.png`);
      ctx.drawImage(effectImg, -8, -8); // Slightly larger than sprite
      ctx.globalAlpha = 1.0;
    }
    
    return canvas;
  }
}
```

## Rarity Distribution:
- **Common (60%)**: Basic combinations, no effects
- **Uncommon (25%)**: Better accessories, 1 effect
- **Rare (10%)**: Cool accessories + effects
- **Epic (4%)**: Best accessories + animated effects
- **Legendary (1%)**: Unique combinations + rainbow effect

With just 35 PNGs, we can create 24,000+ unique NFTs!