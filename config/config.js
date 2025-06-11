// Load environment variables
require('dotenv').config();

// Configuration with defaults
const config = {
    // Environment
    env: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    
    // Server Ports
    ports: {
        pvp: parseInt(process.env.PVP_PORT) || 3000,
        pve: parseInt(process.env.PVE_PORT) || 3001,
        gui: parseInt(process.env.GUI_PORT) || 3005
    },
    
    // Database
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/castlewars',
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }
    },
    
    // Session
    session: {
        secret: process.env.SESSION_SECRET || 'castle-wars-secret-key-change-in-production',
        guiSecret: process.env.GUI_SESSION_SECRET || 'castle-wars-gui-secret-key-change-in-production'
    },
    
    // Admin
    admin: {
        passwordHash: process.env.ADMIN_PASSWORD_HASH || '$2b$10$XK1.DTKPKl3A4cQv7myAFeFsCKoV.5xTmbUJHiiRwQaYfDS3ImBtC'
    },
    
    // Game Configuration
    game: {
        maxPlayersPerServer: parseInt(process.env.MAX_PLAYERS_PER_SERVER) || 100,
        tickRate: parseInt(process.env.TICK_RATE) || 16,
        worldWidth: 4000,
        worldHeight: 2000,
        groundY: 1936
    },
    
    // PvE Configuration
    pve: {
        maxPlayersPerGame: parseInt(process.env.PVE_MAX_PLAYERS_PER_GAME) || 8,
        initialTeamLives: parseInt(process.env.PVE_INITIAL_TEAM_LIVES) || 20,
        maxActiveNPCs: parseInt(process.env.PVE_MAX_ACTIVE_NPCS) || 100,
        livesPerWave: 5,
        stunDuration: 10000 // 10 seconds
    },
    
    // Security
    security: {
        rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
        rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
        connectionLimitPerIP: parseInt(process.env.CONNECTION_LIMIT_PER_IP) || 10
    },
    
    // Feature Flags
    features: {
        pveMode: process.env.ENABLE_PVE_MODE !== 'false',
        adminCommands: process.env.ENABLE_ADMIN_COMMANDS !== 'false',
        buildingSystem: process.env.ENABLE_BUILDING_SYSTEM !== 'false',
        chat: process.env.ENABLE_CHAT !== 'false'
    },
    
    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info'
    },
    
    // External Services
    external: {
        discordWebhook: process.env.DISCORD_WEBHOOK_URL,
        analyticsKey: process.env.ANALYTICS_KEY
    },
    
    // Auto-restart
    autoRestart: {
        enabled: process.env.AUTO_RESTART_ON_CRASH !== 'false',
        delayMs: parseInt(process.env.AUTO_RESTART_DELAY_MS) || 5000
    },
    
    // Deployment
    deployment: {
        autoUpdate: process.env.DEPLOY_AUTO_UPDATE === 'true',
        branch: process.env.DEPLOY_BRANCH || 'main',
        path: process.env.DEPLOY_PATH || '/root/CastleWars'
    }
};

// Validate configuration
function validateConfig() {
    const errors = [];
    
    // Check if using default secrets in production
    if (config.isProduction) {
        if (config.session.secret.includes('change-in-production')) {
            errors.push('SESSION_SECRET must be changed in production');
        }
        if (config.session.guiSecret.includes('change-in-production')) {
            errors.push('GUI_SESSION_SECRET must be changed in production');
        }
        if (config.admin.passwordHash === '$2b$10$XK1.DTKPKl3A4cQv7myAFeFsCKoV.5xTmbUJHiiRwQaYfDS3ImBtC') {
            errors.push('ADMIN_PASSWORD_HASH must be changed in production (default is "admin")');
        }
    }
    
    // Check port conflicts
    const ports = [config.ports.pvp, config.ports.pve, config.ports.gui];
    if (new Set(ports).size !== ports.length) {
        errors.push('Server ports must be unique');
    }
    
    // Check MongoDB URI
    if (!config.mongodb.uri) {
        errors.push('MONGODB_URI is required');
    }
    
    if (errors.length > 0) {
        console.error('Configuration errors:');
        errors.forEach(err => console.error(`  - ${err}`));
        if (config.isProduction) {
            process.exit(1);
        }
    }
}

// Run validation
validateConfig();

// Log configuration in development
if (config.isDevelopment) {
    console.log('Configuration loaded:', {
        env: config.env,
        ports: config.ports,
        features: config.features
    });
}

module.exports = config;