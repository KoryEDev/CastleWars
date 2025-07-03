const express = require('express');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const net = require('net');
const session = require('express-session');
const bcrypt = require('bcrypt');
const readline = require('readline');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Multi-server configuration
const serverConfigs = {
    pvp: {
        name: 'PvP Server',
        script: 'server.js',
        port: 3000,
        ipcPort: 3002,
        process: null,
        startTime: null,
        logs: [],
        ipcClient: null,
        status: 'offline',
        players: []
    },
    pve: {
        name: 'PvE Server', 
        script: 'server-pve.js',
        port: 3001,
        ipcPort: 3003,
        process: null,
        startTime: null,
        logs: [],
        ipcClient: null,
        status: 'offline',
        players: []
    }
};

const MAX_LOGS = 500; // Keep last 500 log entries per server in memory
const MAX_LOG_LINES = 1000; // Keep last 1000 lines in persistent log files
const LOG_DIR = path.join(__dirname, 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Add log entry for specific server
function addServerLog(serverId, type, message) {
    const server = serverConfigs[serverId];
    if (!server && serverId !== 'system') return;
    
    const logEntry = {
        type,
        message,
        timestamp: new Date().toISOString()
    };
    
    // Add to in-memory logs
    if (server) {
        server.logs.push(logEntry);
        
        // Keep only last MAX_LOGS entries in memory
        if (server.logs.length > MAX_LOGS) {
            server.logs.shift();
        }
    }
    
    // Write to persistent log file
    const logFile = serverId === 'system' ? 'system-logs.txt' : `${serverId}-logs.txt`;
    const logPath = path.join(LOG_DIR, logFile);
    const logLine = `[${logEntry.timestamp}] [${type.toUpperCase()}] ${message}\n`;
    
    fs.appendFile(logPath, logLine, (err) => {
        if (err) {
            console.error(`Error writing to log file ${logFile}:`, err);
        }
    });
    
    // Emit to all connected clients
    io.emit('serverLog', { serverId, log: logEntry });
}

// Load previous logs from file
async function loadPreviousLogs(serverId) {
    const logFile = serverId === 'system' ? 'system-logs.txt' : `${serverId}-logs.txt`;
    const logPath = path.join(LOG_DIR, logFile);
    
    if (!fs.existsSync(logPath)) {
        return [];
    }
    
    const logs = [];
    
    try {
        // Read the file line by line from the end
        const fileContent = fs.readFileSync(logPath, 'utf8');
        const lines = fileContent.trim().split('\n');
        
        // Get the last MAX_LOG_LINES lines
        const recentLines = lines.slice(-MAX_LOG_LINES);
        
        // Parse each line back into a log entry
        for (const line of recentLines) {
            const match = line.match(/^\[([^\]]+)\] \[([^\]]+)\] (.+)$/);
            if (match) {
                logs.push({
                    timestamp: match[1],
                    type: match[2].toLowerCase(),
                    message: match[3]
                });
            }
        }
        
        // If file is too large, rotate it
        if (lines.length > MAX_LOG_LINES * 2) {
            rotateLogFile(logPath, recentLines);
        }
    } catch (err) {
        console.error(`Error loading logs from ${logFile}:`, err);
    }
    
    return logs;
}

// Rotate log file to keep it manageable
function rotateLogFile(logPath, recentLines) {
    try {
        // Write only the recent lines back to the file
        fs.writeFileSync(logPath, recentLines.join('\n') + '\n');
        console.log(`Rotated log file: ${path.basename(logPath)}`);
    } catch (err) {
        console.error(`Error rotating log file ${logPath}:`, err);
    }
}

// Helper function to perform direct restart
async function performDirectRestart(serverId) {
    const server = serverConfigs[serverId];
    if (!server) return;
    
    try {
        console.log(`[AUTO-RESTART] Starting ${serverId} server...`);
        const scriptPath = path.join(__dirname, server.script);
        server.process = spawn('node', [scriptPath], {
            cwd: __dirname,
            env: { ...process.env, NODE_ENV: 'production' }
        });
        
        server.startTime = Date.now();
        server.status = 'starting';
        updateServerStatus();
        
        server.process.stdout.on('data', (data) => {
            const message = data.toString().trim();
            console.log(`[${serverId}] ${message}`);
            addServerLog(serverId, 'info', message);
            
            if (message.includes('Server running on port')) {
                setTimeout(() => connectToGameServer(serverId), 1000);
            }
        });
        
        server.process.stderr.on('data', (data) => {
            const message = data.toString().trim();
            console.error(`[${serverId} ERROR] ${message}`);
            addServerLog(serverId, 'error', message);
        });
        
        server.process.on('close', (code) => {
            console.log(`${server.name} exited with code ${code}`);
            addServerLog(serverId, 'warning', `Server exited with code ${code}`);
            server.process = null;
            server.startTime = null;
            server.status = 'offline';
            server.players = [];
            updateServerStatus();
            
            // Auto-restart if clean exit
            if (code === 0) {
                addServerLog(serverId, 'info', 'Auto-restarting server...');
                setTimeout(() => performDirectRestart(serverId), 1000);
            }
        });
        
        addServerLog(serverId, 'success', 'Server auto-restarted successfully');
        
    } catch (err) {
        console.error(`Error auto-restarting ${server.name}:`, err);
        addServerLog(serverId, 'error', `Failed to auto-restart: ${err.message}`);
    }
}

