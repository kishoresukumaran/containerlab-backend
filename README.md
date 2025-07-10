# Containerlab API

This is a backend API server for Containerlab Studio that provides functionality for managing containerlab topologies.

## Quick Installation

1. Clone this repository:
   ```bash
   git clone <your-repo-url>
   cd containerlab-api
   ```

2. Make the installation script executable:
   ```bash
   chmod +x install.sh
   ```

3. Run the installation script:
   ```bash
   sudo ./install.sh
   ```

The script will guide you through the setup process and offer options to run the service using Docker Compose or as a systemd service.

## Restarting After Code Changes

When you make changes to the code (like modifying server.js), use the restart script to rebuild and restart the service:

```bash
sudo ./restart.sh
```

This script automatically detects whether you're using Docker Compose directly or the systemd service, and handles the restart process accordingly.

## Manual Installation

If you prefer to set things up manually:

1. Build the Docker image:
   ```bash
   docker compose build
   ```

2. Start the container:
   ```bash
   docker compose up -d
   ```

3. (Optional) Install as a systemd service:
   ```bash
   sudo cp containerlab-api-docker.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable containerlab-api-docker.service
   sudo systemctl start containerlab-api-docker.service
   ```

## API Documentation

The API server exposes the following endpoints:

- `GET /api/containerlab/inspect` - List all containerlab topologies
- `POST /api/containerlab/deploy` - Deploy a new topology
- `POST /api/containerlab/destroy` - Destroy a topology
- `POST /api/containerlab/reconfigure` - Reconfigure a topology
- `POST /api/containerlab/save` - Save the current state of a topology
- `GET /api/system/metrics` - Get system metrics

## Requirements

- Docker and Docker Compose
- Root access for systemd service installation
- Containerlab installed on the host system

## Configuration

The server runs on port 3001 by default. The Docker container requires privileged access to manage containerlab environments.

## Troubleshooting

If you encounter issues:

1. Check the logs:
   ```bash
   docker compose logs
   # or for systemd service
   journalctl -u containerlab-api-docker.service -f
   ```

2. Ensure port 3001 is not in use by another service:
   ```bash
   sudo lsof -i :3001
   ``` 