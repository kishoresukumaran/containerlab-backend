const express = require('express');
const { exec } = require('child_process');
const multer = require('multer');
const cors = require('cors');
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { Client } = require('ssh2');
const http = require('http');

const app = express();
const port = 3001;

const server = http.createServer(app);

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

const wss = new WebSocket.Server({ 
  server,
  path: '/ws/ssh',
  perMessageDeflate: false,
  clientTracking: true
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
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

app.use(express.json());

const sshConfig = {
    username: 'kishore',
    password: 'arastra',
    tryKeyboard: true,
    readyTimeout: 5000
};

const resolvePath = (relativePath, basePath = '/opt') => {
    if (relativePath.startsWith('/')) {
        return relativePath;
    }
    const parts = relativePath.split('/');
    const baseParts = basePath.split('/');
    
    for (const part of parts) {
        if (part === '..') {
            baseParts.pop();
        } else if (part !== '.') {
            baseParts.push(part);
        }
    }
    
    return baseParts.join('/');
};

app.get('/api/containerlab/inspect', (req, res) => {
    exec('clab inspect --all --format json', (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }

        try {
            const data = JSON.parse(stdout);
            const topologies = [];
            const labsByFile = {};

            data.containers.forEach(container => {
                const fullLabPath = resolvePath(container.labPath);
                
                if (!labsByFile[fullLabPath]) {
                    labsByFile[fullLabPath] = {
                        labPath: fullLabPath,
                        lab_name: container.lab_name,
                        lab_owner: container.owner,
                        nodes: []
                    };
                    topologies.push(labsByFile[fullLabPath]);
                }
                labsByFile[fullLabPath].nodes.push({
                    ...container,
                    labPath: fullLabPath
                });
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

app.post('/api/containerlab/deploy', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { serverIp, username } = req.body;
        if (!serverIp) {
            return res.status(400).json({ error: 'Server IP is required' });
        }
        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const ssh = new NodeSSH();
        
        try {
            res.write('Connecting to server...\n');
            await ssh.connect({
                ...sshConfig,
                host: serverIp,
                username: username,    
                password: 'arastra',
                tryKeyboard: true,
                readyTimeout: 5000
            });
            res.write('Connected successfully\n');
        } catch (error) {
            res.write(`Failed to connect to server: ${error.message}\n`);
            res.end();
            return;
        }

        const userDir = `/home/${username}/containerlab_topologies`;
        const remoteFilePath = `${userDir}/${req.file.originalname}`;

        try {
            res.write(`Ensuring containerlab_topologies directory exists at ${userDir}...\n`);
            await ssh.execCommand(`mkdir -p ${userDir}`, {
                cwd: '/'
            });

            res.write(`Uploading file to ${remoteFilePath}...\n`);
            await ssh.putFile(req.file.path, remoteFilePath);
            res.write('File uploaded successfully\n');

            res.write('Executing containerlab deploy command...\n');
            const deployCommand = `clab deploy --topo ${remoteFilePath}`;
            const result = await ssh.execCommand(deployCommand, {
                cwd: '/',
                onStdout: (chunk) => {
                    res.write(`stdout: ${chunk.toString()}\n`);
                },
                onStderr: (chunk) => {
                    res.write(`stderr: ${chunk.toString()}\n`);
                }
            });

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
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.write(`Server error: ${error.message}\n`);
        res.end(JSON.stringify({
            error: `Server error: ${error.message}`
        }));
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.post('/api/containerlab/destroy', async (req, res) => {
    try {
        const { serverIp, topoFile } = req.body;
        
        if (!serverIp || !topoFile) {
            return res.status(400).json({ 
                error: 'Server IP and topology file path are required' 
            });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const ssh = new NodeSSH();
        
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
            res.write('Executing containerlab destroy command...\n');
            const absoluteTopoPath = resolvePath(topoFile);
            const destroyCommand = `clab destroy --topo ${absoluteTopoPath}`;
            const result = await ssh.execCommand(destroyCommand, {
                cwd: '/',
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

app.post('/api/containerlab/reconfigure', async (req, res) => {
    try {
        const { serverIp, topoFile } = req.body;
        
        if (!serverIp || !topoFile) {
            return res.status(400).json({ 
                error: 'Server IP and topology file path are required' 
            });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const ssh = new NodeSSH();
        
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
            res.write('Executing containerlab reconfigure command...\n');
            const absoluteTopoPath = resolvePath(topoFile);
            const reconfigureCommand = `clab deploy --topo ${absoluteTopoPath} --reconfigure`;
            const result = await ssh.execCommand(reconfigureCommand, {
                cwd: '/',
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

app.get('/api/ports/free', async (req, res) => {
    try {
        const { serverIp } = req.query;
        
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

app.get('/api/files/list', async (req, res) => {
  try {
    const { path, serverIp } = req.query;
    
    if (!serverIp) {
      return res.status(400).json({ success: false, error: 'Server IP is required' });
    }

    const ssh = new NodeSSH();
    await ssh.connect({
      ...sshConfig,
      host: serverIp
    });

    const { stdout } = await ssh.execCommand(`ls -la ${path}`, { cwd: '/' });
    
    const contents = stdout.split('\n')
      .slice(1)
      .filter(line => line.trim() && !line.endsWith('.') && !line.endsWith('..'))
      .map(line => {
        const parts = line.split(/\s+/);
        const name = parts.slice(8).join(' ');
        const isDirectory = line.startsWith('d');
        return {
          name,
          type: isDirectory ? 'directory' : 'file',
          path: `${path}/${name}`
        };
      });

    await ssh.dispose();
    res.json({ success: true, contents });
  } catch (error) {
    console.error('Error listing directory:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/files/read', async (req, res) => {
  try {
    const { path, serverIp } = req.query;
    
    if (!serverIp) {
      return res.status(400).json({ success: false, error: 'Server IP is required' });
    }

    const ssh = new NodeSSH();
    await ssh.connect({
      ...sshConfig,
      host: serverIp
    });

    const { stdout } = await ssh.execCommand(`cat ${path}`, { cwd: '/' });
    
    await ssh.dispose();
    res.json({ success: true, content: stdout });
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection established');
  let sshClient = null;
  let sshStream = null;

  ws.on('message', async (message) => {
    if (sshStream) {
      sshStream.write(message.toString());
      return;
    }

    try {
      const data = JSON.parse(message);
      console.log('Received connection request:', data);
      const { nodeName, nodeIp, username } = data;

      sshClient = new Client();

      console.log(`Attempting SSH connection to ${nodeIp}`);
      sshClient.connect({
        host: nodeIp,
        username: 'admin',
        tryKeyboard: true,
        readyTimeout: 10000,
        debug: console.log
      });
      
      sshClient.on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
        console.log('Keyboard interactive authentication requested');
        const responses = prompts.map(() => 'admin');
        finish(responses);
      });
      
      sshClient.on('authenticationRequired', (authMethods) => {
        console.log('Authentication required, methods:', authMethods);
        if (!authMethods || authMethods.length === 0) {
          sshClient.authPassword('admin', 'admin');
        }
      });

      sshClient.on('error', (err) => {
        console.error('SSH connection error:', err);
        ws.send(`\r\n\x1b[31mError: ${err.message}\x1b[0m`);
      });

      const connectionTimeout = setTimeout(() => {
        if (sshClient && !sshClient._sock) {
          console.error('SSH connection timeout');
          ws.send('\r\n\x1b[31mError: Connection timeout\x1b[0m');
          sshClient.end();
        }
      }, 10000);

      sshClient.on('ready', () => {
        clearTimeout(connectionTimeout);
        console.log('SSH connection ready');
        sshClient.shell({ term: 'xterm-256color' }, (err, stream) => {
          if (err) {
            console.error('Error creating shell:', err);
            ws.send('\r\n\x1b[31mError: Failed to create shell\x1b[0m');
            return;
          }

          console.log('Shell created successfully');
          sshStream = stream;

          stream.on('data', (data) => {
            const output = data.toString();
            ws.send(output);
          });

          stream.on('close', () => {
            console.log('SSH stream closed');
            sshClient.end();
            sshStream = null;
          });
        });
      });

    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      ws.send(`\r\n\x1b[31mError: ${error.message}\x1b[0m`);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
    if (sshClient) {
      sshClient.end();
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    if (sshClient) {
      sshClient.end();
    }
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  console.log(`WebSocket server is ready at ws://0.0.0.0:${port}/ws/ssh`);
});
