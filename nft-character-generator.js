const { createCanvas, loadImage } = require('canvas');
const fs = require('fs').promises;
const path = require('path');

class NFTCharacterGenerator {
    constructor() {
        this.width = 64;
        this.height = 64;
        this.componentsPath = path.join(__dirname, 'assets', 'nft-components');
        
        // Component configuration
        this.components = {
            body: {
                common: ['body_basic_1', 'body_basic_2', 'body_basic_3'],
                uncommon: ['body_armor_light', 'body_athletic'],
                rare: ['body_armor_heavy', 'body_muscular'],
                epic: ['body_armor_crystal'],
                legendary: ['body_armor_divine']
            },
            head: {
                common: ['head_basic', 'head_cap', 'head_bandana'],
                uncommon: ['head_helmet_basic', 'head_hood'],
                rare: ['head_helmet_knight', 'head_wizard_hat'],
                epic: ['head_crown'],
                legendary: ['head_halo', 'head_demon_horns']
            },
            face: {
                common: ['face_normal', 'face_happy', 'face_serious'],
                uncommon: ['face_sunglasses', 'face_eyepatch'],
                rare: ['face_mask_ninja', 'face_beard'],
                epic: ['face_mask_skull'],
                legendary: ['face_glowing_eyes']
            },
            outfit: {
                common: ['outfit_shirt', 'outfit_vest'],
                uncommon: ['outfit_cloak', 'outfit_jacket'],
                rare: ['outfit_robe_wizard', 'outfit_armor_chain'],
                epic: ['outfit_armor_plate'],
                legendary: ['outfit_robe_divine', 'outfit_armor_demon']
            },
            weapon: {
                common: ['weapon_sword', 'weapon_pistol'],
                uncommon: ['weapon_rifle', 'weapon_shotgun'],
                rare: ['weapon_sniper', 'weapon_staff'],
                epic: ['weapon_laser', 'weapon_dual_pistols'],
                legendary: ['weapon_excalibur', 'weapon_staff_divine']
            },
            aura: {
                rare: ['aura_glow_blue', 'aura_glow_green'],
                epic: ['aura_fire', 'aura_lightning'],
                legendary: ['aura_divine', 'aura_void', 'aura_rainbow']
            }
        };
        
        // Rarity weights (out of 1000)
        this.rarityWeights = {
            common: 600,
            uncommon: 250,
            rare: 100,
            epic: 40,
            legendary: 10
        };
    }
    
    // Initialize component images
    async init() {
        // Create directories if they don't exist
        const dirs = ['body', 'head', 'face', 'outfit', 'weapon', 'aura'];
        for (const dir of dirs) {
            const dirPath = path.join(this.componentsPath, dir);
            await fs.mkdir(dirPath, { recursive: true });
        }
        
        console.log('NFT Character Generator initialized');
    }
    
    // Generate a character from a seed
    async generateCharacter(seed, options = {}) {
        const canvas = createCanvas(this.width, this.height);
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, this.width, this.height);
        
        // Generate components from seed
        const components = this.selectComponents(seed);
        
        // Layer order: aura (back), body, outfit, head, face, weapon (front)
        const layerOrder = ['aura', 'body', 'outfit', 'head', 'face', 'weapon'];
        
        for (const layer of layerOrder) {
            const component = components[layer];
            if (component) {
                try {
                    const imagePath = path.join(this.componentsPath, layer, `${component}.png`);
                    const image = await loadImage(imagePath);
                    ctx.drawImage(image, 0, 0, this.width, this.height);
                } catch (err) {
                    console.log(`Component not found: ${layer}/${component}`);
                }
            }
        }
        
