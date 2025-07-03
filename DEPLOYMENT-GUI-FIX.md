# GUI Access Fix - Quick Steps

## 1. Check if GUI is running on the droplet
```bash
pm2 status
# Look for "castle-wars-gui" - should be "online"
```

## 2. Check if port 3005 is listening
```bash
sudo lsof -i :3005
# OR
sudo netstat -tlnp | grep 3005
```

## 3. Update Nginx configuration
```bash
# Copy the nginx config
sudo cp nginx-example.conf /etc/nginx/sites-available/castlewars

# Make sure it's linked
sudo ln -sf /etc/nginx/sites-available/castlewars /etc/nginx/sites-enabled/

# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## 4. Check firewall (if using ufw)
```bash
# GUI doesn't need external port access since nginx proxies it
# But make sure nginx ports are open
sudo ufw status
# Should show 80/tcp and 443/tcp ALLOW
```

## 5. Test locally on droplet
```bash
# Test if GUI responds locally
curl http://localhost:3005
```

## 6. Check DNS
```bash
# Make sure gui.koryenders.com points to your droplet
nslookup gui.koryenders.com
```

## 7. If GUI isn't running
```bash
# Start all services with PM2
npm run pm2:start

# Or just start the GUI
pm2 start castle-wars-gui
```

## 8. Check logs if there are issues
```bash
pm2 logs castle-wars-gui --lines 50
```

## Common Issues:
- **Port 3005 already in use**: Stop any old GUI processes
- **Nginx not configured**: The GUI subdomain won't work
- **PM2 not running the GUI**: Start it with PM2
- **Old server-gui-multi.js running**: Make sure PM2 uses server-gui-pm2.js

## Full restart if needed:
```bash
# Stop everything
pm2 stop all

# Pull latest changes
git pull origin main
npm install

# Start with PM2
npm run pm2:start

# Check status
pm2 status
```