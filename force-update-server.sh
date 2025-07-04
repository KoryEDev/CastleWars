#!/bin/bash

# Force update server to match the current main branch
echo "Force updating server to match current main branch..."

# Fetch all changes from origin
git fetch origin

# Force reset to origin/main, discarding any local changes
git reset --hard origin/main

# Clean any untracked files
git clean -fd

# Install dependencies in case they changed
npm install

# Show current commit
echo "Server is now at commit:"
git log --oneline -1

echo "Update complete! Please restart servers with PM2."