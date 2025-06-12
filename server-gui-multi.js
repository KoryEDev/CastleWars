const express = require('express');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const net = require('net');
const session = require('express-session');
const bcrypt = require('bcrypt');

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

const MAX_LOGS = 500; // Keep last 500 log entries per server

// Add log entry for specific server
function addServerLog(serverId, type, message) {
    const server = serverConfigs[serverId];
    if (!server) return;
    
    const logEntry = {
        type,
        message,
        timestamp: new Date().toISOString()
    };
    
    server.logs.push(logEntry);
    
    // Keep only last MAX_LOGS entries
    if (server.logs.length > MAX_LOGS) {
        server.logs.shift();
    }
    
    // Emit to all connected clients
    io.emit('serverLog', { serverId, log: logEntry });
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
    
    server.ipcClient.on('data', (data) => {
        try {
            const response = JSON.parse(data.toString());
            console.log(`IPC Response from ${serverId}:`, response);
            
            // Handle player list updates
            if (response.type === 'playerList') {
                server.players = response.data;
                io.emit('playerListUpdate', { serverId, players: response.data });
            }
        } catch (err) {
            console.error(`Error parsing IPC response from ${serverId}:`, err);
        }
    });
    
    server.ipcClient.on('error', (err) => {
        console.error(`IPC connection error for ${serverId}:`, err);
        server.ipcClient = null;
        server.status = 'error';
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
    if (!server || !server.ipcClient || !server.ipcClient.writable) {
        return false;
    }
    server.ipcClient.write(JSON.stringify(command));
    return true;
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
            port: server.port
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
        
        server.process.on('close', (code) => {
            console.log(`${server.name} exited with code ${code}`);
            addServerLog(serverId, 'warning', `Server exited with code ${code}`);
            server.process = null;
            server.startTime = null;
            server.status = 'offline';
            server.players = [];
            updateServerStatus();
        });
        
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
    const shutdownSent = sendToGameServer(serverId, { command: 'shutdownGracefully' });
    
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

// Restart server
app.post('/api/server/:serverId/restart', requireAuth, async (req, res) => {
    const { serverId } = req.params;
    const { countdown = 30, message } = req.body;
    const server = serverConfigs[serverId];
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    if (server.ipcClient) {
        sendToGameServer(serverId, { command: 'restartCountdown', countdown, message });
        res.json({ success: true, message: `Restart countdown initiated: ${countdown} seconds` });
    } else {
        res.status(400).json({ error: 'No connection to server' });
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
                return {
                    filename,
                    timestamp: stats.mtime,
                    size: stats.size
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

// Git pull endpoint - simplified version that works with SSH
app.post('/api/git/pull', requireAuth, async (req, res) => {
    const { autoUpdate } = req.body;
    
    try {
        addServerLog('system', 'info', 'Starting update process...');
        
        // Simple git pull without any fancy options
        exec('git pull', { cwd: __dirname }, (error, stdout, stderr) => {
            if (error) {
                console.error('Git pull error:', error);
                addServerLog('system', 'error', 'Git pull failed: ' + error.message);
                return res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
            
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
                            
                            res.json({ 
                                success: true, 
                                updated: true, 
                                needsRestart: needsRestart,
                                message: 'Updates pulled and dependencies installed'
                            });
                        });
                    } else {
                        res.json({ 
                            success: true, 
                            updated: true, 
                            needsRestart: needsRestart,
                            message: 'Updates pulled successfully'
                        });
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
    } catch (err) {
        addServerLog('system', 'error', 'Error pulling updates: ' + err.message);
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

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

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('GUI client connected');
    
    // Send initial server status
    updateServerStatus();
    
    // Send logs for all servers
    for (const [serverId, server] of Object.entries(serverConfigs)) {
        socket.emit('serverLogs', { serverId, logs: server.logs });
    }
    
    // Request player lists if connected
    for (const [serverId, server] of Object.entries(serverConfigs)) {
        if (server.ipcClient) {
            sendToGameServer(serverId, { command: 'getPlayers' });
        }
    }
    
    socket.on('disconnect', () => {
        console.log('GUI client disconnected');
    });
});

// Start checking server status periodically
setInterval(() => {
    for (const [serverId, server] of Object.entries(serverConfigs)) {
        if (server.ipcClient) {
            sendToGameServer(serverId, { command: 'getPlayers' });
        }
        
        // Try to reconnect if server is running but IPC is disconnected
        if (server.process && !server.ipcClient) {
            connectToGameServer(serverId);
        }
    }
}, 5000);

const PORT = process.env.GUI_PORT || 3005;
server.listen(PORT, () => {
    console.log(`Multi-Server GUI running on http://localhost:${PORT}`);
    addServerLog('pvp', 'info', 'Multi-Server GUI started');
    addServerLog('pve', 'info', 'Multi-Server GUI started');
});