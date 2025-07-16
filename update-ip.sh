#!/bin/bash

# Exit on error
set -e

echo "Update Containerlab API Server IP"
echo "================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root or with sudo"
  exit 1
fi

# Get the current absolute directory path
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Get current server IP from config
CURRENT_IP=$(grep "serverIp:" "$CURRENT_DIR/config.js" | cut -d "'" -f 2)
echo "Current server IP: $CURRENT_IP"

# Prompt for new server IP
read -p "Enter the new server IP address: " SERVER_IP
if [ -z "$SERVER_IP" ]; then
  echo "Server IP cannot be empty. Exiting."
  exit 1
fi

# Update config.js with the provided server IP
echo "Updating configuration with server IP: $SERVER_IP"
sed -i "s/serverIp: '[^']*'/serverIp: '$SERVER_IP'/" "$CURRENT_DIR/config.js"
echo "Configuration updated successfully"

# Check if running with Docker Compose or systemd
if systemctl is-active --quiet containerlab-api-docker.service; then
  echo "Restarting containerlab-api-docker service..."
  systemctl restart containerlab-api-docker.service
  echo "Service restarted successfully"
else
  echo "Restarting with Docker Compose..."
  cd "$CURRENT_DIR"
  docker compose down
  docker compose up -d
  echo "Docker Compose services restarted successfully"
fi

echo ""
echo "Server IP updated to $SERVER_IP"
echo "The Express API is running on port 3001"
echo "The containerlab API server is running on port 8080" 