# Castle Wars NFT Character System Design

## Overview
A system for generating unique, randomly assembled character NFTs that can be used as in-game sprites.

## Character Component Layers

Each NFT character will be composed of multiple layers:

1. **Base Body** (Required)
   - Different body types/poses
   - Color variations
   - Rarity: Common (60%), Uncommon (30%), Rare (10%)

2. **Head/Hair** (Required)
   - Various hairstyles and head accessories
   - Hats, helmets, crowns
   - Rarity: Common (50%), Uncommon (30%), Rare (15%), Legendary (5%)

3. **Face** (Required)
   - Eye types and colors
   - Mouth expressions
   - Face accessories (glasses, masks, etc.)
   - Rarity: Common (60%), Uncommon (25%), Rare (10%), Legendary (5%)

4. **Outfit/Armor** (Required)
   - Different clothing styles
   - Armor types
   - Color schemes
   - Rarity: Common (40%), Uncommon (30%), Rare (20%), Epic (8%), Legendary (2%)

5. **Weapon** (Optional)
   - Held weapons matching game weapons
   - Special NFT-exclusive weapons
   - Rarity: Common (50%), Uncommon (25%), Rare (15%), Epic (8%), Legendary (2%)

6. **Background/Aura** (Optional)
   - Special effects or backgrounds
   - Glows, particles, frames
   - Rarity: Rare (60%), Epic (30%), Legendary (10%)

## Generation Process

1. **Smart Contract Integration**
   ```solidity
   struct Character {
       uint256 tokenId;
       uint8 bodyType;
       uint8 headType;
       uint8 faceType;
       uint8 outfitType;
       uint8 weaponType;
       uint8 backgroundType;
       uint8 rarity;
   }
   ```

2. **On-Chain Generation**
   - Use block hash + user address for randomness
   - Each component selected based on rarity weights
   - Metadata stored on-chain or IPFS

3. **Off-Chain Rendering**
   - Node.js service to combine layers
   - Canvas API for image generation
   - Automatic sprite sheet generation for animations

## Game Integration

1. **Ownership Verification**
   - Connect wallet to verify NFT ownership
   - Check contract for owned tokens
   - Cache ownership data

2. **Sprite Loading**
   - Generate game-ready sprites from NFT data
   - Support for both standing and running animations
   - Automatic resizing to game dimensions

3. **Special Abilities**
   - Legendary NFTs get special in-game perks
   - Unique particle effects
   - Stat bonuses based on rarity

## Technical Implementation

### 1. Layer Generation Service
```javascript
// layer-generator.js
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs').promises;

class NFTCharacterGenerator {
    constructor() {
        this.layers = {
            body: [],
            head: [],
            face: [],
            outfit: [],
            weapon: [],
            background: []
        };
        this.rarityWeights = {
            common: 1000,
            uncommon: 400,
            rare: 150,
            epic: 40,
            legendary: 10
        };
    }
    
    async generateCharacter(seed) {
        const canvas = createCanvas(64, 64);
        const ctx = canvas.getContext('2d');
        
        // Generate component indices from seed
        const components = this.getComponentsFromSeed(seed);
        
        // Layer components
        for (const [layer, index] of Object.entries(components)) {
            if (index >= 0 && this.layers[layer][index]) {
                const img = await loadImage(this.layers[layer][index].path);
                ctx.drawImage(img, 0, 0, 64, 64);
            }
        }
        
        return canvas.toBuffer();
    }
    
    getComponentsFromSeed(seed) {
        // Deterministic random from seed
        const random = this.seedRandom(seed);
        
        return {
            body: this.selectByRarity(this.layers.body, random()),
            head: this.selectByRarity(this.layers.head, random()),
            face: this.selectByRarity(this.layers.face, random()),
            outfit: this.selectByRarity(this.layers.outfit, random()),
            weapon: random() > 0.5 ? this.selectByRarity(this.layers.weapon, random()) : -1,
            background: random() > 0.8 ? this.selectByRarity(this.layers.background, random()) : -1
        };
    }
    
    seedRandom(seed) {
        let s = seed;
        return function() {
            s = Math.sin(s) * 10000;
            return s - Math.floor(s);
        };
    }
}
```

### 2. Smart Contract Interface
```javascript
// nft-verifier.js
const Web3 = require('web3');
const contractABI = require('./CastleWarsNFT.json');

class NFTVerifier {
    constructor(contractAddress, web3Provider) {
        this.web3 = new Web3(web3Provider);
        this.contract = new this.web3.eth.Contract(contractABI, contractAddress);
    }
    
    async verifyOwnership(walletAddress, tokenId) {
        try {
            const owner = await this.contract.methods.ownerOf(tokenId).call();
            return owner.toLowerCase() === walletAddress.toLowerCase();
        } catch (err) {
            return false;
        }
    }
    
    async getCharacterData(tokenId) {
        const character = await this.contract.methods.characters(tokenId).call();
        return {
            bodyType: character.bodyType,
            headType: character.headType,
            faceType: character.faceType,
            outfitType: character.outfitType,
            weaponType: character.weaponType,
            backgroundType: character.backgroundType,
            rarity: character.rarity
        };
    }
}
```

### 3. Game Integration
```javascript
// In server.js
app.post('/verify-nft', async (req, res) => {
    const { walletAddress, tokenId } = req.body;
    
    // Verify ownership
    const isOwner = await nftVerifier.verifyOwnership(walletAddress, tokenId);
    if (!isOwner) {
        return res.status(403).json({ error: 'Not the owner of this NFT' });
    }
    
    // Get character data
    const characterData = await nftVerifier.getCharacterData(tokenId);
    
    // Generate sprites
    const standingSprite = await nftGenerator.generateCharacter(tokenId + '_standing');
    const runningSprite = await nftGenerator.generateCharacter(tokenId + '_running');
    
    // Save temporarily and return URLs
    const urls = {
        standing: `/nft-sprites/${tokenId}_standing.png`,
        running: `/nft-sprites/${tokenId}_running.png`
    };
    
    res.json({
        verified: true,
        characterData,
        sprites: urls
    });
});
```

## Rarity System

### Rarity Tiers
1. **Common** (Gray) - 60% drop rate
2. **Uncommon** (Green) - 25% drop rate  
3. **Rare** (Blue) - 10% drop rate
4. **Epic** (Purple) - 4% drop rate
5. **Legendary** (Gold) - 1% drop rate

### In-Game Benefits by Rarity
- **Common**: No bonus
- **Uncommon**: +5% movement speed
- **Rare**: +10% movement speed, +5% damage
- **Epic**: +15% movement speed, +10% damage, special particle effect
- **Legendary**: +20% movement speed, +15% damage, unique abilities, special aura

## Future Expansions

1. **Seasonal Collections**
   - Limited time components
   - Holiday themes
   - Special event items

2. **Evolution System**
   - Level up NFTs through gameplay
   - Unlock new visual components
   - Upgrade rarity tiers

3. **Breeding/Fusion**
   - Combine two NFTs to create new ones
   - Inherit traits from parents
   - Chance for mutations

4. **Marketplace Integration**
   - In-game NFT trading
   - Auction house
   - Rental system for rare NFTs