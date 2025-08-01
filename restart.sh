#!/bin/bash

# Exit on error
set -e

echo "Containerlab API Restart Script"
echo "=============================="
echo "This script will restart both your Express API and the containerlab API server"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root or with sudo"
  exit 1
fi

# Get the current absolute directory path
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$CURRENT_DIR"
echo "Restarting from directory: $CURRENT_DIR"

# Create required directory structure
echo "Verifying required directory structure..."
mkdir -p /home/clab_nfs_share/containerlab_topologies
chmod -R 777 /home/clab_nfs_share

# Check if systemd service is active, or if they are running with docker compose
USING_SYSTEMD=0
if systemctl is-active --quiet containerlab-api-docker.service; then
  echo "Detected running systemd service"
  USING_SYSTEMD=1
  echo "Stopping containerlab-api-docker service..."
  systemctl stop containerlab-api-docker.service
elif docker ps | grep -q containerlab-api; then
  echo "Detected running Docker container"
  echo "Stopping container..."
  docker compose down
else
  echo "No running containerlab-api detected"
fi

echo "Building updated Docker image..."
docker compose build

echo "Starting containerlab-api..."
if [ "$USING_SYSTEMD" -eq 1 ]; then
  echo "Starting systemd service..."
  systemctl start containerlab-api-docker.service
  echo "Service status:"
  systemctl status containerlab-api-docker.service --no-pager
else
  echo "Starting with docker compose..."
  docker compose up -d
  echo "Container status:"
  docker compose ps
fi

echo ""
echo "Restart completed successfully!"
echo "The Express API is now running on port 3001"
echo "The containerlab API server is running on port 8080" 