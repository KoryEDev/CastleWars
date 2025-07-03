const express = require('express');
const pm2 = require('pm2');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const net = require('net');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// PM2 process names from ecosystem.config.js
const PM2_APPS = {
    pvp: 'castle-wars-pvp',
    pve: 'castle-wars-pve'
};

// Server configurations with IPC ports
const serverConfigs = {
    pvp: {
        name: 'PvP Server',
        pm2Name: PM2_APPS.pvp,
        port: 3000,
        ipcPort: 3002,
        ipcClient: null,
        status: 'unknown',
        players: [],
        logs: []
    },
    pve: {
        name: 'PvE Server',
        pm2Name: PM2_APPS.pve,
        port: 3001,
        ipcPort: 3003,
        ipcClient: null,
        status: 'unknown',
        players: [],
        logs: [],
        parties: [],
        waveData: {},
        npcs: []
    }
};

// Connect to PM2
pm2.connect((err) => {
    if (err) {
        console.error('Failed to connect to PM2:', err);
        process.exit(2);
    }
    console.log('Connected to PM2');
    
    // Start monitoring PM2 processes
    startPM2Monitoring();
});

// Monitor PM2 processes
function startPM2Monitoring() {
    // Initial status check
    updateAllServerStatus();
    
    // Check status every 2 seconds
    setInterval(() => {
        updateAllServerStatus();
    }, 2000);
}

// Update status of all servers from PM2
function updateAllServerStatus() {
    pm2.list((err, list) => {
        if (err) {
            console.error('Error getting PM2 list:', err);
            return;
        }
        
        // Update status for each server
        for (const [serverId, config] of Object.entries(serverConfigs)) {
            const pm2Process = list.find(p => p.name === config.pm2Name);
            
            if (pm2Process) {
                config.status = pm2Process.pm2_env.status;
                config.cpu = pm2Process.monit ? pm2Process.monit.cpu : 0;
                config.memory = pm2Process.monit ? Math.round(pm2Process.monit.memory / 1024 / 1024) : 0;
                config.uptime = pm2Process.pm2_env.pm_uptime;
                config.restarts = pm2Process.pm2_env.restart_time;
                config.pm_id = pm2Process.pm_id;
                
                // Try to connect IPC if server is online
                if (config.status === 'online' && !config.ipcClient) {
                    connectToServerIPC(serverId);
                }
            } else {
                config.status = 'stopped';
                config.cpu = 0;
                config.memory = 0;
                config.uptime = null;
                config.restarts = 0;
                
                // Disconnect IPC if server is offline
                if (config.ipcClient) {
                    config.ipcClient.destroy();
                    config.ipcClient = null;
                }
            }
        }
        
        // Send update to all connected clients
        updateServerStatus();
    });
}

// Connect to server via IPC
function connectToServerIPC(serverId) {
    const server = serverConfigs[serverId];
    if (!server || server.ipcClient) return;
    
    console.log(`Attempting to connect to ${serverId} IPC on port ${server.ipcPort}...`);
    
    server.ipcClient = net.createConnection(server.ipcPort, '127.0.0.1');
    
    server.ipcClient.on('connect', () => {
        console.log(`Connected to ${serverId} IPC`);
        
        // Request initial data
        sendToServer(serverId, { type: 'getPlayers' });
        
        if (serverId === 'pve') {
            sendToServer(serverId, { type: 'getParties' });
            sendToServer(serverId, { type: 'getWaveInfo' });
            sendToServer(serverId, { type: 'getNpcs' });
        }
    });
    
    let buffer = '';
    server.ipcClient.on('data', (data) => {
        buffer += data.toString();
        
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const message = buffer.substring(0, newlineIndex);
            buffer = buffer.substring(newlineIndex + 1);
            
            if (message.trim()) {
                try {
                    const response = JSON.parse(message);
                    handleServerResponse(serverId, response);
                } catch (err) {
                    console.error(`Error parsing IPC response from ${serverId}:`, err);
                }
            }
        }
    });
    
    server.ipcClient.on('error', (err) => {
        if (err.code !== 'ECONNREFUSED') {
            console.error(`IPC connection error for ${serverId}:`, err);
        }
    });
    
    server.ipcClient.on('close', () => {
        console.log(`IPC connection closed for ${serverId}`);
        server.ipcClient = null;
    });
}

