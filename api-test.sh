#!/bin/bash

# API Test Script for Containerlab API
# This script contains curl commands to test various API endpoints

# Configuration
API_URL="http://localhost:3001"
SERVER_IP="10.83.12.71"  # Replace with your target server IP
USERNAME="kishore"       # Replace with your username
TEST_FILE="test-file.txt"
TEST_FILE2="test-file2.txt"
TEST_DIR="/home/clab_nfs_share/containerlab_topologies/$USERNAME"

# Create test files
echo "This is a test file for API testing" > $TEST_FILE
echo "This is a second test file for API testing" > $TEST_FILE2

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

# Upload first file
echo -e "\n7. Testing file upload endpoint (first file):"
curl -s -X POST "$API_URL/api/files/upload" \
  -F "file=@./$TEST_FILE" \
  -F "serverIp=$SERVER_IP" \
  -F "username=$USERNAME" \
  -F "targetDirectory=$TEST_DIR/api-test" | jq

# Upload second file (for copy test)
echo -e "\n7b. Uploading second file for copy test:"
curl -s -X POST "$API_URL/api/files/upload" \
  -F "file=@./$TEST_FILE2" \
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

# Copy a file to a different name
echo -e "\n11. Testing file copy endpoint:"
curl -s -X POST "$API_URL/api/files/copyPaste" \
  -H "Content-Type: application/json" \
  -d "{\"sourceServerIp\": \"$SERVER_IP\", \"sourcePath\": \"$TEST_DIR/api-test/$TEST_FILE\", \"isDirectory\": false, \"destinationServerIp\": \"$SERVER_IP\", \"destinationPath\": \"$TEST_DIR/api-test/copied-files\", \"username\": \"$USERNAME\"}" | jq

# Create directory for copy destination
echo -e "\n11a. Creating directory for copy destination:"
curl -s -X POST "$API_URL/api/files/createDirectory" \
  -H "Content-Type: application/json" \
  -d "{\"serverIp\": \"$SERVER_IP\", \"path\": \"$TEST_DIR/api-test\", \"directoryName\": \"copied-files\", \"username\": \"$USERNAME\"}" | jq

# Copy a file to the new directory
echo -e "\n11b. Copying file to new directory:"
curl -s -X POST "$API_URL/api/files/copyPaste" \
  -H "Content-Type: application/json" \
  -d "{\"sourceServerIp\": \"$SERVER_IP\", \"sourcePath\": \"$TEST_DIR/api-test/$TEST_FILE2\", \"isDirectory\": false, \"destinationServerIp\": \"$SERVER_IP\", \"destinationPath\": \"$TEST_DIR/api-test/copied-files\", \"username\": \"$USERNAME\"}" | jq

# Rename a file
echo -e "\n12. Testing file rename endpoint:"
curl -s -X POST "$API_URL/api/files/rename" \
  -H "Content-Type: application/json" \
  -d "{\"serverIp\": \"$SERVER_IP\", \"oldPath\": \"$TEST_DIR/api-test/copied-files/$TEST_FILE2\", \"newPath\": \"$TEST_DIR/api-test/copied-files/renamed-file.txt\", \"username\": \"$USERNAME\"}" | jq

# Delete a file
echo -e "\n13. Testing delete file endpoint:"
curl -s -X DELETE "$API_URL/api/files/delete" \
  -H "Content-Type: application/json" \
  -d "{\"serverIp\": \"$SERVER_IP\", \"path\": \"$TEST_DIR/api-test/copied-files/renamed-file.txt\", \"isDirectory\": false, \"username\": \"$USERNAME\"}" | jq

# Clean up - delete test directory
echo -e "\n14. Cleaning up - deleting test directory:"
curl -s -X DELETE "$API_URL/api/files/delete" \
  -H "Content-Type: application/json" \
  -d "{\"serverIp\": \"$SERVER_IP\", \"path\": \"$TEST_DIR/api-test\", \"isDirectory\": true, \"username\": \"$USERNAME\"}" | jq

echo -e "\n----------------------------------------"
echo "Test execution completed!"
echo -e "----------------------------------------\n"

# Clean up the local test files
rm $TEST_FILE $TEST_FILE2

echo "NOTE: This script tested the basic API functionality."
echo "For deploy/destroy/reconfigure/save topology tests, you would need a valid topology file."
echo "For git clone test, you would need a valid git repo URL." 