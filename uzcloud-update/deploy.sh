#!/bin/bash
# Yukbozor VPS Deployment Script
# Usage: ./deploy.sh

set -e
cd /home/uz-user/yukbozor

echo "=== Yukbozor Deployment ==="

# Check .env exists
if [ ! -f ".env" ]; then
    echo "ERROR: .env file not found! Create it first."
    exit 1
fi

# Check archive exists
if [ ! -f "release.zip" ]; then
    echo "ERROR: release.zip not found! Upload it first."
    exit 1
fi

# Stop app
echo "Stopping application..."
pm2 delete yukbozor 2>/dev/null || true

# Backup current version
echo "Creating backup..."
rm -rf backup_prev
[ -d server ] && mv server backup_prev_server 2>/dev/null || true

# Extract new version
echo "Extracting release..."
rm -rf staging
mkdir -p staging
unzip -o release.zip -d staging

# Deploy files
echo "Deploying files..."
cp -r staging/server .
cp -r staging/shared .
cp staging/tsconfig.json . 2>/dev/null || true

# Copy built client to server/public
echo "Setting up client files..."
rm -rf server/public
cp -r staging/dist/public server/public

# Cleanup staging
rm -rf staging
rm -rf backup_prev_server

# Install dependencies if needed
if [ -f "staging/package.json" ]; then
    cp staging/package.json .
    npm install --production 2>/dev/null || true
fi

# Start application
echo "Starting application..."
pm2 start ecosystem.config.cjs
pm2 save

echo "=== Deployment Complete ==="
echo "Checking logs..."
sleep 3
pm2 logs yukbozor --lines 15 --nostream
