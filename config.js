// Configuration for containerlab-api
module.exports = {
  // Server IP where this service is running
  serverIp: '10.83.12.237',  // This will be updated during installation
  
  // API port settings
  expressApiPort: 3001,
  containerLabApiPort: 8080,
  
  // Default directory structure
  baseTopologyDirectory: '/home/clab_nfs_share/containerlab_topologies'
}; 