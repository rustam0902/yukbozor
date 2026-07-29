#!/bin/bash
# Prepare E-IMZO files for VPS upload

echo "=== Preparing E-IMZO files for VPS ==="

# Create upload directory
mkdir -p e-imzo-upload/keys

# Copy e-imzo-server files
cp attached_assets/e-imzo-server/e-imzo-server/e-imzo-server.jar e-imzo-upload/

# Copy certificate config (has VPN settings)
cp attached_assets/yukbozor-cert/config.properties e-imzo-upload/

# Copy key files
cp attached_assets/yukbozor-cert/keys/* e-imzo-upload/keys/

# Copy install script
cp e-imzo-vps/install.sh e-imzo-upload/

echo ""
echo "Files prepared in: e-imzo-upload/"
echo ""
echo "Upload to VPS with:"
echo "  scp -r e-imzo-upload/* root@YOUR_VPS_IP:/opt/e-imzo-server/"
echo ""
echo "Then run on VPS:"
echo "  cd /opt/e-imzo-server && chmod +x install.sh && ./install.sh"
