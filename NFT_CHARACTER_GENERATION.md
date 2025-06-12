# NFT Character Generation Technical Guide

## 1. Trait System Architecture

### Base Character Structure
```javascript
const characterTraits = {
  // Visual Traits
  bodyType: 0-3,        // slim, normal, buff, thick
  headAccessory: 0-4,   // none, bandana, hat, crown, helmet
  faceType: 0-4,        // happy, serious, angry, cool, mysterious
  outfit: 0-4,          // basic, armor, ninja, suit, special
  primaryColor: 0-9,    // 10 base colors
  secondaryColor: 0-9,  // accent colors
  effect: 0-5,          // none, fire, ice, lightning, shadow, rainbow
  background: 0-19,     // 20 different backgrounds
  
  // Rarity & Stats
  rarity: 0-4,          // common to legendary
  level: 1-100,         // progression system
  generation: 0,        // breeding generation
  
  // Special Traits (rare+)
  animation: null,      // special animations
  aura: null,          // visual effects
  companion: null,     // pet/familiar
  weapon_skin: null    // exclusive weapon appearance
}
```

### 2. Procedural Generation Algorithm

```javascript
function generateCharacterTraits(seed) {
  const rng = new SeededRandom(seed);
  const rarity = calculateRarity(rng);
  
  const traits = {
    bodyType: rng.nextInt(4),
    headAccessory: rng.nextInt(5),
    faceType: rng.nextInt(5),
    outfit: rng.nextInt(5),
    primaryColor: rng.nextInt(10),
    secondaryColor: rng.nextInt(10),
    effect: rarity >= 2 ? rng.nextInt(6) : 0,
    background: rng.nextInt(20),
    rarity: rarity
  };
  
  // Add special traits based on rarity
  if (rarity >= 3) { // Epic+
    traits.animation = selectSpecialAnimation(rng);
    traits.aura = selectAura(rng);
  }
  
  if (rarity === 4) { // Legendary
    traits.companion = selectCompanion(rng);
    traits.weapon_skin = selectWeaponSkin(rng);
  }
  
  return traits;
}

function calculateRarity(rng) {
  const roll = rng.nextFloat();
  if (roll < 0.60) return 0; // Common (60%)
  if (roll < 0.85) return 1; // Uncommon (25%)
  if (roll < 0.95) return 2; // Rare (10%)
  if (roll < 0.99) return 3; // Epic (4%)
  return 4; // Legendary (1%)
}
```

### 3. Sprite Assembly System

```javascript
class NFTCharacterBuilder {
  constructor() {
    this.layers = [
      'background',
      'body',
      'outfit',
      'head',
      'headAccessory',
      'face',
      'effect',
      'aura'
    ];
  }
  
  async buildCharacter(traits) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; // 2x normal sprite size
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Draw each layer
    for (const layer of this.layers) {
      const sprite = await this.loadSprite(layer, traits);
      if (sprite) {
        // Apply color modifications
        if (layer === 'body' || layer === 'outfit') {
          this.applyColorTint(sprite, traits.primaryColor, traits.secondaryColor);
        }
        ctx.drawImage(sprite, 0, 0, 128, 128);
      }
    }
    
    // Add special effects
    if (traits.effect > 0) {
      this.applyEffect(ctx, traits.effect);
    }
    
    return canvas;
  }
  
  applyColorTint(image, primary, secondary) {
    // Color replacement logic
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
      '#FFEAA7', '#DDA0DD', '#FFB6C1', '#98D8C8',
      '#F7DC6F', '#BB8FCE'
    ];
    // Apply primary and secondary colors
  }
  
  applyEffect(ctx, effectType) {
    const effects = {
      1: () => this.addFireEffect(ctx),
      2: () => this.addIceEffect(ctx),
      3: () => this.addLightningEffect(ctx),
      4: () => this.addShadowEffect(ctx),
      5: () => this.addRainbowEffect(ctx)
    };
    effects[effectType]?.();
  }
}
```

### 4. Smart Contract Integration

