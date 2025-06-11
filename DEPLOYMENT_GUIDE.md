# Castle Wars Deployment Guide

## Overview

Castle Wars now supports multiple game modes with separate servers:
- **PvP Server** (Port 3000): Classic player vs player combat
- **PvE Server** (Port 3001): Cooperative survival mode
- **Multi-Server GUI** (Port 3005): Admin control panel for all servers

## Quick Start

### 1. Environment Setup

Copy the example environment file and configure it:
```bash
cp .env.example .env
# Edit .env with your settings
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start All Servers

#### Development Mode (with auto-reload):
```bash
npm run dev:all
```

#### Production Mode:
```bash
npm run start:all
```

### 4. Access Points

- **Server Selection**: `http://localhost:3000/server-select.html`
- **PvP Game**: `http://localhost:3000`
- **PvE Game**: `http://localhost:3001`
- **Admin Panel**: `http://localhost:3005` (default password: "admin")

## Server Management

### Using the Multi-Server GUI

1. Access the GUI at `http://localhost:3005`
2. Login with admin password
3. Control both servers from one interface:
   - Start/Stop/Restart servers
   - View real-time logs
   - Manage players (kick, ban, promote)
   - Send announcements
   - Monitor server status

### Individual Server Commands

```bash
# PvP Server only
npm run start      # Production
npm run dev        # Development

# PvE Server only
npm run pve        # Production
npm run dev:pve    # Development

# GUI Control Panel
npm run gui-multi  # Multi-server GUI
npm run dev:gui-multi  # Development mode
```

## Configuration

### Environment Variables

Key configuration options in `.env`:

```env
# Server Ports
PVP_PORT=3000
PVE_PORT=3001
GUI_PORT=3005

# Database (use different DBs for different environments)
MONGODB_URI=mongodb://localhost:27017/castlewars-prod

# Security (MUST change in production!)
SESSION_SECRET=your-unique-secret-here
ADMIN_PASSWORD_HASH=your-bcrypt-hash-here

# Features
ENABLE_PVE_MODE=true
ENABLE_ADMIN_COMMANDS=true
```

### Generate Admin Password Hash

```bash
node -e "console.log(require('bcrypt').hashSync('your-password', 10))"
```

## Production Deployment

### 1. Security Checklist

- [ ] Change all default secrets in `.env`
- [ ] Set `NODE_ENV=production`
- [ ] Configure firewall rules for ports 3000, 3001, 3005
- [ ] Use HTTPS with proper SSL certificates
- [ ] Set up MongoDB authentication
- [ ] Configure CORS origins properly

### 2. Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start all servers
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

Example `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'castlewars-pvp',
      script: './server.js',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'castlewars-pve',
      script: './server-pve.js',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'castlewars-gui',
      script: './server-gui-multi.js',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

### 3. Nginx Configuration

For HTTPS and better performance:

```nginx
# PvP Server
server {
    listen 443 ssl http2;
    server_name play.yourserver.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# PvE Server
server {
    listen 443 ssl http2;
    server_name pve.yourserver.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Admin Panel (restrict access!)
server {
    listen 443 ssl http2;
    server_name admin.yourserver.com;
    
    # IP whitelist
    allow 1.2.3.4;  # Your IP
    deny all;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Monitoring

### Server Logs

All servers maintain logs that can be viewed through:
1. The multi-server GUI (real-time)
2. PM2: `pm2 logs castlewars-pvp`
3. Direct output when running in development

### Health Checks

The server selection page (`server-select.html`) automatically checks server status every 5 seconds.

## Troubleshooting

### Servers Won't Start
- Check if ports are already in use: `lsof -i :3000`
- Verify MongoDB is running: `systemctl status mongod`
- Check logs for errors

### Can't Connect to Game
- Ensure firewall allows connections on game ports
- Check if server is actually running
- Verify client is connecting to correct port

### MongoDB Issues
- Ensure MongoDB is installed and running
- Check connection string in `.env`
- Verify database permissions

## Backup and Recovery

### Database Backup

```bash
# Backup
mongodump --db castlewars --out ./backup/$(date +%Y%m%d)

# Restore
mongorestore --db castlewars ./backup/20240611/castlewars
```

### Game Data Backup

The GUI includes a backup feature that exports:
- Player data
- Building data
- Server configuration

Access through the admin panel or use the API endpoint.

## Updates

### Safe Update Process

1. Backup database and configuration
2. Test updates in staging environment
3. During low-traffic period:
   ```bash
   git pull
   npm install
   pm2 restart all
   ```

### Rolling Updates

For zero downtime:
1. Start new version on different ports
2. Update load balancer/proxy
3. Gracefully shutdown old version

## Performance Tuning

### Node.js Optimization

In production, use the optimized start script:
```bash
npm run start:optimized
```

This sets:
- 8GB memory limit
- Optimized garbage collection
- Production Node.js flags

### MongoDB Optimization

Create indexes for better performance:
```javascript
// In MongoDB shell
db.players.createIndex({ username: 1 })
db.players.createIndex({ lastLogin: -1 })
db.buildings.createIndex({ x: 1, y: 1 })
```

## Security Best Practices

1. **Authentication**
   - Use strong admin passwords
   - Rotate secrets regularly
   - Enable MongoDB authentication

2. **Network Security**
   - Use firewall rules
   - Implement rate limiting
   - Use HTTPS for all connections

3. **Access Control**
   - Restrict admin panel access by IP
   - Use VPN for admin access
   - Log all admin actions

4. **Updates**
   - Keep dependencies updated
   - Monitor security advisories
   - Regular security audits