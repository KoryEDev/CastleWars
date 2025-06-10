#!/bin/bash

# Castle Wars Update Script for DigitalOcean Droplet
# This script pulls the latest changes from GitHub and handles dependencies

echo "=================================="
echo "Castle Wars Update Script"
echo "=================================="

# Navigate to the game directory
# Update this path to match your droplet's installation directory
GAME_DIR="/root/CastleWars"

# Check if directory exists
if [ ! -d "$GAME_DIR" ]; then
    echo "Error: Game directory not found at $GAME_DIR"
    echo "Please update the GAME_DIR variable in this script"
    exit 1
fi

cd "$GAME_DIR"

echo "Current directory: $(pwd)"
echo ""

# Check git status
echo "Checking for local changes..."
git_status=$(git status --porcelain)

if [ ! -z "$git_status" ]; then
    echo "Warning: You have local changes:"
    echo "$git_status"
    echo ""
    read -p "Continue anyway? Local changes may be overwritten (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Update cancelled."
        exit 1
    fi
fi

# Stash any local changes (just in case)
echo "Stashing local changes..."
git stash

# Pull latest changes
echo ""
echo "Pulling latest updates from GitHub..."
git pull origin main

pull_status=$?

if [ $pull_status -ne 0 ]; then
    echo "Error: Git pull failed!"
    echo "Attempting to restore stashed changes..."
    git stash pop
    exit 1
fi

# Check if package.json was updated
if git diff HEAD@{1} HEAD --name-only | grep -E "package.*json" > /dev/null; then
    echo ""
    echo "Dependencies have been updated!"
    echo "Installing new dependencies..."
    npm install
    
    if [ $? -ne 0 ]; then
        echo "Error: npm install failed!"
        exit 1
    fi
fi

# Check if the server is running via pm2
if command -v pm2 &> /dev/null; then
    pm2_status=$(pm2 list | grep -E "server|castle-wars")
    
    if [ ! -z "$pm2_status" ]; then
        echo ""
        echo "PM2 detected. Restarting the server..."
        pm2 restart all
        echo "Server restarted!"
    fi
fi

# Check if the server is running via systemd
if systemctl is-active --quiet castlewars; then
    echo ""
    echo "Systemd service detected. Restarting the server..."
    sudo systemctl restart castlewars
    echo "Server restarted!"
fi

echo ""
echo "=================================="
echo "Update completed successfully!"
echo "=================================="
echo ""
echo "If your server didn't auto-restart, please restart it manually:"
echo "  - PM2: pm2 restart all"
echo "  - Systemd: sudo systemctl restart castlewars"
echo "  - Manual: npm start"

# Restore any stashed changes that weren't conflicting
git stash pop 2>/dev/null || true