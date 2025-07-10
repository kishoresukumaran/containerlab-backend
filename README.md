# Containerlab API

This project provides a dual-API server solution for Containerlab:

1. A custom Express.js backend API server for Containerlab Studio
2. The official containerlab API server (via `containerlab tools api-server`)

## Prerequisites

Before installing and running this application, make sure you have the following:

- **Git**: Required to clone the repository
- **Docker**: Required for containerizing the application (with Docker Compose plugin)
- **Containerlab v0.68.0**: Required on the host system (the same version is installed in the container)
- **Root access**: Required for systemd service installation and Docker operations
- **jq**: Optional, but recommended for formatting API responses and running the test script
- **Node.js** (v14+): Only needed if you plan to run the server outside the container

### Installing Prerequisites

#### For Ubuntu/Debian:
```bash
# Install Git
sudo apt-get update
sudo apt-get install -y git

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Containerlab v0.68.0 (specific version)
bash -c "$(curl -sL https://get.containerlab.dev)" -- -v 0.68.0

# Verify containerlab version
containerlab version

# Install jq
sudo apt-get install jq -y
```

#### For AlmaLinux/RHEL/CentOS:
```bash
# Install Git
sudo dnf install -y git

# Install Docker
sudo dnf -y install dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start and enable Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Install Containerlab v0.68.0 (specific version)
bash -c "$(curl -sL https://get.containerlab.dev)" -- -v 0.68.0

# Verify containerlab version
containerlab version

# Install jq
sudo dnf install jq -y
```

#### Verify Docker Compose is available:
```bash
docker compose version
```

## Quick Installation

1. Clone this repository:
   ```bash
   git clone https://gitlab.aristanetworks.com/kishore/containerlab-api.git
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

## API Testing

The repository includes an API test script to verify that all endpoints are working correctly:

```bash
# Make the script executable
chmod +x api-test.sh

# Edit the script to update SERVER_IP and USERNAME variables
nano api-test.sh

# Run the test script
./api-test.sh
```

The test script will:
- Execute tests against most API endpoints
- Display formatted JSON responses
- Create, modify, and delete test files in a safe location

For more complex tests (topology deployment, git operations), you'll need to manually test with valid configuration files and repositories.

## Available Services

This container runs two separate API services:

1. **Express API (Port 3001)** - Custom API for Containerlab Studio with endpoints listed below
2. **Official containerlab API server (Port 8080)** - Official API provided by the containerlab project

## Express API Documentation

The Express API server provides a comprehensive set of endpoints for managing containerlab topologies, file operations, system metrics, and more.

### Base URLs
- Local Development: `http://localhost:3001`
- Server: `http://<server-ip>:3001`

### Containerlab Management

#### List Topologies
```
GET /api/containerlab/inspect
```

Lists all containerlab topologies.

Example:
```bash
curl http://localhost:3001/api/containerlab/inspect
```

#### Deploy Topology
```
POST /api/containerlab/deploy
```

Deploys a new containerlab topology.

Example:
```bash
curl -X POST http://localhost:3001/api/containerlab/deploy \
  -F "file=@./mytopology.yaml" \
  -F "serverIp=10.83.12.71" \
  -F "username=myuser"
```

#### Destroy Topology
```
POST /api/containerlab/destroy
```

Destroys an existing containerlab topology.

Example:
```bash
curl -X POST http://localhost:3001/api/containerlab/destroy \
  -H "Content-Type: application/json" \
  -d '{"serverIp": "10.83.12.71", "topoFile": "/path/to/topology.yaml", "username": "myuser"}'
```

#### Reconfigure Topology
```
POST /api/containerlab/reconfigure
```

Reconfigures an existing topology with an updated topology file.

Example:
```bash
curl -X POST http://localhost:3001/api/containerlab/reconfigure \
  -F "file=@./mytopology.yaml" \
  -F "serverIp=10.83.12.71" \
  -F "username=myuser"
```

#### Save Topology State
```
POST /api/containerlab/save
```

Saves the current state of a topology.

Example:
```bash
curl -X POST http://localhost:3001/api/containerlab/save \
  -H "Content-Type: application/json" \
  -d '{"serverIp": "10.83.12.71", "topoFile": "/path/to/topology.yaml", "username": "myuser"}'
```

### File Operations

#### List Directory Contents
```
GET /api/files/list
```

Lists contents of a directory.

Example:
```bash
curl "http://localhost:3001/api/files/list?path=/home/user/dir&serverIp=10.83.12.71&username=myuser"
```

#### Read File
```
GET /api/files/read
```

Reads the content of a file.

Example:
```bash
curl "http://localhost:3001/api/files/read?path=/home/user/file.txt&serverIp=10.83.12.71&username=myuser"
```

#### Save File
```
POST /api/files/save
```

Saves a file at a specific path.

Example:
```bash
curl -X POST http://localhost:3001/api/files/save \
  -F "file=@./localfile.txt" \
  -F "serverIp=10.83.12.71" \
  -F "username=myuser" \
  -F "path=/home/user/dir"
```

#### Upload File
```
POST /api/files/upload
```

Uploads a file to a directory.

Example:
```bash
curl -X POST http://localhost:3001/api/files/upload \
  -F "file=@./localfile.txt" \
  -F "serverIp=10.83.12.71" \
  -F "username=myuser" \
  -F "targetDirectory=/home/user/dir"
```

