#!/bin/bash

# This script verifies the directory structure required by the API
# and creates it if it doesn't exist, with proper permissions

# Define the required directories
REQUIRED_DIR="/home/clab_nfs_share/containerlab_topologies"
TEST_USER="kishore"  # Replace with your default test user

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Containerlab API Directory Structure Verification${NC}"
echo "----------------------------------------"

# Check if the directory exists
if [ -d "$REQUIRED_DIR" ]; then
  echo -e "${GREEN}✓ Directory $REQUIRED_DIR exists${NC}"
else
  echo -e "${RED}✗ Directory $REQUIRED_DIR does not exist${NC}"
  echo -e "${YELLOW}Creating directory structure...${NC}"
  mkdir -p "$REQUIRED_DIR"
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Directory created successfully${NC}"
  else
    echo -e "${RED}✗ Failed to create directory. Try running with sudo.${NC}"
    exit 1
  fi
fi

# Create test user directory
TEST_USER_DIR="$REQUIRED_DIR/$TEST_USER"
if [ ! -d "$TEST_USER_DIR" ]; then
  echo -e "${YELLOW}Creating test user directory: $TEST_USER_DIR${NC}"
  mkdir -p "$TEST_USER_DIR"
fi

# Check permissions
if [ -w "$REQUIRED_DIR" ]; then
  echo -e "${GREEN}✓ Directory $REQUIRED_DIR is writable${NC}"
else
  echo -e "${RED}✗ Directory $REQUIRED_DIR is not writable${NC}"
  echo -e "${YELLOW}Fixing permissions...${NC}"
  chmod -R 777 /home/clab_nfs_share
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Permissions updated successfully${NC}"
  else
    echo -e "${RED}✗ Failed to update permissions. Try running with sudo.${NC}"
  fi
fi

# Create a test file to verify write access
TEST_FILE="$TEST_USER_DIR/dir-test.txt"
echo "Directory structure test - $(date)" > "$TEST_FILE" 2>/dev/null
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Successfully wrote test file to $TEST_FILE${NC}"
  rm "$TEST_FILE"
else
  echo -e "${RED}✗ Failed to write test file. Check permissions.${NC}"
fi

echo -e "\n${YELLOW}Verification complete${NC}"
echo "If you need to run containerlab-api API tests, ensure the user directory exists:"
echo -e "${GREEN}mkdir -p $REQUIRED_DIR/\$YOUR_USERNAME${NC}"
echo "----------------------------------------" 