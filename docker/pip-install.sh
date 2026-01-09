#!/usr/bin/env bash
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
set -euo pipefail

# Default flag
REQUIRES_BUILD_ESSENTIAL=false
USE_CACHE=true

# Filter arguments
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --requires-build-essential)
      REQUIRES_BUILD_ESSENTIAL=true
      ;;
    --no-cache)
      USE_CACHE=false
      ;;
    *)
      ARGS+=("$arg")
      ;;
  esac
done

# Install build tools if required (Red Hat equivalent of build-essential)
if $REQUIRES_BUILD_ESSENTIAL; then
  echo "Installing build tools for package builds..."
  microdnf install -y gcc gcc-c++ make kernel-headers glibc-headers glibc-devel libxcrypt-devel binutils libstdc++-devel \
    && microdnf clean all
fi

# Choose whether to use pip cache
if $USE_CACHE; then
  echo "Using pip cache..."
  uv pip install "${ARGS[@]}"
else
  echo "Disabling pip cache..."
  uv pip install --no-cache-dir "${ARGS[@]}"
fi

# Note: Build tools are NOT removed here - the Dockerfile will handle cleanup
# This allows the Dockerfile to control when build dependencies are removed

echo "Python packages installed successfully."