#### Delete File/Directory
```
DELETE /api/files/delete
```

Deletes a file or directory.

Example:
```bash
curl -X DELETE http://localhost:3001/api/files/delete \
  -H "Content-Type: application/json" \
  -d '{"serverIp": "10.83.12.71", "path": "/home/user/file.txt", "isDirectory": false, "username": "myuser"}'
```

#### Create Directory
```
POST /api/files/createDirectory
```

Creates a new directory.

Example:
```bash
curl -X POST http://localhost:3001/api/files/createDirectory \
  -H "Content-Type: application/json" \
  -d '{"serverIp": "10.83.12.71", "path": "/home/user", "directoryName": "newdir", "username": "myuser"}'
```

#### Create File
```
POST /api/files/createFile
```

Creates a new file with content.

Example:
```bash
curl -X POST http://localhost:3001/api/files/createFile \
  -H "Content-Type: application/json" \
  -d '{"serverIp": "10.83.12.71", "path": "/home/user", "fileName": "newfile.txt", "content": "Hello World", "username": "myuser"}'
```

#### Copy File/Directory
```
POST /api/files/copyPaste
```

Copies a file or directory to another location.

Example:
```bash
curl -X POST http://localhost:3001/api/files/copyPaste \
  -H "Content-Type: application/json" \
  -d '{"sourceServerIp": "10.83.12.71", "sourcePath": "/home/user/src.txt", "isDirectory": false, "destinationServerIp": "10.83.12.71", "destinationPath": "/home/user/dest", "username": "myuser"}'
```

#### Rename File/Directory
```
POST /api/files/rename
```

Renames a file or directory.

Example:
```bash
curl -X POST http://localhost:3001/api/files/rename \
  -H "Content-Type: application/json" \
  -d '{"serverIp": "10.83.12.71", "oldPath": "/home/user/old.txt", "newPath": "/home/user/new.txt", "username": "myuser"}'
```

### Git Operations

#### Clone Repository
```
POST /api/git/clone
```

Clones a Git repository.

Example:
```bash
curl -X POST http://localhost:3001/api/git/clone \
  -H "Content-Type: application/json" \
  -d '{"gitRepoUrl": "https://github.com/username/repo.git", "username": "myuser"}'
```

### System Operations

#### Get Free Ports
```
GET /api/ports/free
```

Lists free network ports on a server.

Example:
```bash
curl "http://localhost:3001/api/ports/free?serverIp=10.83.12.71"
```

#### Get System Metrics
```
GET /api/system/metrics
```

Gets CPU and memory usage metrics.

Example:
```bash
curl http://localhost:3001/api/system/metrics
```

#### Health Check
```
GET /health
```

Simple health check endpoint.

Example:
```bash
curl http://localhost:3001/health
```

### WebSocket Connection

The API also provides a WebSocket endpoint for SSH connections:

```
ws://<server-ip>:3001/ws/ssh
```

This endpoint handles SSH connections to containerlab nodes and can be used by terminal clients.

## Requirements

- Docker and Docker Compose
- Root access for systemd service installation
- Containerlab installed on the host system

## Configuration

The Express API server runs on port 3001 by default.
The containerlab API server runs on port 8080 by default.
The Docker container requires privileged access to manage containerlab environments.

## Troubleshooting

If you encounter issues:

1. Check the logs:
   ```bash
   docker compose logs
   # or for systemd service
   journalctl -u containerlab-api-docker.service -f
   ```

2. Ensure ports 3001 and 8080 are not in use by another service:
   ```bash
   sudo lsof -i :3001
   sudo lsof -i :8080
   ```

3. Test the API with the provided curl commands to verify connectivity and functionality.

## Advanced Troubleshooting

### SystemD Service Issues

If you see errors like `status=200/CHDIR` in the systemd service status:

1. Check if the paths in the service file are correct:
   ```bash
   cat /etc/systemd/system/containerlab-api-docker.service
   ```

2. Edit the service file with absolute paths:
   ```bash
   sudo nano /etc/systemd/system/containerlab-api-docker.service
   ```
   
   Ensure the paths are correct:
   ```
   [Service]
   Type=simple
   WorkingDirectory=/full/path/to/containerlab-api
   ExecStart=/usr/bin/docker compose -f /full/path/to/containerlab-api/docker-compose.yml up
   ExecStop=/usr/bin/docker compose -f /full/path/to/containerlab-api/docker-compose.yml down
   ```

3. Reload and restart the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart containerlab-api-docker.service
   ```

### Both API Servers Not Starting

If both your Express API and the official containerlab API server aren't running:

1. Start each separately for debugging:
   ```bash
   # Start Express API only
   cd /path/to/containerlab-api
   docker compose up -d
   
   # Start official containerlab API server
   containerlab tools api-server start
   ```

2. Check if the containerlab API server is running:
   ```bash
   containerlab tools api-server status
   ```

3. Check container logs:
   ```bash
   docker logs containerlab-api
   docker logs clab-api-server
   ```

### Port Conflicts

If there are port conflicts:

1. Check what process is using port 3001 or 8080:
   ```bash
   sudo lsof -i :3001
   sudo lsof -i :8080
   ```

2. Edit the docker-compose.yml file to use different ports if needed. 