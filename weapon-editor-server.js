const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// Handle weapon generation
app.post('/api/generate-weapon', async (req, res) => {
    try {
        const config = req.body;
        const weaponId = config.weaponId;
        
        // 1. Save weapon sprite
        if (config.weaponSprite) {
            const spriteData = config.weaponSprite.data.replace(/^data:image\/\w+;base64,/, '');
            const spriteBuffer = Buffer.from(spriteData, 'base64');
            await fs.writeFile(`assets/weapons/${weaponId}.png`, spriteBuffer);
        }
        
        // 2. Save bullet sprite if provided
        if (config.bulletSprite) {
            const bulletData = config.bulletSprite.data.replace(/^data:image\/\w+;base64,/, '');
            const bulletBuffer = Buffer.from(bulletData, 'base64');
            await fs.writeFile(`assets/weapons/${weaponId}_bullet.png`, bulletBuffer);
        }
        
        // 3. Update Weapon.js
        const weaponPath = 'js/entities/Weapon.js';
        let weaponContent = await fs.readFile(weaponPath, 'utf8');
        
        // Check if weapon already exists in damage configuration
        const damageRegex = new RegExp(`\\b${weaponId}:\\s*\\d+`, 'g');
        if (weaponContent.match(damageRegex)) {
            return res.status(400).json({ 
                error: `Weapon '${weaponId}' already exists. Please choose a different ID or delete the existing weapon first.` 
            });
        }
        
        // Add to damages object in getWeaponDamage method
        const damagesMatch = weaponContent.match(/const damages = {([\s\S]*?)};/);
        if (damagesMatch) {
            const existingDamages = damagesMatch[1].trimEnd();
            const updatedDamages = existingDamages + `,\n      ${weaponId}: ${config.damage}`;
            weaponContent = weaponContent.replace(
                /const damages = {[\s\S]*?};/,
                `const damages = {${updatedDamages}\n    };`
            );
        }
        
        // Add to fireRates object in getWeaponFireRate method
        const fireRatesMatch = weaponContent.match(/const fireRates = {([\s\S]*?)};/);
        if (fireRatesMatch) {
            const existingFireRates = fireRatesMatch[1].trimEnd();
            const updatedFireRates = existingFireRates + `,\n      ${weaponId}: ${config.fireRate}`;
            weaponContent = weaponContent.replace(
                /const fireRates = {[\s\S]*?};/,
                `const fireRates = {${updatedFireRates}\n    };`
            );
        }
        
        // Add to speeds object in getWeaponBulletSpeed method
        const speedsMatch = weaponContent.match(/const speeds = {([\s\S]*?)};/);
        if (speedsMatch) {
            const existingSpeeds = speedsMatch[1].trimEnd();
            const updatedSpeeds = existingSpeeds + `,\n      ${weaponId}: ${config.bulletSpeed}`;
            weaponContent = weaponContent.replace(
                /const speeds = {[\s\S]*?};/,
                `const speeds = {${updatedSpeeds}\n    };`
            );
        }
        
        // Add to sizes object in getWeaponMagazineSize method
        const sizesMatch = weaponContent.match(/const sizes = {([\s\S]*?)};/);
        if (sizesMatch) {
            const existingSizes = sizesMatch[1].trimEnd();
            const updatedSizes = existingSizes + `,\n      ${weaponId}: ${config.magazineSize}`;
            weaponContent = weaponContent.replace(
                /const sizes = {[\s\S]*?};/,
                `const sizes = {${updatedSizes}\n    };`
            );
        }
        
        // Add to times object in getWeaponReloadTime method
        const timesMatch = weaponContent.match(/const times = {([\s\S]*?)};/);
        if (timesMatch) {
            const existingTimes = timesMatch[1].trimEnd();
            const updatedTimes = existingTimes + `,\n      ${weaponId}: ${config.reloadTime}`;
            weaponContent = weaponContent.replace(
                /const times = {[\s\S]*?};/,
                `const times = {${updatedTimes}\n    };`
            );
        }
        
        await fs.writeFile(weaponPath, weaponContent);
        
        // 4. Update server.js WEAPON_CONFIG
        const serverPath = 'server.js';
        let serverContent = await fs.readFile(serverPath, 'utf8');
        
        // Check if weapon already exists in WEAPON_CONFIG
        const weaponConfigRegex = new RegExp(`\\b${weaponId}:\\s*{`, 'g');
        if (!serverContent.match(weaponConfigRegex)) {
            // Find WEAPON_CONFIG object
            const configMatch = /const WEAPON_CONFIG = {([^}]+)}/s;
            const configResult = serverContent.match(configMatch);
            
            if (configResult) {
                const existingConfig = configResult[1];
                
                // Determine where to add the weapon (staff-only or regular)
                let newWeaponEntry;
                if (config.weaponAccess && config.weaponAccess !== 'all') {
                    // Determine required roles based on access level
                    let requiredRoles;
                    switch (config.weaponAccess) {
                        case 'staff':
                            requiredRoles = ['mod', 'admin', 'ash', 'owner'];
                            break;
                        case 'admin':
                            requiredRoles = ['admin', 'ash', 'owner'];
                            break;
                        case 'owner':
                            requiredRoles = ['owner'];
                            break;
                        default:
                            requiredRoles = ['mod', 'admin', 'ash', 'owner'];
                    }
                    
                    // Add as staff-only weapon
                    newWeaponEntry = `\n  // ${config.weaponAccess === 'staff' ? 'Staff' : config.weaponAccess === 'admin' ? 'Admin' : 'Owner'}-only weapon\n  ${weaponId}: { damage: ${config.damage}, fireRate: ${config.fireRate}, magazineSize: ${config.magazineSize}, reloadTime: ${config.reloadTime}, bulletSpeed: ${config.bulletSpeed || 800}, staffOnly: true, requiredRoles: ${JSON.stringify(requiredRoles)} },`;
                } else {
                    // Add as regular weapon
                    newWeaponEntry = `\n  ${weaponId}: { damage: ${config.damage}, fireRate: ${config.fireRate}, magazineSize: ${config.magazineSize}, reloadTime: ${config.reloadTime}, bulletSpeed: ${config.bulletSpeed || 800} },`;
                }
                
                // Insert before the staff-only section or at the end
                const staffOnlyIndex = existingConfig.indexOf('// Staff-only weapons');
                if (staffOnlyIndex > -1 && !config.adminOnly) {
                    // Add before staff-only section
                    const beforeStaff = existingConfig.substring(0, staffOnlyIndex);
                    const afterStaff = existingConfig.substring(staffOnlyIndex);
                    const updatedConfig = beforeStaff.trimEnd() + newWeaponEntry + '\n  \n  ' + afterStaff;
                    serverContent = serverContent.replace(configMatch, `const WEAPON_CONFIG = {${updatedConfig}}`);
                } else {
                    // Add at the end
                    const updatedConfig = existingConfig.trimEnd() + newWeaponEntry;
                    serverContent = serverContent.replace(configMatch, `const WEAPON_CONFIG = {${updatedConfig}}`);
                }
                
                await fs.writeFile(serverPath, serverContent);
            }
        }
        
        // 5. Update server-pve.js WEAPON_CONFIG similarly
        const pvePath = 'server-pve.js';
        let pveContent = await fs.readFile(pvePath, 'utf8');
        
        // Check if weapon already exists in WEAPON_CONFIG
        if (!pveContent.match(weaponConfigRegex)) {
            // Find WEAPON_CONFIG object in PvE server
            const pveConfigMatch = /const WEAPON_CONFIG = {([^}]+)}/s;
            const pveConfigResult = pveContent.match(pveConfigMatch);
            
            if (pveConfigResult) {
                const existingPveConfig = pveConfigResult[1];
                
                // Use the same weapon entry as regular server
                const pveStaffOnlyIndex = existingPveConfig.indexOf('// Staff-only weapons');
                if (pveStaffOnlyIndex > -1 && !config.adminOnly) {
                    // Add before staff-only section
                    const beforeStaff = existingPveConfig.substring(0, pveStaffOnlyIndex);
                    const afterStaff = existingPveConfig.substring(pveStaffOnlyIndex);
                    const updatedConfig = beforeStaff.trimEnd() + newWeaponEntry + '\n  \n  ' + afterStaff;
                    pveContent = pveContent.replace(pveConfigMatch, `const WEAPON_CONFIG = {${updatedConfig}}`);
                } else {
                    // Add at the end
                    const updatedConfig = existingPveConfig.trimEnd() + newWeaponEntry;
                    pveContent = pveContent.replace(pveConfigMatch, `const WEAPON_CONFIG = {${updatedConfig}}`);
                }
                
                await fs.writeFile(pvePath, pveContent);
            }
        }
        
        // 6. Update GameScene.js to preload the new sprites
        const scenePath = 'js/scenes/GameScene.js';
        let sceneContent = await fs.readFile(scenePath, 'utf8');
        
        // Check if already loading this weapon
        const loadRegex = new RegExp(`this\\.load\\.image\\(['"]${weaponId}['"]`, 'g');
        if (!sceneContent.match(loadRegex)) {
            // Find preload section
            const preloadStart = sceneContent.indexOf('preload() {');
            const preloadEnd = sceneContent.indexOf('}', preloadStart);
            const beforePreload = sceneContent.substring(0, preloadEnd);
            const afterPreload = sceneContent.substring(preloadEnd);
            
            const newPreload = `    this.load.image('${weaponId}', 'assets/weapons/${weaponId}.png');\n`;
            const bulletPreload = config.bulletSprite ? 
                `    this.load.image('${weaponId}_bullet', 'assets/weapons/${weaponId}_bullet.png');\n` : '';
            
            sceneContent = beforePreload + newPreload + bulletPreload + afterPreload;
            await fs.writeFile(scenePath, sceneContent);
        }
        
        // 7. Update Player.js to include new weapon in allWeaponTypes
        const playerPath = 'js/entities/Player.js';
        let playerContent = await fs.readFile(playerPath, 'utf8');
        
        // Find allWeaponTypes array
        const allWeaponsMatch = /this\.allWeaponTypes = \[(.*?)\]/s;
        const allWeaponsResult = playerContent.match(allWeaponsMatch);
        if (allWeaponsResult) {
            const weapons = allWeaponsResult[1];
            if (!weapons.includes(`'${weaponId}'`)) {
                const newWeapons = weapons.trim() + `, '${weaponId}'`;
                playerContent = playerContent.replace(allWeaponsMatch, `this.allWeaponTypes = [${newWeapons}]`);
                await fs.writeFile(playerPath, playerContent);
            }
        }
        
        // 8. Update weapon shop display (GameScene.js showWeaponShopMenu)
        // This is handled by the game reading from Weapon.js WEAPON_CONFIGS
        
        // 9. Note about sprite sizing
        // Sprites should be 64x64 pixels for best results
        // You can install 'sharp' package for automatic resizing:
        // npm install sharp
        
        // 10. Handle special weapon flags (e.g., admin-only weapons)
        if (config.adminOnly) {
            // Find the admin weapon check in Player.js
            const adminMatch = /if \(\['admin', 'ash', 'owner'\]\.includes\(this\.role\)\) {\s*this\.allWeaponTypes\.push\((.*?)\)/;
            const adminResult = playerContent.match(adminMatch);
            if (adminResult) {
                const adminWeapons = adminResult[1];
                const newAdminWeapons = adminWeapons.replace(/\)$/, `, '${weaponId}')`);
                playerContent = playerContent.replace(adminMatch, 
                    `if (['admin', 'ash', 'owner'].includes(this.role)) {\n      this.allWeaponTypes.push(${newAdminWeapons})`);
                await fs.writeFile(playerPath, playerContent);
            }
        }
        
        res.json({
            success: true,
            files: [
                `assets/weapons/${weaponId}.png`,
                config.bulletSprite ? `assets/weapons/${weaponId}_bullet.png` : null,
                'js/entities/Weapon.js',
                'server.js',
                'server-pve.js',
                'js/scenes/GameScene.js',
                'js/entities/Player.js'
            ].filter(Boolean),
            notes: [
                'Weapon sprite saved to assets/weapons/',
                'Weapon added to all damage/fireRate/speed/magazine/reload configurations in Weapon.js',
                'Server damage handling updated for both PvP and PvE',
                'The weapon shop will automatically display the new weapon',
                'Players can switch to it using number keys or scroll wheel',
                config.adminOnly ? 'This weapon is admin-only' : 'This weapon is available to all players'
            ]
        });
        
    } catch (error) {
        console.error('Error generating weapon:', error);
        res.status(500).json({ error: error.message });
    }
});

