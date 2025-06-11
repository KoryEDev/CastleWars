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
app.use(express.static(path.join(__dirname, 'public')));

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

// Logout endpoint
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Check auth status
app.get('/auth-status', (req, res) => {
    res.json({ authenticated: !!req.session.authenticated });
});

// Server management endpoints
app.post('/server/:serverId/start', requireAuth, (req, res) => {
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
        
        res.json({ success: true });
    } catch (err) {
        console.error(`Error starting ${server.name}:`, err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/server/:serverId/stop', requireAuth, (req, res) => {
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
    
    res.json({ success: true });
});

app.post('/server/:serverId/restart', requireAuth, async (req, res) => {
    const { serverId } = req.params;
    const { countdown = 30 } = req.body;
    const server = serverConfigs[serverId];
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    if (server.ipcClient) {
        sendToGameServer(serverId, { command: 'restartCountdown', countdown });
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'No connection to server' });
    }
});

// Player management endpoints
app.get('/server/:serverId/players', requireAuth, (req, res) => {
    const { serverId } = req.params;
    const server = serverConfigs[serverId];
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    if (server.ipcClient) {
        sendToGameServer(serverId, { command: 'getPlayers' });
        res.json({ message: 'Request sent', players: server.players });
    } else {
        res.json({ players: [], message: 'Server offline' });
    }
});

app.post('/server/:serverId/player/:username/kick', requireAuth, (req, res) => {
    const { serverId, username } = req.params;
    
    if (sendToGameServer(serverId, { command: 'kick', username })) {
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'No connection to server' });
    }
});

app.post('/server/:serverId/player/:username/ban', requireAuth, (req, res) => {
    const { serverId, username } = req.params;
    
    if (sendToGameServer(serverId, { command: 'ban', username })) {
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'No connection to server' });
    }
});

app.post('/server/:serverId/player/:username/promote', requireAuth, (req, res) => {
    const { serverId, username } = req.params;
    const { role } = req.body;
    
    if (sendToGameServer(serverId, { command: 'promote', username, role })) {
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'No connection to server' });
    }
});

app.post('/server/:serverId/announce', requireAuth, (req, res) => {
    const { serverId } = req.params;
    const { message } = req.body;
    
    if (sendToGameServer(serverId, { command: 'announce', message })) {
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'No connection to server' });
    }
});

// Server logs endpoint
app.get('/server/:serverId/logs', requireAuth, (req, res) => {
    const { serverId } = req.params;
    const server = serverConfigs[serverId];
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    res.json({ logs: server.logs });
});

// Serve the multi-server GUI HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'control-panel-v2.html'));
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