// Function to connect to game server IPC
function connectToGameServer(serverId) {
    const server = serverConfigs[serverId];
    if (!server) return;
    
    if (server.ipcClient) {
        server.ipcClient.destroy();
    }
    
    server.ipcClient = new net.Socket();
    
    server.ipcClient.connect(server.ipcPort, '127.0.0.1', () => {
        console.log(`Connected to ${server.name} IPC`);
        addServerLog(serverId, 'success', `Connected to ${server.name} IPC`);
        server.status = 'online';
        updateServerStatus();
    });
    
    let buffer = '';
    server.ipcClient.on('data', (data) => {
        buffer += data.toString();
        
        // Process all complete messages in the buffer
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const message = buffer.substring(0, newlineIndex);
            buffer = buffer.substring(newlineIndex + 1);
            
            if (message.trim()) {
                try {
                    const response = JSON.parse(message);
                    console.log(`IPC Response from ${serverId}:`, response);
                    
                    // Handle player list updates
                    if (response.type === 'playerList') {
                        server.players = response.data;
                        io.emit('playerListUpdate', { serverId, players: response.data });
                    }
                    // Handle party list updates (PvE)
                    else if (response.type === 'partyList') {
                        server.parties = response.data;
                        io.emit('partyListUpdate', { serverId, parties: response.data });
                    }
                    // Handle wave data updates (PvE)
                    else if (response.type === 'waveData') {
                        server.waveData = response.data;
                        io.emit('waveDataUpdate', { serverId, waveData: response.data });
                    }
                    // Handle NPC list updates (PvE)
                    else if (response.type === 'npcList') {
                        server.npcs = response.data;
                        io.emit('npcListUpdate', { serverId, npcs: response.data });
                    }
                } catch (err) {
                    console.error(`Error parsing IPC response from ${serverId}:`, err, 'Message:', message);
                }
            }
        }
    });
    
    server.ipcClient.on('error', (err) => {
        // Only log non-connection refused errors (to avoid spam when server is offline)
        if (err.code !== 'ECONNREFUSED') {
            console.error(`IPC connection error for ${serverId}:`, err);
            addServerLog(serverId, 'error', `IPC connection error: ${err.message}`);
        }
        server.ipcClient = null;
        server.status = 'offline';
        updateServerStatus();
    });
    
    server.ipcClient.on('close', () => {
        console.log(`IPC connection closed for ${serverId}`);
        server.ipcClient = null;
        if (server.process) {
            server.status = 'no-ipc';
        } else {
            server.status = 'offline';
        }
        updateServerStatus();
    });
}

// Send command to specific game server via IPC
function sendToGameServer(serverId, command) {
    const server = serverConfigs[serverId];
    if (!server) {
        console.error(`[IPC] Server ${serverId} not found`);
        return false;
    }
    if (!server.ipcClient) {
        console.error(`[IPC] No IPC client for ${serverId}`);
        return false;
    }
    if (!server.ipcClient.writable) {
        console.error(`[IPC] IPC client for ${serverId} not writable`);
        return false;
    }
    try {
        const message = JSON.stringify(command) + '\n';
        console.log(`[IPC] Writing to ${serverId}: ${message.trim()}`);
        server.ipcClient.write(message);
        console.log(`[IPC] Successfully sent to ${serverId}:`, command);
        return true;
    } catch (err) {
        console.error(`[IPC] Error sending to ${serverId}:`, err);
        return false;
    }
}

// Update server status for all clients
function updateServerStatus() {
    const status = {};
    for (const [id, server] of Object.entries(serverConfigs)) {
        status[id] = {
            name: server.name,
            status: server.status,
            uptime: server.startTime ? Date.now() - server.startTime : 0,
            playerCount: server.players.length,
            port: server.port,
            // PvE-specific data
            parties: server.parties || [],
            waveData: server.waveData || {},
            npcCount: server.npcs ? server.npcs.length : 0
        };
    }
    io.emit('serverStatus', status);
}

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'castle-wars-gui-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.use(express.json());

// Admin password (should be in environment variable in production)
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || 
    bcrypt.hashSync('admin', 10); // Default password is 'admin'

