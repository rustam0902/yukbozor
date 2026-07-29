#!/bin/bash
# E-IMZO Server Installation Script for Ubuntu 22.04

set -e

echo "=== E-IMZO Server Installation ==="

# Update system
echo "[1/6] Updating system..."
apt update && apt upgrade -y

# Install Java
echo "[2/6] Installing Java 8..."
apt install -y openjdk-8-jre-headless unzip

# Create directory
echo "[3/6] Creating directories..."
mkdir -p /opt/e-imzo-server/keys
cd /opt/e-imzo-server

# Check if files exist
echo "[4/6] Checking files..."
if [ ! -f "e-imzo-server.jar" ]; then
    echo "ERROR: e-imzo-server.jar not found!"
    echo "Please upload the following files to /opt/e-imzo-server/:"
    echo "  - e-imzo-server.jar"
    echo "  - config.properties"
    echo "  - keys/yukbozor.uz-2026-12-09.key"
    echo "  - keys/vpn.jks"
    echo "  - keys/truststore.jks"
    exit 1
fi

# Configure firewall
echo "[5/6] Configuring firewall..."
ufw allow 22/tcp
ufw allow 8080/tcp
ufw --force enable

# Create systemd service
echo "[6/6] Creating systemd service..."
cat > /etc/systemd/system/e-imzo.service << 'EOF'
[Unit]
Description=E-IMZO Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/e-imzo-server
ExecStart=/usr/bin/java -Dfile.encoding=UTF-8 -jar e-imzo-server.jar config.properties
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Start service
systemctl daemon-reload
systemctl enable e-imzo
systemctl start e-imzo

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Check status: systemctl status e-imzo"
echo "View logs:    journalctl -u e-imzo -f"
echo "Test ping:    curl http://127.0.0.1:8080/ping"
