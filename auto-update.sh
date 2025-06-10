#!/bin/bash

# Castle Wars Auto-Update Script
# This script handles the complete update process automatically

echo "=================================="
echo "Castle Wars Auto-Update Script"
echo "=================================="

# Configuration
GAME_DIR="/var/www/CastleWars"
GUI_PM2_NAME="castle-wars-gui"
GAME_PM2_NAME="castle-wars-game"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Navigate to game directory
cd "$GAME_DIR" || {
    print_error "Failed to navigate to $GAME_DIR"
    exit 1
}

print_status "Current directory: $(pwd)"

# Step 1: Stop all servers
echo ""
echo "Step 1: Stopping all servers..."
pm2 stop all
print_status "All PM2 processes stopped"

# Kill any remaining node processes
pkill -f "server.js" 2>/dev/null
pkill -f "server-gui.js" 2>/dev/null
sleep 2

# Step 2: Stash any local changes
echo ""
echo "Step 2: Checking for local changes..."
if [[ -n $(git status --porcelain) ]]; then
    print_warning "Local changes detected, stashing them..."
    git stash
    print_status "Local changes stashed"
fi

# Step 3: Pull latest changes from GitHub
echo ""
echo "Step 3: Pulling latest updates from GitHub..."
git pull origin main
PULL_EXIT_CODE=$?

if [ $PULL_EXIT_CODE -ne 0 ]; then
    print_error "Git pull failed!"
    print_warning "Attempting to restore servers..."
    pm2 restart all
    exit 1
fi
print_status "Updates pulled successfully"

# Step 4: Check if dependencies need updating
echo ""
echo "Step 4: Checking dependencies..."
PACKAGE_CHANGED=$(git diff HEAD@{1} HEAD --name-only | grep -E "package.*json" || true)

if [ ! -z "$PACKAGE_CHANGED" ]; then
    print_warning "Package files changed, installing dependencies..."
    npm install
    if [ $? -eq 0 ]; then
        print_status "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
else
    print_status "No dependency changes detected"
fi

# Step 5: Check if mongoose strictQuery fix is needed
echo ""
echo "Step 5: Checking mongoose configuration..."
if ! grep -q "strictQuery" server.js; then
    print_warning "Adding mongoose strictQuery setting..."
    # Add before mongoose.connect line
    sed -i '/mongoose.connect/i \
// Set mongoose options\
mongoose.set('"'"'strictQuery'"'"', true);\
' server.js
    print_status "Updated server.js with strictQuery"
fi

if ! grep -q "strictQuery" server-gui.js; then
    # Add before mongoose.connect line in server-gui.js
    sed -i '/mongoose.connect/i \
// Set mongoose options\
mongoose.set('"'"'strictQuery'"'"', true);\
' server-gui.js
    print_status "Updated server-gui.js with strictQuery"
fi

# Step 6: Start the GUI server
echo ""
echo "Step 6: Starting GUI server..."
pm2 delete "$GUI_PM2_NAME" 2>/dev/null || true
pm2 start server-gui.js --name "$GUI_PM2_NAME"
sleep 3

# Check if GUI started successfully
pm2 list | grep -q "$GUI_PM2_NAME.*online"
if [ $? -eq 0 ]; then
    print_status "GUI server started successfully"
else
    print_error "GUI server failed to start"
    echo "Checking logs..."
    pm2 logs "$GUI_PM2_NAME" --lines 20 --nostream
    exit 1
fi

# Step 7: Show final status
echo ""
echo "=================================="
echo "Update Complete!"
echo "=================================="
echo ""
pm2 list
echo ""
print_status "GUI server is running at http://$(hostname -I | awk '{print $1}'):3001"
print_status "You can now log in and start the game server from the GUI"

# Optional: Show recent logs
echo ""
echo "Recent GUI logs:"
pm2 logs "$GUI_PM2_NAME" --lines 10 --nostream

# Save PM2 configuration
pm2 save
print_status "PM2 configuration saved"