// Auth middleware
function requireAuth(req, res, next) {
    if (req.session.authenticated) {
        next();
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
}

// Login endpoint
app.post('/login', async (req, res) => {
    const { password } = req.body;
    
    try {
        const isValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
        if (isValid) {
            req.session.authenticated = true;
            res.json({ success: true });
        } else {
            res.status(401).json({ error: 'Invalid password' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Authentication error' });
    }
});

// Session endpoint for GUI auth check
app.get('/api/gui/session', (req, res) => {
    if (req.session.authenticated) {
        res.json({ 
            authenticated: true, 
            username: 'admin',
            role: 'owner'
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Logout endpoint
app.post('/api/gui/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Server status endpoint
app.get('/api/server/:serverId/status', (req, res) => {
    const { serverId } = req.params;
    const server = serverConfigs[serverId];
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    res.json({
        online: server.status === 'online',
        status: server.status,
        uptime: server.startTime ? Date.now() - server.startTime : 0,
        playerCount: server.players.length
    });
});

// Start server
app.post('/api/server/:serverId/start', requireAuth, (req, res) => {
    const { serverId } = req.params;
    const server = serverConfigs[serverId];
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    if (server.process) {
        return res.status(400).json({ error: 'Server already running' });
    }
    
    try {
        const scriptPath = path.join(__dirname, server.script);
        server.process = spawn('node', [scriptPath], {
            cwd: __dirname,
            env: { ...process.env, NODE_ENV: 'production' }
        });
        
        server.startTime = Date.now();
        server.status = 'starting';
        updateServerStatus();
        
        server.process.stdout.on('data', (data) => {
            const message = data.toString().trim();
            console.log(`[${serverId}] ${message}`);
            addServerLog(serverId, 'info', message);
            
            // Check if server is ready
            if (message.includes('Server running on port')) {
                setTimeout(() => connectToGameServer(serverId), 1000);
            }
        });
        
        server.process.stderr.on('data', (data) => {
            const message = data.toString().trim();
            console.error(`[${serverId} ERROR] ${message}`);
            addServerLog(serverId, 'error', message);
        });
        
        // Define close handler with auto-restart
        const closeHandler = (code) => {
            console.log(`${server.name} exited with code ${code}`);
            addServerLog(serverId, 'warning', `Server exited with code ${code}`);
            server.process = null;
            server.startTime = null;
            server.status = 'offline';
            server.players = [];
            updateServerStatus();
            
            // Auto-restart if it was a clean exit (code 0) indicating restart request
            if (code === 0) {
                addServerLog(serverId, 'info', 'Auto-restarting server...');
                setTimeout(() => {
                    // Restart the server
                    const scriptPath = serverId === 'pvp' ? './server.js' : './server-pve.js';
                    try {
                        server.process = spawn('node', [scriptPath], {
                            cwd: __dirname,
                            stdio: ['ignore', 'pipe', 'pipe']
                        });
                        
                        server.startTime = Date.now();
                        server.status = 'starting';
                        updateServerStatus();
                        
                        // Re-attach event handlers
                        server.process.stdout.on('data', (data) => {
                            const message = data.toString();
                            if (message.includes('Server running on port') || message.includes('PvE Server running on port')) {
                                server.status = 'online';
                                updateServerStatus();
                            }
                            process.stdout.write(`[${server.name}] ${message}`);
                            addServerLog(serverId, 'info', message);
                        });
                        
                        server.process.stderr.on('data', (data) => {
                            const message = data.toString();
                            process.stderr.write(`[${server.name} ERROR] ${message}`);
                            addServerLog(serverId, 'error', message);
                        });
                        
                        // Re-attach close handler recursively
                        server.process.on('close', closeHandler);
                        
                        addServerLog(serverId, 'success', 'Server restarted successfully');
                    } catch (err) {
                        console.error(`Error restarting ${server.name}:`, err);
                        addServerLog(serverId, 'error', `Failed to restart: ${err.message}`);
                    }
                }, 1000); // Wait 1 second before restarting
            }
        };
        
        server.process.on('close', closeHandler);
        
        res.json({ success: true, message: `${server.name} starting...` });
    } catch (err) {
        console.error(`Error starting ${server.name}:`, err);
        res.status(500).json({ error: err.message });
    }
});

// Stop server
app.post('/api/server/:serverId/stop', requireAuth, (req, res) => {
    const { serverId } = req.params;
    const server = serverConfigs[serverId];
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    if (!server.process) {
        return res.status(400).json({ error: 'Server not running' });
    }
    
    // Try graceful shutdown first via IPC
    const shutdownSent = sendToGameServer(serverId, { type: 'shutdownGracefully' });
    
    if (shutdownSent) {
        addServerLog(serverId, 'info', 'Graceful shutdown initiated');
        
        // Give it 5 seconds to shut down gracefully
        setTimeout(() => {
            if (server.process) {
                server.process.kill();
                addServerLog(serverId, 'warning', 'Force killed server process');
            }
        }, 5000);
    } else {
        // No IPC connection, force kill
        server.process.kill();
        addServerLog(serverId, 'warning', 'Force killed server process (no IPC)');
    }
    
    res.json({ success: true, message: `${server.name} stopping...` });
});

// Helper function to stop a server
async function stopServer(serverId) {
    const server = serverConfigs[serverId];
    if (!server || !server.process) return true;
    
    return new Promise((resolve) => {
        const process = server.process;
        const pid = process.pid;
        
        // Set up exit handler
        process.once('exit', () => {
            console.log(`[STOP] Server ${serverId} stopped`);
            resolve(true);
        });
        
        // Clear server state
        server.process = null;
        server.startTime = null;
        server.status = 'offline';
        server.players = [];
        
        if (server.ipcClient) {
            server.ipcClient.destroy();
            server.ipcClient = null;
        }
        
        updateServerStatus();
        
        // Try graceful shutdown
        try {
            process.kill('SIGTERM');
            
            // Force kill after 5 seconds if still running
            setTimeout(() => {
                try {
                    process.kill('SIGKILL');
                } catch (e) {
                    // Process already dead
                }
            }, 5000);
        } catch (err) {
            console.error(`[STOP] Error stopping server:`, err);
            resolve(false);
        }
    });
}

// Helper function to start a server
async function startServer(serverId) {
    const server = serverConfigs[serverId];
    if (!server || server.process) return false;
    
    try {
        const scriptPath = path.join(__dirname, server.script);
        server.process = spawn('node', [scriptPath], {
            cwd: __dirname,
            env: { ...process.env, NODE_ENV: 'production' },
            detached: false
        });
        
        server.startTime = Date.now();
        server.status = 'starting';
        updateServerStatus();
        
        // Set up output handlers
        server.process.stdout.on('data', (data) => {
            const message = data.toString().trim();
            console.log(`[${serverId}] ${message}`);
            addServerLog(serverId, 'info', message);
            
            if (message.includes('Server running on port')) {
                setTimeout(() => connectToGameServer(serverId), 1000);
            }
        });
        
        server.process.stderr.on('data', (data) => {
            const message = data.toString().trim();
            console.error(`[${serverId} ERROR] ${message}`);
            addServerLog(serverId, 'error', message);
        });
        
        server.process.on('exit', (code) => {
            console.log(`${server.name} exited with code ${code}`);
            addServerLog(serverId, 'warning', `Server exited with code ${code}`);
            server.process = null;
            server.startTime = null;
            server.status = 'offline';
            server.players = [];
            
            if (server.ipcClient) {
                server.ipcClient.destroy();
                server.ipcClient = null;
            }
            
            updateServerStatus();
            
            // Auto-restart if clean exit
            if (code === 0) {
                setTimeout(() => {
                    addServerLog(serverId, 'info', 'Auto-restarting server...');
                    startServer(serverId);
                }, 2000);
            }
        });
        
        addServerLog(serverId, 'success', `Server started (PID: ${server.process.pid})`);
        return true;
        
    } catch (err) {
        console.error(`[START] Error starting server:`, err);
        addServerLog(serverId, 'error', `Failed to start: ${err.message}`);
        return false;
    }
}

// Simple restart function that reuses stop and start
async function restartServer(serverId) {
    const server = serverConfigs[serverId];
    if (!server) return false;
    
    console.log(`[RESTART] Restarting ${serverId} server...`);
    addServerLog(serverId, 'info', 'Restarting server...');
    
    // Stop the server if running
    if (server.process) {
        await stopServer(serverId);
        // Wait for port to be released
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Start the server
    return await startServer(serverId);
}

// Restart server endpoint
app.post('/api/server/:serverId/restart', requireAuth, async (req, res) => {
    const { serverId } = req.params;
    const { countdown = 0, message } = req.body;
    const server = serverConfigs[serverId];
    
    console.log(`[RESTART] Restart request received for ${serverId}`);
    addServerLog(serverId, 'info', `Restart request received`);
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    // If server isn't running, just start it
    if (!server.process) {
        addServerLog(serverId, 'info', 'Server not running, starting instead of restarting');
        return res.redirect(307, `/api/server/${serverId}/start`);
    }
    
    // Send success response immediately
    res.json({ success: true, message: `${server.name} restarting...` });
    
    // Handle countdown restart via IPC if countdown > 0
    if (countdown > 0 && server.ipcClient) {
        try {
            await sendIPCCommand(serverId, {
                type: 'restart',
                countdown,
                message: message || `Server restarting in ${countdown} seconds...`
            });
        } catch (err) {
            console.error(`[RESTART] IPC restart failed, falling back to direct restart:`, err);
            await restartServer(serverId);
        }
    } else {
        // Direct restart
        await restartServer(serverId);
    }
});

// Command endpoint
app.post('/api/server/:serverId/command', requireAuth, (req, res) => {
    const { serverId } = req.params;
    const { command } = req.body;
    
    if (!command) {
        return res.status(400).json({ error: 'Command required' });
    }
    
    // Parse command
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    
    let ipcCommand = { type: cmd, data: {} };
    
    // Add arguments based on command
    switch(cmd) {
        case 'promote':
            if (args[0]) ipcCommand.data.username = args[0];
            if (args[1]) ipcCommand.data.role = args[1];
            break;
        case 'kick':
        case 'ban':
        case 'unban':
            if (args[0]) ipcCommand.data.username = args[0];
            break;
        case 'announce':
            ipcCommand.data.message = args.join(' ');
            break;
        case 'resetworld':
            ipcCommand.type = 'resetWorld';
            break;
        case 'clearplayers':
            ipcCommand.type = 'clearPlayers';
            break;
        case 'spawnnpc':
            ipcCommand.type = 'spawnNPC';
            ipcCommand.data.type = args[0] || 'zombie';
            break;
        case 'clearnpcs':
            ipcCommand.type = 'clearNPCs';
            break;
        case 'startwave':
            ipcCommand.type = 'startWave';
            break;
        case 'endwave':
            ipcCommand.type = 'endWave';
            break;
        case 'spawnenemy':
            ipcCommand.type = 'spawnEnemy';
            break;
        case 'gitstatus':
            // Execute git status locally and return result
            const { exec } = require('child_process');
            exec('git status --porcelain', { cwd: __dirname }, (error, stdout, stderr) => {
                const message = error ? `Error: ${error.message}` : 
                               stdout ? `Git status:\n${stdout}` : 
                               'Working directory clean';
                addServerLog(serverId, 'info', message);
            });
            return res.json({ success: true, message: 'Git status check initiated' });
        default:
            // For unknown commands, pass as-is
            ipcCommand = { type: 'command', data: { command: cmd, args } };
    }
    
    if (sendToGameServer(serverId, ipcCommand)) {
        res.json({ success: true, message: `Command '${command}' sent to server` });
        addServerLog(serverId, 'info', `Sent command: ${command}`);
    } else {
        res.status(400).json({ error: 'No connection to server' });
    }
});

// Announce endpoint
app.post('/api/server/:serverId/announce', requireAuth, (req, res) => {
    const { serverId } = req.params;
    const { message, type = 'info' } = req.body;
    
    if (sendToGameServer(serverId, { type: 'announce', data: { message, type } })) {
        res.json({ success: true });
        addServerLog(serverId, 'info', `Announcement sent: ${message}`);
    } else {
        res.status(400).json({ error: 'No connection to server' });
    }
});

// Backup endpoints
app.post('/api/server/:serverId/backup', requireAuth, async (req, res) => {
    const { serverId } = req.params;
    const { description } = req.body;
    
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup-${serverId}-${timestamp}.json`;
        const backupPath = path.join(__dirname, 'backups', filename);
        
        // Create backups directory if it doesn't exist
        if (!fs.existsSync(path.join(__dirname, 'backups'))) {
            fs.mkdirSync(path.join(__dirname, 'backups'));
        }
        
        // For now, create a simple backup with current timestamp
        // In production, this would request data from the game server
        const backupData = {
            serverId,
            timestamp: new Date().toISOString(),
            description: description || '',
            players: [],
            buildings: [],
            metadata: {
                createdBy: 'GUI',
                serverStatus: serverConfigs[serverId]?.status || 'unknown'
            }
        };
        
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        
        res.json({ success: true, filename });
        addServerLog(serverId, 'success', `Backup created: ${filename}`);
    } catch (err) {
        console.error('Backup creation error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/backups/list', requireAuth, (req, res) => {
    try {
        const backupDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupDir)) {
            return res.json({ success: true, backups: [] });
        }
        
        const files = fs.readdirSync(backupDir)
            .filter(f => f.endsWith('.json'))
            .map(filename => {
                const stats = fs.statSync(path.join(backupDir, filename));
                let description = '';
                try {
                    const backupData = JSON.parse(fs.readFileSync(path.join(backupDir, filename), 'utf8'));
                    description = backupData.description || '';
                } catch (e) {
                    // Ignore errors reading backup file
                }
                return {
                    filename,
                    timestamp: stats.mtime,
                    size: stats.size,
                    description
                };
            })
            .sort((a, b) => b.timestamp - a.timestamp);
        
        res.json({ success: true, backups: files });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/backups/restore', requireAuth, async (req, res) => {
    const { filename, serverId, restorePlayers, restoreBuildings } = req.body;
    
    try {
        const backupPath = path.join(__dirname, 'backups', filename);
        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({ error: 'Backup file not found' });
        }
        
        // Read backup data
        const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        
        // Send restore command to server
        if (sendToGameServer(serverId, { 
            command: 'restore', 
            data: backupData,
            restorePlayers,
            restoreBuildings
        })) {
            res.json({ success: true, message: 'Backup restored successfully' });
        } else {
            res.status(400).json({ error: 'Server must be running to restore backup' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/backups/delete', requireAuth, (req, res) => {
    const { filename } = req.body;
    
    try {
        const backupPath = path.join(__dirname, 'backups', filename);
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Backup file not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Clear logs endpoint
app.post('/api/server/:serverId/logs/clear', requireAuth, (req, res) => {
    const { serverId } = req.params;
    const server = serverConfigs[serverId];
    
    if (!server && serverId !== 'system') {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    try {
        // Clear in-memory logs
        if (server) {
            server.logs = [];
        }
        
        // Clear persistent log file
        const logFile = serverId === 'system' ? 'system-logs.txt' : `${serverId}-logs.txt`;
        const logPath = path.join(LOG_DIR, logFile);
        
        if (fs.existsSync(logPath)) {
            fs.writeFileSync(logPath, '');
        }
        
        res.json({ success: true, message: `Logs cleared for ${serverId}` });
        addServerLog(serverId, 'info', 'Logs cleared');
        
        // Notify connected clients
        io.emit('serverLogs', { serverId, logs: [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get logs endpoint
app.get('/api/server/:serverId/logs', requireAuth, async (req, res) => {
    const { serverId } = req.params;
    const { limit = 100 } = req.query;
    const server = serverConfigs[serverId];
    
    if (!server && serverId !== 'system') {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    try {
        // Load logs from file if needed
        const logs = await loadPreviousLogs(serverId);
        const limitedLogs = logs.slice(-limit);
        
        res.json({ success: true, logs: limitedLogs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Download logs endpoint
app.get('/api/server/:serverId/logs/download', requireAuth, (req, res) => {
    const { serverId } = req.params;
    const server = serverConfigs[serverId];
    
    if (!server && serverId !== 'system') {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    try {
        const logFile = serverId === 'system' ? 'system-logs.txt' : `${serverId}-logs.txt`;
        const logPath = path.join(LOG_DIR, logFile);
        
        if (!fs.existsSync(logPath)) {
            return res.status(404).json({ error: 'Log file not found' });
        }
        
        // Set headers for file download
        res.setHeader('Content-Disposition', `attachment; filename="${logFile}"`);
        res.setHeader('Content-Type', 'text/plain');
        
        // Stream the file
        const stream = fs.createReadStream(logPath);
        stream.pipe(res);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete backup endpoint
app.post('/api/backups/delete', requireAuth, (req, res) => {
    const { filename } = req.body;
    
    if (!filename) {
        return res.status(400).json({ error: 'Filename required' });
    }
    
    try {
        const backupPath = path.join(__dirname, 'backups', filename);
        
        // Security check - ensure filename doesn't contain path traversal
        if (filename.includes('..') || filename.includes('/')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }
        
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
            res.json({ success: true });
            console.log(`Deleted backup: ${filename}`);
        } else {
            res.status(404).json({ error: 'Backup not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Git pull endpoint - supports both SSH and HTTPS with token
app.post('/api/git/pull', requireAuth, async (req, res) => {
    const { autoUpdate } = req.body;
    
    try {
        addServerLog('system', 'info', 'Starting update process...');
        
        // Check current remote URL
        exec('git remote get-url origin', { cwd: __dirname }, (remoteErr, remoteStdout) => {
            const currentRemote = remoteStdout ? remoteStdout.trim() : '';
            addServerLog('system', 'info', `Current remote: ${currentRemote}`);
            
            // Check if we need to use HTTPS with token
            const hasToken = !!process.env.GITHUB_TOKEN;
            addServerLog('system', 'info', `GitHub token ${hasToken ? 'found' : 'not found'} in environment`);
            const useHttps = process.env.GITHUB_TOKEN && currentRemote.includes('github.com');
            
            if (useHttps && currentRemote.startsWith('git@')) {
                // Convert SSH URL to HTTPS with token
                let httpsUrl = currentRemote.replace('git@github.com:', `https://${process.env.GITHUB_TOKEN}@github.com/`);
                
                // Keep .git suffix if it exists
                if (!httpsUrl.endsWith('.git') && currentRemote.endsWith('.git')) {
                    httpsUrl += '.git';
                }
                
                addServerLog('system', 'info', 'Converting to HTTPS URL with token...');
                
                // Temporarily change remote to HTTPS with token
                exec(`git remote set-url origin ${httpsUrl}`, { cwd: __dirname }, (setUrlErr) => {
                    if (setUrlErr) {
                        addServerLog('system', 'error', 'Failed to set HTTPS URL: ' + setUrlErr.message);
                        return res.status(500).json({ success: false, error: setUrlErr.message });
                    }
                    
                    // Pull with HTTPS
                    performGitPull(res, autoUpdate, () => {
                        // Restore original SSH URL
                        exec(`git remote set-url origin ${currentRemote}`, { cwd: __dirname });
                    });
                });
            } else if (!hasToken && currentRemote.startsWith('git@')) {
                // No token but using SSH - provide helpful message
                addServerLog('system', 'error', 'SSH URL detected but no GitHub token found.');
                addServerLog('system', 'warning', 'To fix: Add GITHUB_TOKEN to your .env file');
                addServerLog('system', 'warning', 'OR manually switch to HTTPS:');
                addServerLog('system', 'warning', `git remote set-url origin https://github.com/KoryEDev/CastleWars.git`);
                return res.status(500).json({ 
                    success: false, 
                    error: 'GitHub token required for SSH URLs. Add GITHUB_TOKEN to .env file.' 
                });
            } else {
                // Use existing configuration
                performGitPull(res, autoUpdate);
            }
        });
    } catch (err) {
        addServerLog('system', 'error', 'Error pulling updates: ' + err.message);
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// Helper function to perform git pull
function performGitPull(res, autoUpdate, callback) {
    exec('git pull origin main', { cwd: __dirname }, (error, stdout, stderr) => {
            if (error) {
                console.error('Git pull error:', error);
                addServerLog('system', 'error', 'Git pull failed: ' + error.message);
                
                // Check if it's an SSH key issue
                if (error.message.includes('Permission denied (publickey)')) {
                    addServerLog('system', 'warning', 'SSH key issue detected. To fix:');
                    addServerLog('system', 'warning', '1. Run your GUI server as root: sudo npm run gui-multi');
                    addServerLog('system', 'warning', 'OR');
                    addServerLog('system', 'warning', '2. Copy SSH keys to current user: sudo cp -r /root/.ssh ~/');
                    addServerLog('system', 'warning', '3. Fix permissions: sudo chown -R $(whoami):$(whoami) ~/.ssh');
                    addServerLog('system', 'warning', 'OR');
                    addServerLog('system', 'warning', '4. Use HTTPS with token: git config --global credential.helper store');
                }
                
                return res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
            
            if (callback) callback();
            
            const output = stdout.toString();
            
            // Log the git output
            if (output) {
                output.split('\n').forEach(line => {
                    if (line.trim()) {
                        addServerLog('system', 'info', line.trim());
                    }
                });
            }
            
            const updated = !output.includes('Already up to date');
            
            if (updated) {
                addServerLog('system', 'success', 'Updates pulled successfully!');
                
                // Check if package.json or server files changed
                exec('git diff HEAD~1 HEAD --name-only', { cwd: __dirname }, (diffErr, diffOutput) => {
                    const changedFiles = diffOutput ? diffOutput.toString().split('\n') : [];
                    const needsNpmInstall = changedFiles.some(f => f.includes('package.json'));
                    const needsRestart = changedFiles.some(f => 
                        f.includes('server-gui-multi.js') || 
                        f.includes('package.json') ||
                        f.includes('.js')
                    );
                    
                    if (needsNpmInstall && autoUpdate) {
                        addServerLog('system', 'info', 'Dependencies changed, installing...');
                        exec('npm install', { cwd: __dirname }, (installErr) => {
                            if (installErr) {
                                addServerLog('system', 'error', 'npm install failed: ' + installErr.message);
                            } else {
                                addServerLog('system', 'success', 'Dependencies installed successfully');
                            }
                            
                            // Auto-restart servers after updates
                            if (needsRestart) {
                                restartServersAfterUpdate();
                            }
                            
                            res.json({ 
                                success: true, 
                                updated: true, 
                                needsRestart: needsRestart,
                                message: 'Updates pulled and dependencies installed'
                            });
                            
                            // If GUI needs restart, schedule it
                            if (needsRestart && changedFiles.some(f => f.includes('server-gui-multi.js') || f.includes('control-panel'))) {
                                addServerLog('system', 'warning', 'GUI server will restart in 10 seconds to apply updates...');
                                setTimeout(() => {
                                    addServerLog('system', 'info', 'GUI server restarting...');
                                    process.exit(0); // Clean exit for auto-restart
                                }, 10000);
                            }
                        });
                    } else {
                        // Auto-restart servers after updates
                        if (needsRestart) {
                            restartServersAfterUpdate();
                        }
                        
                        res.json({ 
                            success: true, 
                            updated: true, 
                            needsRestart: needsRestart,
                            message: 'Updates pulled successfully'
                        });
                        
                        // If GUI needs restart, schedule it
                        if (needsRestart && changedFiles.some(f => f.includes('server-gui-multi.js') || f.includes('control-panel'))) {
                            addServerLog('system', 'warning', 'GUI server will restart in 10 seconds to apply updates...');
                            setTimeout(() => {
                                addServerLog('system', 'info', 'GUI server restarting...');
                                process.exit(0); // Clean exit for auto-restart
                            }, 10000);
                        }
                    }
                });
            } else {
                addServerLog('system', 'info', 'Already up to date - no updates available.');
                res.json({ 
                    success: true, 
                    updated: false,
                    message: 'Already up to date'
                });
            }
        });
}


// Serve the multi-server GUI HTML
app.get('/', (req, res) => {
    if (req.session.authenticated) {
        res.sendFile(path.join(__dirname, 'control-panel-v2.html'));
    } else {
        res.redirect('/login');
    }
});

// Serve login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'gui-login-v2.html'));
});

// Serve debug page
app.get('/debug', (req, res) => {
    res.sendFile(path.join(__dirname, 'debug-gui-restart.html'));
});

// Serve test restart page
app.get('/test-restart', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-restart.html'));
});

// Serve simple test page
app.get('/test-simple', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-restart-simple.html'));
});

// Debug endpoint to check server state
app.get('/api/debug/server-state', requireAuth, (req, res) => {
    const state = {};
    for (const [serverId, server] of Object.entries(serverConfigs)) {
        state[serverId] = {
            name: server.name,
            hasProcess: !!server.process,
            processId: server.process?.pid || null,
            status: server.status,
            hasIpcClient: !!server.ipcClient,
            ipcWritable: server.ipcClient?.writable || false,
            uptime: server.startTime ? Date.now() - server.startTime : 0,
            playerCount: server.players.length
        };
    }
    res.json(state);
});

// Socket.IO connection handling
io.on('connection', async (socket) => {
    console.log('GUI client connected');
    
    // Send initial server status
    updateServerStatus();
    
    // Load and send persistent logs for all servers
    for (const [serverId, server] of Object.entries(serverConfigs)) {
        try {
            // Load historical logs from file
            const historicalLogs = await loadPreviousLogs(serverId);
            
            // Combine with current in-memory logs (avoiding duplicates)
            const allLogs = [...historicalLogs];
            
            // Add recent in-memory logs that might not be persisted yet
            const lastHistoricalTime = historicalLogs.length > 0 
                ? new Date(historicalLogs[historicalLogs.length - 1].timestamp).getTime()
                : 0;
                
            for (const log of server.logs) {
                const logTime = new Date(log.timestamp).getTime();
                if (logTime > lastHistoricalTime) {
                    allLogs.push(log);
                }
            }
            
            // Send all logs
            socket.emit('serverLogs', { serverId, logs: allLogs });
            
            addLog('system', 'info', `Loaded ${allLogs.length} log entries for ${server.name}`);
        } catch (err) {
            console.error(`Error loading logs for ${serverId}:`, err);
            // Send just in-memory logs as fallback
            socket.emit('serverLogs', { serverId, logs: server.logs });
        }
    }
    
    // Request player lists if connected
    for (const [serverId, server] of Object.entries(serverConfigs)) {
        if (server.ipcClient) {
            sendToGameServer(serverId, { type: 'getPlayers' });
        }
    }
    
    socket.on('disconnect', () => {
        console.log('GUI client disconnected');
    });
});

// Keep track of last connection attempt to avoid spamming
const lastConnectionAttempt = {};

// Start checking server status periodically
setInterval(() => {
    for (const [serverId, server] of Object.entries(serverConfigs)) {
        if (server.ipcClient) {
            sendToGameServer(serverId, { type: 'getPlayers' });
        } else {
            // Only try to reconnect every 15 seconds to avoid spamming logs
            const now = Date.now();
            if (!lastConnectionAttempt[serverId] || now - lastConnectionAttempt[serverId] > 15000) {
                lastConnectionAttempt[serverId] = now;
                connectToGameServer(serverId);
            }
        }
    }
}, 5000);

// Function to restart servers after git updates
async function restartServersAfterUpdate() {
    addServerLog('system', 'info', 'Auto-restarting servers after update...');
    
    // Track which servers were running
    const runningServers = [];
    
    for (const [serverId, server] of Object.entries(serverConfigs)) {
        if (server.process) {
            runningServers.push(serverId);
            addServerLog(serverId, 'info', 'Preparing to restart for updates...');
            
            // Send graceful shutdown command with notice
            if (server.ipcClient) {
                sendToGameServer(serverId, { 
                    type: 'announce', 
                    data: { 
                        message: '⚠️ Server restarting for updates in 10 seconds!', 
                        type: 'warning' 
                    } 
                });
                
                // Give players time to see the message
                await new Promise(resolve => setTimeout(resolve, 10000));
                
                // Graceful shutdown
                sendToGameServer(serverId, { type: 'shutdownGracefully' });
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // Force kill if still running
            if (server.process) {
                server.process.kill();
                server.process = null;
                server.startTime = null;
                server.status = 'offline';
                server.players = [];
            }
        }
    }
    
    // Wait a bit for processes to fully terminate
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Restart the servers that were running
    for (const serverId of runningServers) {
        const server = serverConfigs[serverId];
        addServerLog(serverId, 'info', 'Restarting server...');
        
        try {
            const scriptPath = path.join(__dirname, server.script);
            server.process = spawn('node', [scriptPath], {
                cwd: __dirname,
                env: { ...process.env, NODE_ENV: 'production' }
            });
            
            server.startTime = Date.now();
            server.status = 'starting';
            updateServerStatus();
            
            server.process.stdout.on('data', (data) => {
                const message = data.toString().trim();
                console.log(`[${serverId}] ${message}`);
                addServerLog(serverId, 'info', message);
                
                // Check if server is ready
                if (message.includes('Server running on port')) {
                    setTimeout(() => connectToGameServer(serverId), 1000);
                }
            });
            
            server.process.stderr.on('data', (data) => {
                const message = data.toString().trim();
                console.error(`[${serverId} ERROR] ${message}`);
                addServerLog(serverId, 'error', message);
            });
            
            server.process.on('close', (code) => {
                console.log(`${server.name} exited with code ${code}`);
                addServerLog(serverId, 'warning', `Server exited with code ${code}`);
                server.process = null;
                server.startTime = null;
                server.status = 'offline';
                server.players = [];
                updateServerStatus();
            });
            
            addServerLog(serverId, 'success', 'Server restart initiated');
        } catch (err) {
            console.error(`Error restarting ${server.name}:`, err);
            addServerLog(serverId, 'error', `Failed to restart: ${err.message}`);
        }
    }
    
    if (runningServers.length === 0) {
        addServerLog('system', 'info', 'No servers were running, so none were restarted');
    } else {
        addServerLog('system', 'success', `Restarted ${runningServers.length} server(s) after update`);
    }
}

// Initialize server logs on startup
async function initializeServerLogs() {
    for (const [serverId, server] of Object.entries(serverConfigs)) {
        const previousLogs = await loadPreviousLogs(serverId);
        // Take only the last MAX_LOGS entries for in-memory storage
        server.logs = previousLogs.slice(-MAX_LOGS);
        console.log(`Loaded ${previousLogs.length} previous log entries for ${server.name}`);
    }
}

const PORT = process.env.GUI_PORT || 3005;
server.listen(PORT, async () => {
    console.log(`Multi-Server GUI running on http://localhost:${PORT}`);
    
    // Load previous logs
    await initializeServerLogs();
    
    addServerLog('pvp', 'info', 'Multi-Server GUI started');
    addServerLog('pve', 'info', 'Multi-Server GUI started');
    
    // Try to connect to already-running servers on startup
    console.log('Attempting to connect to running game servers...');
    for (const [serverId, server] of Object.entries(serverConfigs)) {
        console.log(`Checking if ${server.name} is running on port ${server.port}...`);
        // Try to connect to IPC port to see if server is running
        connectToGameServer(serverId);
    }
});