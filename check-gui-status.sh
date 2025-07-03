#!/bin/bash

echo "Castle Wars GUI Status Check"
echo "============================"
echo ""

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed globally"
    echo "   Run: npm install -g pm2"
else
    echo "✅ PM2 is installed"
fi

echo ""

# Check PM2 processes
echo "PM2 Process Status:"
pm2 list | grep -E "castle-wars|Name" || echo "No PM2 processes found"

echo ""
echo "Port Status:"

# Check if port 3005 is in use
if lsof -i :3005 > /dev/null 2>&1; then
    echo "✅ Port 3005 is in use by:"
    lsof -i :3005 | grep LISTEN
else
    echo "❌ Port 3005 is not in use - GUI may not be running"
fi

echo ""
echo "Nginx Status:"

# Check if nginx is running
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx is running"
    
    # Check if our config exists
    if [ -f /etc/nginx/sites-enabled/castlewars ]; then
        echo "✅ Castle Wars nginx config is enabled"
        
        # Check if gui subdomain is configured
        if grep -q "gui.koryenders.com" /etc/nginx/sites-enabled/castlewars 2>/dev/null; then
            echo "✅ gui.koryenders.com is configured in nginx"
        else
            echo "❌ gui.koryenders.com is NOT configured in nginx"
        fi
    else
        echo "❌ Castle Wars nginx config is NOT enabled"
        echo "   Run: sudo ln -s /etc/nginx/sites-available/castlewars /etc/nginx/sites-enabled/"
    fi
else
    echo "❌ Nginx is not running"
    echo "   Run: sudo systemctl start nginx"
fi

echo ""
echo "Local GUI Test:"

# Test if GUI responds
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3005 | grep -q "200\|302"; then
    echo "✅ GUI is responding on localhost:3005"
else
    echo "❌ GUI is NOT responding on localhost:3005"
    echo "   Check logs: pm2 logs castle-wars-gui"
fi

echo ""
echo "Recent GUI Logs:"
pm2 logs castle-wars-gui --lines 10 --nostream 2>/dev/null || echo "Could not fetch PM2 logs"

echo ""
echo "Quick Fix Commands:"
echo "==================="
echo "1. Restart GUI only:     pm2 restart castle-wars-gui"
echo "2. Start all servers:    npm run pm2:start"
echo "3. View GUI logs:        pm2 logs castle-wars-gui"
echo "4. Reload nginx:         sudo systemctl reload nginx"