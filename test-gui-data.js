#!/usr/bin/env node

// Test script to verify GUI data flow
const net = require('net');

console.log('Testing Castle Wars GUI data flow...\n');

// Test IPC connections to both servers
const servers = [
    { name: 'PvP', port: 3002 },
    { name: 'PvE', port: 3003 }
];

servers.forEach(server => {
    console.log(`Testing ${server.name} server on port ${server.port}...`);
    
    const client = net.createConnection(server.port, '127.0.0.1');
    
    client.on('connect', () => {
        console.log(`✅ Connected to ${server.name} IPC`);
        
        // Request player data
        const request = JSON.stringify({ type: 'getPlayers' }) + '\n';
        client.write(request);
        
        // For PvE, also request additional data
        if (server.name === 'PvE') {
            client.write(JSON.stringify({ type: 'getParties' }) + '\n');
            client.write(JSON.stringify({ type: 'getWaveInfo' }) + '\n');
            client.write(JSON.stringify({ type: 'getNpcs' }) + '\n');
        }
        
        // Give it a moment to respond
        setTimeout(() => {
            client.end();
        }, 1000);
    });
    
    let buffer = '';
    client.on('data', (data) => {
        buffer += data.toString();
        
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const message = buffer.substring(0, newlineIndex);
            buffer = buffer.substring(newlineIndex + 1);
            
            if (message.trim()) {
                try {
                    const response = JSON.parse(message);
                    console.log(`📥 ${server.name} response:`, response.type);
                    
                    if (response.type === 'players' && response.players) {
                        console.log(`   Players: ${response.players.length}`);
                        response.players.forEach(p => {
                            console.log(`   - ${p.username} (${p.role || 'player'})`);
                        });
                    }
                    
                    if (response.type === 'parties' && response.parties) {
                        console.log(`   Parties: ${response.parties.length}`);
                    }
                    
                    if (response.type === 'waveInfo' && response.data) {
                        console.log(`   Wave: ${response.data.currentWave || 'N/A'}`);
                    }
                } catch (err) {
                    console.error(`❌ Error parsing response:`, err.message);
                }
            }
        }
    });
    
    client.on('error', (err) => {
        if (err.code === 'ECONNREFUSED') {
            console.log(`❌ ${server.name} server is not running or IPC is not available`);
        } else {
            console.error(`❌ ${server.name} IPC error:`, err.message);
        }
    });
    
    console.log('');
});

// Test GUI HTTP endpoint
setTimeout(() => {
    console.log('\nTesting GUI HTTP endpoint...');
    const http = require('http');
    
    http.get('http://localhost:3005/auth-status', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const status = JSON.parse(data);
                console.log('✅ GUI HTTP server is responding');
                console.log(`   Auth status: ${status.authenticated ? 'Authenticated' : 'Not authenticated'}`);
            } catch (err) {
                console.log('❌ Failed to parse GUI response');
            }
        });
    }).on('error', (err) => {
        console.log('❌ GUI server is not responding on port 3005');
        console.log('   Run: npm run gui-multi');
    });
}, 2000);