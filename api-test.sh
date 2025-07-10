#!/bin/bash

# API Test Script for Containerlab API
# This script contains curl commands to test various API endpoints

# Configuration
API_URL="http://localhost:3001"
SERVER_IP="10.83.12.71"  # Replace with your target server IP
USERNAME="myuser"        # Replace with your username
TEST_FILE="test-file.txt"
TEST_DIR="/home/clab_nfs_share/containerlab_topologies/$USERNAME"

# Create a test file
echo "This is a test file for API testing" > $TEST_FILE

echo "----------------------------------------"
echo "Containerlab API Test Script"
echo "----------------------------------------"

# Ensure the required directory structure exists
echo -e "\nEnsuring required directory structure exists..."
sudo mkdir -p $TEST_DIR
sudo chmod -R 777 /home/clab_nfs_share
echo "Directory structure verified."

# Health check
echo -e "\n1. Testing health check endpoint:"
curl -s "$API_URL/health" | jq

# System metrics
echo -e "\n2. Testing system metrics endpoint:"
curl -s "$API_URL/api/system/metrics" | jq

# List topologies
echo -e "\n3. Testing list topologies endpoint:"
curl -s "$API_URL/api/containerlab/inspect" | jq

# Check free ports
echo -e "\n4. Testing free ports endpoint:"
curl -s "$API_URL/api/ports/free?serverIp=$SERVER_IP" | jq

# List files in a directory
echo -e "\n5. Testing list files endpoint:"
curl -s "$API_URL/api/files/list?path=/home&serverIp=$SERVER_IP&username=$USERNAME" | jq

# Create directory
echo -e "\n6. Testing create directory endpoint:"
curl -s -X POST "$API_URL/api/files/createDirectory" \
  -H "Content-Type: application/json" \
  -d "{\"serverIp\": \"$SERVER_IP\", \"path\": \"$TEST_DIR\", \"directoryName\": \"api-test\", \"username\": \"$USERNAME\"}" | jq

# Upload file
echo -e "\n7. Testing file upload endpoint:"
curl -s -X POST "$API_URL/api/files/upload" \
  -F "file=@./$TEST_FILE" \
  -F "serverIp=$SERVER_IP" \
  -F "username=$USERNAME" \
  -F "targetDirectory=$TEST_DIR/api-test" | jq

# List files in the test directory
echo -e "\n8. Testing list files in the test directory:"
curl -s "$API_URL/api/files/list?path=$TEST_DIR/api-test&serverIp=$SERVER_IP&username=$USERNAME" | jq

# Read uploaded file
echo -e "\n9. Testing read file endpoint:"
curl -s "$API_URL/api/files/read?path=$TEST_DIR/api-test/$TEST_FILE&serverIp=$SERVER_IP&username=$USERNAME" | jq

# Create a file with content
echo -e "\n10. Testing create file endpoint:"
curl -s -X POST "$API_URL/api/files/createFile" \
  -H "Content-Type: application/json" \
  -d "{\"serverIp\": \"$SERVER_IP\", \"path\": \"$TEST_DIR/api-test\", \"fileName\": \"created-file.txt\", \"content\": \"This file was created by the API test script\", \"username\": \"$USERNAME\"}" | jq

# Copy a file
echo -e "\n11. Testing file copy endpoint:"
curl -s -X POST "$API_URL/api/files/copyPaste" \
  -H "Content-Type: application/json" \
  -d "{\"sourceServerIp\": \"$SERVER_IP\", \"sourcePath\": \"$TEST_DIR/api-test/$TEST_FILE\", \"isDirectory\": false, \"destinationServerIp\": \"$SERVER_IP\", \"destinationPath\": \"$TEST_DIR/api-test\", \"username\": \"$USERNAME\"}" | jq

# Rename a file
echo -e "\n12. Testing file rename endpoint:"
curl -s -X POST "$API_URL/api/files/rename" \
  -H "Content-Type: application/json" \
  -d "{\"serverIp\": \"$SERVER_IP\", \"oldPath\": \"$TEST_DIR/api-test/$TEST_FILE.copy\", \"newPath\": \"$TEST_DIR/api-test/renamed-file.txt\", \"username\": \"$USERNAME\"}" | jq

# Delete a file
echo -e "\n13. Testing delete file endpoint:"
curl -s -X DELETE "$API_URL/api/files/delete" \
  -H "Content-Type: application/json" \
  -d "{\"serverIp\": \"$SERVER_IP\", \"path\": \"$TEST_DIR/api-test/renamed-file.txt\", \"isDirectory\": false, \"username\": \"$USERNAME\"}" | jq

echo -e "\n----------------------------------------"
echo "Test execution completed!"
echo -e "----------------------------------------\n"

# Clean up the local test file
rm $TEST_FILE

echo "NOTE: This script tested the basic API functionality."
echo "For deploy/destroy/reconfigure/save topology tests, you would need a valid topology file."
echo "For git clone test, you would need a valid git repo URL." 