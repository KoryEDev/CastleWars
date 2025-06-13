// Restart server endpoint - complete replacement
app.post('/api/server/:serverId/restart', requireAuth, async (req, res) => {
    const { serverId } = req.params;
    const { countdown = 30, message } = req.body;
    const server = serverConfigs[serverId];
    
    console.log(`[RESTART] Restart request received for ${serverId} with countdown: ${countdown}`);
    addServerLog(serverId, 'info', `Restart request received with ${countdown} second countdown`);
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    // If server isn't running, just start it
    if (!server.process) {
        addServerLog(serverId, 'info', 'Server not running, starting instead of restarting');
        
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
                
                if (message.includes('Server running on port')) {
                    setTimeout(() => connectToGameServer(serverId), 1000);
                }
            });
            
            server.process.stderr.on('data', (data) => {
                const message = data.toString().trim();
                console.error(`[${serverId} ERROR] ${message}`);
                addServerLog(serverId, 'error', message);
            });
            
            const closeHandler = createCloseHandler(serverId);
            server.process.on('close', closeHandler);
            
            return res.json({ success: true, message: `${server.name} starting...` });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
    
    // For instant restart or if IPC is not available, use direct method
    if (countdown === 0 || !server.ipcClient || !server.ipcClient.writable) {
        console.log(`[RESTART] Using direct restart method for ${serverId}`);
        addServerLog(serverId, 'warning', 'Using direct restart method (stop/start)');
        
        // Send response immediately
        res.json({ success: true, message: `${server.name} restarting...` });
        
        // Perform the restart
        performDirectRestart(serverId);
        
    } else {
        // Try graceful restart with countdown via IPC
        const command = { 
            type: 'restartCountdown', 
            data: { 
                seconds: countdown,
                message: message || `Server restart in ${countdown} seconds`
            } 
        };
        
        console.log(`[RESTART] Sending restart command to ${serverId}:`, JSON.stringify(command));
        const sent = sendToGameServer(serverId, command);
        
        if (sent) {
            res.json({ success: true, message: `Restart countdown initiated: ${countdown} seconds` });
            addServerLog(serverId, 'success', `Restart countdown initiated: ${countdown} seconds`);
        } else {
            // Fallback to direct restart if IPC fails
            console.log(`[RESTART] IPC failed, using direct restart for ${serverId}`);
            addServerLog(serverId, 'warning', 'IPC failed, using direct restart method');
            res.json({ success: true, message: `${server.name} restarting...` });
            performDirectRestart(serverId);
        }
    }
});

// Helper function to perform direct restart
async function performDirectRestart(serverId) {
    const server = serverConfigs[serverId];
    if (!server || !server.process) return;
    
    const processToKill = server.process;
    const pidToKill = processToKill.pid;
    
    console.log(`[RESTART] Performing direct restart for ${serverId}, PID: ${pidToKill}`);
    addServerLog(serverId, 'info', `Stopping server process (PID: ${pidToKill})`);
    
    // Announce to players if possible
    if (server.ipcClient && server.ipcClient.writable) {
        sendToGameServer(serverId, { 
            type: 'announce', 
            data: { 
                message: '⚠️ Server restarting NOW! ⚠️', 
                type: 'error' 
            } 
        });
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Disconnect IPC
    if (server.ipcClient) {
        server.ipcClient.destroy();
        server.ipcClient = null;
    }
    
    // Clear server state
    server.process = null;
    server.startTime = null;
    server.status = 'offline';
    server.players = [];
    updateServerStatus();
    
    // Set up exit handler to start new server
    processToKill.once('exit', (code, signal) => {
        console.log(`[RESTART] Process ${pidToKill} exited with code ${code}, signal ${signal}`);
        addServerLog(serverId, 'info', 'Server process stopped');
        
        // Wait a moment then start new server
        setTimeout(() => {
            startServerProcess(serverId);
        }, 2000);
    });
    
    // Kill the process
    try {
        processToKill.kill('SIGTERM');
        console.log(`[RESTART] Sent SIGTERM to PID ${pidToKill}`);
        
        // Force kill after 5 seconds if still running
        setTimeout(() => {
            try {
                process.kill(pidToKill, 0); // Check if process still exists
                console.log(`[RESTART] Process ${pidToKill} still running, sending SIGKILL`);
                process.kill(pidToKill, 'SIGKILL');
                addServerLog(serverId, 'warning', 'Force killed process with SIGKILL');
            } catch (e) {
                // Process doesn't exist, that's good
                console.log(`[RESTART] Process ${pidToKill} no longer exists`);
            }
        }, 5000);
        
    } catch (err) {
        console.error(`[RESTART] Error killing process:`, err);
        addServerLog(serverId, 'error', `Error stopping process: ${err.message}`);
    }
}

// Helper function to start server process
function startServerProcess(serverId) {
    const server = serverConfigs[serverId];
    if (!server) return;
    
    console.log(`[RESTART] Starting ${serverId} server...`);
    addServerLog(serverId, 'info', 'Starting server...');
    
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
            
            if (message.includes('Server running on port')) {
                setTimeout(() => connectToGameServer(serverId), 1000);
            }
        });
        
        server.process.stderr.on('data', (data) => {
            const message = data.toString().trim();
            console.error(`[${serverId} ERROR] ${message}`);
            addServerLog(serverId, 'error', message);
        });
        
        const closeHandler = createCloseHandler(serverId);
        server.process.on('close', closeHandler);
        
        addServerLog(serverId, 'success', 'Server started successfully');
        
    } catch (err) {
        console.error(`[RESTART] Error starting ${serverId}:`, err);
        addServerLog(serverId, 'error', `Failed to start: ${err.message}`);
    }
}

// Helper function to create close handler
function createCloseHandler(serverId) {
    return (code) => {
        const server = serverConfigs[serverId];
        console.log(`${server.name} exited with code ${code}`);
        addServerLog(serverId, 'warning', `Server exited with code ${code}`);
        
        server.process = null;
        server.startTime = null;
        server.status = 'offline';
        server.players = [];
        updateServerStatus();
        
        // Auto-restart if it was a clean exit (code 0)
        if (code === 0) {
            addServerLog(serverId, 'info', 'Auto-restarting server...');
            setTimeout(() => {
                startServerProcess(serverId);
            }, 1000);
        }
    };
}