// Handle responses from game servers
function handleServerResponse(serverId, response) {
    const server = serverConfigs[serverId];
    
    switch (response.type) {
        case 'players':
            server.players = response.players || [];
            io.emit('playerList', { serverId, players: server.players });
            break;
            
        case 'parties':
            if (serverId === 'pve') {
                server.parties = response.parties || [];
                io.emit('partyList', { parties: server.parties });
            }
            break;
            
        case 'waveInfo':
            if (serverId === 'pve') {
                server.waveData = response.data || {};
                io.emit('waveInfo', server.waveData);
            }
            break;
            
        case 'npcs':
            if (serverId === 'pve') {
                server.npcs = response.npcs || [];
                io.emit('npcList', { npcs: server.npcs });
            }
            break;
            
        case 'log':
            // Add log entry
            server.logs.push({
                type: response.level || 'info',
                message: response.message,
                timestamp: response.timestamp || new Date().toISOString()
            });
            
            // Keep only last 500 logs
            if (server.logs.length > 500) {
                server.logs.shift();
            }
            
            io.emit('serverLog', {
                serverId,
                log: {
                    type: response.level || 'info',
                    message: response.message,
                    timestamp: response.timestamp || new Date().toISOString()
                }
            });
            break;
    }
}

// Send command to server via IPC
function sendToServer(serverId, command) {
    const server = serverConfigs[serverId];
    if (!server || !server.ipcClient || !server.ipcClient.writable) {
        console.log(`Cannot send to ${serverId}: no IPC connection`);
        return false;
    }
    
    try {
        const message = JSON.stringify(command) + '\n';
        server.ipcClient.write(message);
        return true;
    } catch (err) {
        console.error(`Error sending to ${serverId}:`, err);
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
            uptime: server.uptime,
            cpu: server.cpu,
            memory: server.memory,
            restarts: server.restarts,
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

// Admin password
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || 
    bcrypt.hashSync('admin', 10);

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

// Logout endpoint
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Check auth status
app.get('/auth-status', (req, res) => {
    res.json({ authenticated: !!req.session.authenticated });
});

// PM2 Control Endpoints
app.post('/server/:id/start', requireAuth, (req, res) => {
    const serverId = req.params.id;
    const server = serverConfigs[serverId];
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    pm2.start(server.pm2Name, (err) => {
        if (err && err.message !== 'process or namespace already started') {
            console.error(`Failed to start ${serverId}:`, err);
            return res.status(500).json({ error: err.message });
        }
        
        res.json({ success: true, message: `${server.name} started` });
        
        // Update status after a short delay
        setTimeout(updateAllServerStatus, 1000);
    });
});

app.post('/server/:id/stop', requireAuth, (req, res) => {
    const serverId = req.params.id;
    const server = serverConfigs[serverId];
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    pm2.stop(server.pm2Name, (err) => {
        if (err) {
            console.error(`Failed to stop ${serverId}:`, err);
            return res.status(500).json({ error: err.message });
        }
        
        res.json({ success: true, message: `${server.name} stopped` });
        updateAllServerStatus();
    });
});

app.post('/server/:id/restart', requireAuth, (req, res) => {
    const serverId = req.params.id;
    const server = serverConfigs[serverId];
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    pm2.restart(server.pm2Name, (err) => {
        if (err) {
            console.error(`Failed to restart ${serverId}:`, err);
            return res.status(500).json({ error: err.message });
        }
        
        res.json({ success: true, message: `${server.name} restarted` });
        
        // Reconnect IPC after restart
        setTimeout(() => {
            updateAllServerStatus();
        }, 2000);
    });
});

// Get PM2 logs
app.get('/server/:id/logs', requireAuth, (req, res) => {
    const serverId = req.params.id;
    const server = serverConfigs[serverId];
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    pm2.describe(server.pm2Name, (err, processDescription) => {
        if (err || !processDescription || !processDescription[0]) {
            return res.status(500).json({ error: 'Could not get process info' });
        }
        
        const proc = processDescription[0];
        const logFile = proc.pm2_env.pm_out_log_path;
        const errorFile = proc.pm2_env.pm_err_log_path;
        
        // Read last 100 lines of logs
        exec(`tail -n 100 "${logFile}" 2>/dev/null || echo ""`, (err, stdout) => {
            const logs = stdout.split('\n').filter(line => line.trim());
            
            exec(`tail -n 100 "${errorFile}" 2>/dev/null || echo ""`, (err2, stderr) => {
                const errors = stderr.split('\n').filter(line => line.trim());
                
                res.json({
                    logs: logs.map(line => ({ type: 'info', message: line })),
                    errors: errors.map(line => ({ type: 'error', message: line }))
                });
            });
        });
    });
});

// Server commands via IPC
app.post('/server/:id/command', requireAuth, (req, res) => {
    const serverId = req.params.id;
    const command = req.body;
    
    if (sendToServer(serverId, command)) {
        res.json({ success: true });
    } else {
        res.status(500).json({ error: 'Failed to send command' });
    }
});

// Git operations
app.post('/git/pull', requireAuth, async (req, res) => {
    try {
        const { stdout, stderr } = await execPromise('git pull origin main');
        const output = stdout + (stderr ? '\nErrors:\n' + stderr : '');
        
        res.json({ success: true, output });
        
        // Check if files were updated
        if (output.includes('Updating') || output.includes('Fast-forward')) {
            io.emit('updateAvailable', { message: 'Updates pulled successfully. Restart servers to apply.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'gui-assets')));

// Serve the control panel
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'control-panel-pm2-v2.html'));
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('GUI client connected');
    
    // Send initial status
    updateServerStatus();
    
    // Send initial player lists
    for (const [serverId, server] of Object.entries(serverConfigs)) {
        if (server.players.length > 0) {
            socket.emit('playerList', { serverId, players: server.players });
        }
    }
    
    // Send PvE data if available
    if (serverConfigs.pve.parties.length > 0) {
        socket.emit('partyList', { parties: serverConfigs.pve.parties });
    }
    if (serverConfigs.pve.waveData) {
        socket.emit('waveInfo', serverConfigs.pve.waveData);
    }
    if (serverConfigs.pve.npcs.length > 0) {
        socket.emit('npcList', { npcs: serverConfigs.pve.npcs });
    }
    
    // Send existing logs
    for (const [serverId, server] of Object.entries(serverConfigs)) {
        server.logs.forEach(log => {
            socket.emit('serverLog', { serverId, log });
        });
    }
    
    socket.on('requestLogs', (data) => {
        const serverId = data.serverId;
        if (serverConfigs[serverId]) {
            serverConfigs[serverId].logs.forEach(log => {
                socket.emit('serverLog', { serverId, log });
            });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('GUI client disconnected');
    });
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down GUI server...');
    
    // Disconnect from PM2
    pm2.disconnect();
    
    // Close IPC connections
    for (const server of Object.values(serverConfigs)) {
        if (server.ipcClient) {
            server.ipcClient.destroy();
        }
    }
    
    server.close(() => {
        console.log('GUI server shut down');
        process.exit(0);
    });
});

// Start the server
const PORT = process.env.GUI_PORT || 3005;
server.listen(PORT, () => {
    console.log(`Castle Wars PM2 Control Panel running on port ${PORT}`);
    console.log(`Access the control panel at http://localhost:${PORT}`);
});