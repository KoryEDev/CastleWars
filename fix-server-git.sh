#!/bin/bash

echo "This script will help fix git pull issues on the server"
echo "Run these commands on your server:"
echo ""
echo "cd /root/castle-wars"
echo "git config pull.rebase false"
echo "git pull origin main"
echo ""
echo "Or if you want to discard local changes and force update:"
echo ""
echo "cd /root/castle-wars"
echo "git fetch origin"
echo "git reset --hard origin/main"
echo ""
echo "The first option will merge changes, the second will overwrite local changes."