```solidity
contract CastleWarsNFT is ERC721, Ownable {
    struct Character {
        uint8 bodyType;
        uint8 headAccessory;
        uint8 faceType;
        uint8 outfit;
        uint8 primaryColor;
        uint8 secondaryColor;
        uint8 effect;
        uint8 background;
        uint8 rarity;
        uint16 level;
        uint8 generation;
    }
    
    mapping(uint256 => Character) public characters;
    mapping(uint256 => bool) public isStaked;
    mapping(address => uint256[]) public stakedTokens;
    
    uint256 public constant MAX_SUPPLY = 10000;
    uint256 public mintPrice = 0.05 ether;
    
    function mint(uint256 numberOfTokens) public payable {
        require(totalSupply() + numberOfTokens <= MAX_SUPPLY, "Exceeds max supply");
        require(msg.value >= mintPrice * numberOfTokens, "Insufficient payment");
        
        for (uint i = 0; i < numberOfTokens; i++) {
            uint256 tokenId = totalSupply() + 1;
            _safeMint(msg.sender, tokenId);
            characters[tokenId] = generateCharacter(tokenId);
        }
    }
    
    function stake(uint256 tokenId) public {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        require(!isStaked[tokenId], "Already staked");
        
        isStaked[tokenId] = true;
        stakedTokens[msg.sender].push(tokenId);
        
        // Transfer to staking contract
    }
    
    function breed(uint256 parentA, uint256 parentB) public {
        require(ownerOf(parentA) == msg.sender, "Not owner of parent A");
        require(ownerOf(parentB) == msg.sender, "Not owner of parent B");
        
        // Breeding logic with trait mixing
    }
}
```

### 5. Client-Side Web3 Integration

```javascript
class Web3Manager {
  async connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        this.account = accounts[0];
        this.web3 = new Web3(window.ethereum);
        this.contract = new this.web3.eth.Contract(ABI, CONTRACT_ADDRESS);
        return true;
      } catch (error) {
        console.error('Wallet connection failed:', error);
        return false;
      }
    }
    return false;
  }
  
  async getUserNFTs() {
    const balance = await this.contract.methods.balanceOf(this.account).call();
    const nfts = [];
    
    for (let i = 0; i < balance; i++) {
      const tokenId = await this.contract.methods
        .tokenOfOwnerByIndex(this.account, i).call();
      const traits = await this.contract.methods.characters(tokenId).call();
      nfts.push({ tokenId, traits });
    }
    
    return nfts;
  }
  
  async verifyNFTOwnership(tokenId) {
    const owner = await this.contract.methods.ownerOf(tokenId).call();
    return owner.toLowerCase() === this.account.toLowerCase();
  }
}
```

### 6. Server-Side Verification

```javascript
// server-pve.js additions
const Web3 = require('web3');
const web3 = new Web3(process.env.RPC_URL);
const contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);

socket.on('verifyNFT', async ({ tokenId, signature }) => {
  try {
    // Verify signature
    const message = `Verify NFT ${tokenId} ownership`;
    const address = web3.eth.accounts.recover(message, signature);
    
    // Check on-chain ownership
    const owner = await contract.methods.ownerOf(tokenId).call();
    
    if (owner.toLowerCase() === address.toLowerCase()) {
      const traits = await contract.methods.characters(tokenId).call();
      
      // Apply NFT bonuses
      const player = gameState.players[socket.id];
      if (player) {
        player.nftId = tokenId;
        player.nftTraits = traits;
        player.nftBonuses = calculateNFTBonuses(traits);
        
        socket.emit('nftVerified', { tokenId, traits, bonuses: player.nftBonuses });
      }
    } else {
      socket.emit('nftError', { message: 'Not the owner of this NFT' });
    }
  } catch (error) {
    socket.emit('nftError', { message: 'Verification failed' });
  }
});

function calculateNFTBonuses(traits) {
  const rarityBonuses = {
    0: { xp: 1.05, points: 1.0, health: 1.0, damage: 1.0 },
    1: { xp: 1.10, points: 1.05, health: 1.0, damage: 1.0 },
    2: { xp: 1.15, points: 1.10, health: 1.05, damage: 1.0 },
    3: { xp: 1.20, points: 1.15, health: 1.10, damage: 1.05 },
    4: { xp: 1.25, points: 1.20, health: 1.15, damage: 1.10 }
  };
  
  return rarityBonuses[traits.rarity] || rarityBonuses[0];
}
```

### 7. Character Display in Game

```javascript
// Player.js modifications
class Player extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, username, traits = null) {
    if (traits) {
      // Use NFT character
      const textureKey = `nft_character_${traits.tokenId}`;
      super(scene, x, y, textureKey);
      this.traits = traits;
      this.applyNFTVisuals();
    } else {
      // Regular character
      super(scene, x, y, 'stickman');
    }
  }
  
  async applyNFTVisuals() {
    // Build character from traits
    const builder = new NFTCharacterBuilder();
    const characterCanvas = await builder.buildCharacter(this.traits);
    
    // Convert to Phaser texture
    this.scene.textures.addCanvas(
      `nft_character_${this.traits.tokenId}`, 
      characterCanvas
    );
    
    // Apply special effects
    if (this.traits.aura) {
      this.addAuraEffect(this.traits.aura);
    }
    
    if (this.traits.companion) {
      this.addCompanion(this.traits.companion);
    }
  }
}
```

This system creates true digital ownership while maintaining game balance!