        return {
            image: canvas.toBuffer('image/png'),
            metadata: {
                seed,
                components,
                rarity: this.calculateOverallRarity(components),
                timestamp: Date.now()
            }
        };
    }
    
    // Select components based on seed
    selectComponents(seed) {
        const rng = this.createRNG(seed);
        const selected = {};
        
        // Required components
        selected.body = this.selectByRarity('body', rng);
        selected.head = this.selectByRarity('head', rng);
        selected.face = this.selectByRarity('face', rng);
        selected.outfit = this.selectByRarity('outfit', rng);
        
        // Optional components
        if (rng() < 0.7) { // 70% chance of weapon
            selected.weapon = this.selectByRarity('weapon', rng);
        }
        
        if (rng() < 0.2) { // 20% chance of aura
            selected.aura = this.selectByRarity('aura', rng);
        }
        
        return selected;
    }
    
    // Select component by rarity
    selectByRarity(componentType, rng) {
        const roll = Math.floor(rng() * 1000);
        let accumulated = 0;
        
        for (const [rarity, weight] of Object.entries(this.rarityWeights)) {
            accumulated += weight;
            if (roll < accumulated && this.components[componentType][rarity]) {
                const options = this.components[componentType][rarity];
                return options[Math.floor(rng() * options.length)];
            }
        }
        
        // Fallback to common
        const common = this.components[componentType].common;
        return common[Math.floor(rng() * common.length)];
    }
    
    // Calculate overall rarity score
    calculateOverallRarity(components) {
        const rarityScores = {
            common: 1,
            uncommon: 2,
            rare: 3,
            epic: 4,
            legendary: 5
        };
        
        let totalScore = 0;
        let componentCount = 0;
        
        for (const [type, component] of Object.entries(components)) {
            if (component) {
                componentCount++;
                // Find which rarity this component belongs to
                for (const [rarity, items] of Object.entries(this.components[type])) {
                    if (items && items.includes(component)) {
                        totalScore += rarityScores[rarity] || 1;
                        break;
                    }
                }
            }
        }
        
        const avgScore = totalScore / componentCount;
        
        if (avgScore >= 4.5) return 'legendary';
        if (avgScore >= 3.5) return 'epic';
        if (avgScore >= 2.5) return 'rare';
        if (avgScore >= 1.5) return 'uncommon';
        return 'common';
    }
    
    // Create deterministic RNG from seed
    createRNG(seed) {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            const char = seed.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        let a = hash;
        return function() {
            a = (a * 9301 + 49297) % 233280;
            return a / 233280;
        };
    }
    
    // Generate sprite sheet for animation
    async generateSpriteSheet(seed, frames = 4) {
        const canvas = createCanvas(this.width * frames, this.height);
        const ctx = canvas.getContext('2d');
        
        // Generate base character
        const character = await this.generateCharacter(seed);
        
        // For now, just repeat the same image
        // In a full implementation, we'd have different poses
        for (let i = 0; i < frames; i++) {
            const img = await loadImage(character.image);
            ctx.drawImage(img, i * this.width, 0);
        }
        
        return canvas.toBuffer('image/png');
    }
    
    // Generate example components (placeholder images)
    async generatePlaceholderComponents() {
        console.log('Generating placeholder component images...');
        
        for (const [type, rarities] of Object.entries(this.components)) {
            for (const [rarity, items] of Object.entries(rarities)) {
                for (const item of items) {
                    const canvas = createCanvas(this.width, this.height);
                    const ctx = canvas.getContext('2d');
                    
                    // Different colors for different types
                    const colors = {
                        body: '#8B4513',
                        head: '#FFD700',
                        face: '#FFA500',
                        outfit: '#4169E1',
                        weapon: '#C0C0C0',
                        aura: '#FF00FF'
                    };
                    
                    // Rarity border colors
                    const rarityColors = {
                        common: '#808080',
                        uncommon: '#00FF00',
                        rare: '#0080FF',
                        epic: '#8000FF',
                        legendary: '#FFD700'
                    };
                    
                    // Fill background
                    ctx.fillStyle = colors[type] || '#000000';
                    ctx.fillRect(8, 8, this.width - 16, this.height - 16);
                    
                    // Add rarity border
                    ctx.strokeStyle = rarityColors[rarity];
                    ctx.lineWidth = 4;
                    ctx.strokeRect(4, 4, this.width - 8, this.height - 8);
                    
                    // Add text
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = '8px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(item.split('_')[1], this.width / 2, this.height / 2);
                    
                    // Save
                    const outputPath = path.join(this.componentsPath, type, `${item}.png`);
                    const buffer = canvas.toBuffer('image/png');
                    await fs.writeFile(outputPath, buffer);
                }
            }
        }
        
        console.log('Placeholder components generated!');
    }
}

// Example usage
async function test() {
    const generator = new NFTCharacterGenerator();
    await generator.init();
    
    // Generate placeholder components (run once)
    // await generator.generatePlaceholderComponents();
    
    // Generate some random characters
    for (let i = 0; i < 5; i++) {
        const seed = `character_${Date.now()}_${i}`;
        const result = await generator.generateCharacter(seed);
        
        await fs.writeFile(
            path.join(__dirname, `nft_character_${i}.png`),
            result.image
        );
        
        console.log(`Generated character ${i}:`, result.metadata);
    }
}

module.exports = NFTCharacterGenerator;

// Run test if this file is executed directly
if (require.main === module) {
    test().catch(console.error);
}