// Handle character generation
app.post('/api/generate-character', async (req, res) => {
    try {
        const config = req.body;
        const roleName = config.roleName;
        
        // Check if role already exists in Player model
        const playerModelPath = 'models/Player.js';
        let modelContent = await fs.readFile(playerModelPath, 'utf8');
        if (modelContent.includes(`'${roleName}'`)) {
            return res.status(400).json({ 
                error: `Role '${roleName}' already exists. Please choose a different role name.` 
            });
        }
        
        // 1. Save character sprites
        const standingData = config.standingSprite.data.replace(/^data:image\/\w+;base64,/, '');
        const standingBuffer = Buffer.from(standingData, 'base64');
        await fs.writeFile(`assets/characters/stickman_${roleName}.png`, standingBuffer);
        
        const runningData = config.runningSprite.data.replace(/^data:image\/\w+;base64,/, '');
        const runningBuffer = Buffer.from(runningData, 'base64');
        await fs.writeFile(`assets/characters/stickman_running_${roleName}.png`, runningBuffer);
        
        // 2. Update Player.js model
        modelContent = await fs.readFile(playerModelPath, 'utf8');
        
        // Find role enum and add new role
        const enumMatch = /enum:\s*\[(.*?)\]/s;
        const enumResult = modelContent.match(enumMatch);
        if (enumResult) {
            const roles = enumResult[1];
            const newRoles = roles.trim() + `, '${roleName}'`;
            modelContent = modelContent.replace(enumMatch, `enum: [${newRoles}]`);
            await fs.writeFile(playerModelPath, modelContent);
        }
        
        // 3. Update server.js permissions
        if (config.permissions.staff || config.permissions.admin) {
            const serverPath = 'server.js';
            let serverContent = await fs.readFile(serverPath, 'utf8');
            
            if (config.permissions.admin) {
                const adminMatch = /const isAdmin = \[(.*?)\]/;
                const adminResult = serverContent.match(adminMatch);
                if (adminResult && !adminResult[1].includes(`'${roleName}'`)) {
                    const newAdmins = adminResult[1].trim() + `, '${roleName}'`;
                    serverContent = serverContent.replace(adminMatch, `const isAdmin = [${newAdmins}]`);
                }
            }
            
            if (config.permissions.staff) {
                const staffMatch = /const isStaff = \[(.*?)\]/;
                const staffResult = serverContent.match(staffMatch);
                if (staffResult && !staffResult[1].includes(`'${roleName}'`)) {
                    const newStaff = staffResult[1].trim() + `, '${roleName}'`;
                    serverContent = serverContent.replace(staffMatch, `const isStaff = [${newStaff}]`);
                }
            }
            
            await fs.writeFile(serverPath, serverContent);
        }
        
        // 4. Update GameScene.js role colors and symbols
        const scenePath = 'js/scenes/GameScene.js';
        let sceneContent = await fs.readFile(scenePath, 'utf8');
        
        // Add to roleColors
        const colorMatch = /const roleColors = {([^}]+)}/;
        const colorResult = sceneContent.match(colorMatch);
        if (colorResult) {
            const colors = colorResult[1];
            const newColor = `\n  ${roleName}: '${config.roleColor}',`;
            const updatedColors = colors + newColor;
            sceneContent = sceneContent.replace(colorMatch, `const roleColors = {${updatedColors}}`);
        }
        
        // Add to roleSymbols
        const symbolMatch = /const roleSymbols = {([^}]+)}/;
        const symbolResult = sceneContent.match(symbolMatch);
        if (symbolResult) {
            const symbols = symbolResult[1];
            const newSymbol = `\n  ${roleName}: '${config.roleSymbol}',`;
            const updatedSymbols = symbols + newSymbol;
            sceneContent = sceneContent.replace(symbolMatch, `const roleSymbols = {${updatedSymbols}}`);
        }
        
        // Add sprite preloading
        const preloadEnd = sceneContent.indexOf('preload() {') + 'preload() {'.length;
        const newPreloads = `
    try { this.load.image('stickman_${roleName}', 'assets/characters/stickman_${roleName}.png'); } catch (e) {}
    try { this.load.image('stickman_${roleName}_running', 'assets/characters/stickman_running_${roleName}.png'); } catch (e) {}`;
        
        sceneContent = sceneContent.substring(0, preloadEnd) + newPreloads + sceneContent.substring(preloadEnd);
        await fs.writeFile(scenePath, sceneContent);
        
        res.json({
            success: true,
            files: [
                `assets/characters/stickman_${roleName}.png`,
                `assets/characters/stickman_running_${roleName}.png`,
                'models/Player.js',
                'server.js',
                'js/scenes/GameScene.js'
            ]
        });
        
    } catch (error) {
        console.error('Error generating character:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3006;
app.listen(PORT, () => {
    console.log(`Weapon/Character Editor running on http://localhost:${PORT}/weapon-editor.html`);
});