#!/usr/bin/env bash
set -euo pipefail

# Ensure this script is run as root
if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root" >&2
  exit 1
fi

# Check for required arguments
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <package1> [<package2> ...]" >&2
  exit 1
fi

# Colors for better logging (optional)
GREEN='\033[0;32m'
RESET='\033[0m'

# Install packages with clean-up
echo -e "${GREEN}Installing packages: $@${RESET}"
dnf install -y "$@"

echo -e "${GREEN}Cleaning up package cache and metadata...${RESET}"
dnf clean all
rm -rf /var/cache/dnf/* /var/cache/yum/* /tmp/* /var/tmp/*

echo -e "${GREEN}Installation and cleanup complete.${RESET}"
