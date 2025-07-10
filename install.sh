#!/bin/bash

# Exit on error
set -e

echo "Containerlab API Installation Script"
echo "==================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root or with sudo"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo "Docker is not installed. Please install Docker first."
  exit 1
fi

# Check if service is already running
if systemctl is-active --quiet containerlab-api.service; then
  echo "Stopping existing containerlab-api systemd service..."
  systemctl stop containerlab-api.service
  systemctl disable containerlab-api.service
fi

# Stop any existing containers
echo "Stopping any existing containerlab-api containers..."
docker compose down 2>/dev/null || true

# Build the docker image
echo "Building Docker image..."
docker compose build

echo ""
echo "Choose startup method:"
echo "1) Use Docker Compose (manually start/stop with 'docker compose up/down')"
echo "2) Install as SystemD service (auto-start on boot)"
read -p "Enter option (1 or 2): " startup_option

if [ "$startup_option" = "1" ]; then
  echo "Starting containerlab-api with Docker Compose..."
  docker compose up -d
  
  echo ""
  echo "Installation complete!"
  echo "You can manage the container with:"
  echo "  - Start: docker compose up -d"
  echo "  - Stop:  docker compose down"
  echo "  - Logs:  docker compose logs -f"
  
elif [ "$startup_option" = "2" ]; then
  echo "Installing systemd service..."
  cp containerlab-api-docker.service /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable containerlab-api-docker.service
  systemctl start containerlab-api-docker.service
  
  echo ""
  echo "Installation complete!"
  echo "The service is now running and will start automatically on boot"
  echo "You can manage it with:"
  echo "  - Check status: systemctl status containerlab-api-docker.service"
  echo "  - Stop:         systemctl stop containerlab-api-docker.service"
  echo "  - Start:        systemctl start containerlab-api-docker.service"
  echo "  - View logs:    journalctl -u containerlab-api-docker.service -f"
  
else
  echo "Invalid option. Please run the script again and choose 1 or 2."
  exit 1
fi

echo ""
echo "The containerlab API is now running on port 3001" 