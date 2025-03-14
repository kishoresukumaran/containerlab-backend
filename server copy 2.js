const express = require('express');
const { exec } = require('child_process');
const multer = require('multer');
const cors = require('cors');
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3001;

// Configure multer with custom storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        // Create uploads directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());

// SSH configuration
const sshConfig = {
    username: 'root',
    password: 'arastra',
    tryKeyboard: true,
    readyTimeout: 5000
};

// Existing inspect endpoint
app.get('/api/containerlab/inspect', (req, res) => {
    exec('clab inspect --all --format json', (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }

        try {
            const data = JSON.parse(stdout);
            const topologies = [];
            const labsByFile = {};

            // Group nodes by topology file
            data.containers.forEach(container => {
                if (!labsByFile[container.labPath]) {
                    labsByFile[container.labPath] = {
                        labPath: container.labPath,
                        lab_name: container.lab_name,
                        lab_owner: container.owner,
                        nodes: []
                    };
                    topologies.push(labsByFile[container.labPath]);
                }
                labsByFile[container.labPath].nodes.push(container);
            });

            res.json(topologies);
        } catch (parseError) {
            res.status(500).json({
                error: 'Failed to parse JSON output',
                details: parseError.message,
                rawOutput: stdout
            });
        }
    });
});

// Updated deployment endpoint with containerlab deployment
app.post('/api/containerlab/deploy', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { serverIp } = req.body;
        if (!serverIp) {
            return res.status(400).json({ error: 'Server IP is required' });
        }

        // Set headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const ssh = new NodeSSH();
        
        // Connect to the remote server
        try {
            res.write('Connecting to server...\n');
            await ssh.connect({
                ...sshConfig,
                host: serverIp,
            });
            res.write('Connected successfully\n');
        } catch (error) {
            res.write(`Failed to connect to server: ${error.message}\n`);
            res.end();
            return;
        }

        const remoteFilePath = `/opt/${req.file.originalname}`;

        try {
            // Upload the file to the remote server
            res.write(`Uploading file to ${remoteFilePath}...\n`);
            await ssh.putFile(req.file.path, remoteFilePath);
            res.write('File uploaded successfully\n');

            // Execute containerlab deploy command
            res.write('Executing containerlab deploy command...\n');
            const deployCommand = `clab deploy --topo ${req.file.originalname}`;
            const result = await ssh.execCommand(deployCommand, {
                cwd: '/opt',
                onStdout: (chunk) => {
                    res.write(`stdout: ${chunk.toString()}\n`);
                },
                onStderr: (chunk) => {
                    res.write(`stderr: ${chunk.toString()}\n`);
                }
            });

            // Clean up the temporary file
            fs.unlinkSync(req.file.path);
            
            if (result.code === 0) {
                res.write('Operation completed successfully\n');
                res.end(JSON.stringify({
                    success: true,
                    message: 'Topology deployed successfully',
                    filePath: remoteFilePath
                }));
            } else {
                res.write(`Operation failed: ${result.stderr}\n`);
                res.end(JSON.stringify({
                    success: false,
                    message: 'Deployment failed',
                    error: result.stderr
                }));
            }

        } catch (error) {
            // Clean up the temporary file in case of error
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            
            res.write(`Operation failed: ${error.message}\n`);
            res.end(JSON.stringify({
                error: `Deployment failed: ${error.message}`
            }));
        } finally {
            ssh.dispose();
        }

    } catch (error) {
        // Clean up the temporary file in case of error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.write(`Server error: ${error.message}\n`);
        res.end(JSON.stringify({
            error: `Server error: ${error.message}`
        }));
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Add destroy topology endpoint
app.post('/api/containerlab/destroy', async (req, res) => {
    try {
        const { serverIp, topoFile } = req.body;
        
        if (!serverIp || !topoFile) {
            return res.status(400).json({ 
                error: 'Server IP and topology file path are required' 
            });
        }

        // Set headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const ssh = new NodeSSH();
        
        // Connect to the remote server
        try {
            res.write('Connecting to server...\n');
            await ssh.connect({
                ...sshConfig,
                host: serverIp,
            });
            res.write('Connected successfully\n');
        } catch (error) {
            res.write(`Failed to connect to server: ${error.message}\n`);
            res.end();
            return;
        }

        try {
            // Execute containerlab destroy command
            res.write('Executing containerlab destroy command...\n');
            const destroyCommand = `clab destroy --topo ${topoFile}`;
            const result = await ssh.execCommand(destroyCommand, {
                cwd: '/opt',
                onStdout: (chunk) => {
                    res.write(`stdout: ${chunk.toString()}\n`);
                },
                onStderr: (chunk) => {
                    res.write(`stderr: ${chunk.toString()}\n`);
                }
            });

            if (result.code === 0) {
                res.write('Operation completed successfully\n');
                res.end(JSON.stringify({
                    success: true,
                    message: 'Topology destroyed successfully'
                }));
            } else {
                res.write(`Operation failed: ${result.stderr}\n`);
                res.end(JSON.stringify({
                    success: false,
                    message: 'Destroy operation failed',
                    error: result.stderr
                }));
            }

        } catch (error) {
            res.write(`Operation failed: ${error.message}\n`);
            res.end(JSON.stringify({
                error: `Destroy operation failed: ${error.message}`
            }));
        } finally {
            ssh.dispose();
        }

    } catch (error) {
        res.write(`Server error: ${error.message}\n`);
        res.end(JSON.stringify({
            error: `Server error: ${error.message}`
        }));
    }
});

// Add reconfigure topology endpoint
app.post('/api/containerlab/reconfigure', async (req, res) => {
    try {
        const { serverIp, topoFile } = req.body;
        
        if (!serverIp || !topoFile) {
            return res.status(400).json({ 
                error: 'Server IP and topology file path are required' 
            });
        }

        // Set headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const ssh = new NodeSSH();
        
        // Connect to the remote server
        try {
            res.write('Connecting to server...\n');
            await ssh.connect({
                ...sshConfig,
                host: serverIp,
            });
            res.write('Connected successfully\n');
        } catch (error) {
            res.write(`Failed to connect to server: ${error.message}\n`);
            res.end();
            return;
        }

        try {
            // Execute containerlab reconfigure command
            res.write('Executing containerlab reconfigure command...\n');
            const reconfigureCommand = `clab deploy --topo ${topoFile} --reconfigure`;
            const result = await ssh.execCommand(reconfigureCommand, {
                cwd: '/opt',
                onStdout: (chunk) => {
                    res.write(`stdout: ${chunk.toString()}\n`);
                },
                onStderr: (chunk) => {
                    res.write(`stderr: ${chunk.toString()}\n`);
                }
            });

            if (result.code === 0) {
                res.write('Operation completed successfully\n');
                res.end(JSON.stringify({
                    success: true,
                    message: 'Topology reconfigured successfully'
                }));
            } else {
                res.write(`Operation failed: ${result.stderr}\n`);
                res.end(JSON.stringify({
                    success: false,
                    message: 'Reconfigure operation failed',
                    error: result.stderr
                }));
            }

        } catch (error) {
            res.write(`Operation failed: ${error.message}\n`);
            res.end(JSON.stringify({
                error: `Reconfigure operation failed: ${error.message}`
            }));
        } finally {
            ssh.dispose();
        }

    } catch (error) {
        res.write(`Server error: ${error.message}\n`);
        res.end(JSON.stringify({
            error: `Server error: ${error.message}`
        }));
    }
});

// Add get free ports endpoint
// Free ports endpoint
app.get('/api/ports/free', async (req, res) => {
    try {
        const { serverIp } = req.query;
        
        // Validate IP format
        if (!serverIp || !/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(serverIp)) {
            return res.status(400).json({ 
                success: false,
                error: 'Valid IPv4 address required' 
            });
        }

        const ssh = new NodeSSH();
        
        try {
            await ssh.connect({
                ...sshConfig,
                host: serverIp,
            });

            // Optimized port finding script
            const findPortsScript = `
                #!/bin/bash
                used_ports=$(ss -tuln | awk '{print $5}' | awk -F: '{print $NF}' | sort -nu)
                comm -23 <(seq 1024 65535 | sort) <(echo "$used_ports") | tr '\n' ' '
            `;

            const result = await ssh.execCommand(findPortsScript, {
                execOptions: { timeout: 10000 }
            });
            
            if (result.code === 0) {
                const freePorts = result.stdout
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean)
                    .map(Number);
                    
                res.json({
                    success: true,
                    freePorts: freePorts,
                    count: freePorts.length
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: `Port scan failed: ${result.stderr || 'Unknown error'}`
                });
            }

        } catch (error) {
            res.status(500).json({
                success: false,
                error: `SSH connection failed: ${error.message}`
            });
        } finally {
            ssh.dispose();
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            error: `Server error: ${error.message}`
        });
    }
});

// Create uploads directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
