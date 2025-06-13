// Complete restart function to replace the broken one

// Restart server - simple direct restart that works like stop/start
app.post('/api/server/:serverId/restart', requireAuth, async (req, res) => {
    const { serverId } = req.params;
    const { countdown = 0, message } = req.body;
    const server = serverConfigs[serverId];
    
    console.log(`[RESTART] Restart request for ${serverId}`);
    addServerLog(serverId, 'info', `Restart requested`);
    
    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }
    
    // If not running, just start it
    if (!server.process) {
        addServerLog(serverId, 'info', 'Server not running, starting instead');
        return res.redirect(307, `/api/server/${serverId}/start`);
    }
    
    // Send success response immediately
    res.json({ success: true, message: 'Server restarting...' });
    
    // Store the PID to kill
    const pidToKill = server.process.pid;
    const processToKill = server.process;
    
    console.log(`[RESTART] Stopping PID ${pidToKill}`);
    addServerLog(serverId, 'info', `Stopping process ${pidToKill}`);
    
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
    
    // Kill and restart
    try {
        processToKill.kill();
        console.log(`[RESTART] Sent kill signal to ${pidToKill}`);
        
        // Wait a bit then start new server
        setTimeout(() => {
            console.log(`[RESTART] Starting new server for ${serverId}`);
            startServerProcess(serverId);
        }, 3000);
        
    } catch (err) {
        console.error(`[RESTART] Error:`, err);
        addServerLog(serverId, 'error', `Error: ${err.message}`);
        // Try to start anyway
        setTimeout(() => startServerProcess(serverId), 1000);
    }
});