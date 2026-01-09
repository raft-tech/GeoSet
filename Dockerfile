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

######################################################################
# Node stage to deal with static asset construction
######################################################################
ARG PY_VER=3.11

# If BUILDPLATFORM is null, set it to 'amd64' (or leave as is otherwise).
ARG BUILDPLATFORM=${BUILDPLATFORM:-amd64}

# Include translations in the final build
ARG BUILD_TRANSLATIONS="false"

######################################################################
# superset-node-ci used as a base for building frontend assets and CI
######################################################################
FROM --platform=${BUILDPLATFORM} registry.access.redhat.com/ubi8/ubi-minimal:latest AS superset-node-ci
ARG BUILD_TRANSLATIONS
ENV BUILD_TRANSLATIONS=${BUILD_TRANSLATIONS}
ARG DEV_MODE="false"           # Skip frontend build in dev mode
ENV DEV_MODE=${DEV_MODE}

COPY docker/ /app/docker/
# Arguments for build configuration
ARG NPM_BUILD_CMD="build"

# Install Node.js 20 from NodeSource and system dependencies required for node-gyp
RUN microdnf install -y curl ca-certificates gnupg tar gzip && \
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && \
    microdnf install -y nodejs gcc gcc-c++ make python3.11 zstd libzstd-devel which && \
    microdnf clean all && \
    rm -rf /var/cache/yum

# Define environment variables for frontend build
ENV BUILD_CMD=${NPM_BUILD_CMD} \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Run the frontend memory monitoring script
RUN /app/docker/frontend-mem-nag.sh

WORKDIR /app/superset-frontend

# Create necessary folders to avoid errors in subsequent steps
RUN mkdir -p /app/superset/static/assets \
             /app/superset/translations

# Mount package files and install dependencies if not in dev mode
# NOTE: we mount packages and plugins as they are referenced in package.json as workspaces
# ideally we'd COPY only their package.json. Here npm ci will be cached as long
# as the full content of these folders don't change, yielding a decent cache reuse rate.
# Note that it's not possible to selectively COPY or mount using blobs.
RUN --mount=type=bind,source=./superset-frontend/package.json,target=./package.json \
    --mount=type=bind,source=./superset-frontend/package-lock.json,target=./package-lock.json \
    --mount=type=cache,target=/root/.cache \
    --mount=type=cache,target=/root/.npm \
    if [ "$DEV_MODE" = "false" ]; then \
        npm ci; \
    else \
        echo "Skipping 'npm ci' in dev mode"; \
    fi

# Runs the webpack build process
COPY superset-frontend /app/superset-frontend

######################################################################
# superset-node is used for compiling frontend assets
######################################################################
FROM superset-node-ci AS superset-node

# Build the frontend if not in dev mode
RUN --mount=type=cache,target=/root/.npm \
    if [ "$DEV_MODE" = "false" ]; then \
        echo "Running 'npm run ${BUILD_CMD}'"; \
        npm run ${BUILD_CMD}; \
    else \
        echo "Skipping 'npm run ${BUILD_CMD}' in dev mode"; \
        echo "Creating stub manifest for dev mode"; \
        mkdir -p /app/superset/static/assets; \
        echo '{"app":"superset","entrypoints":{}}' > /app/superset/static/assets/manifest.json; \
    fi;

# Copy translation files
COPY superset/translations /app/superset/translations

# Build translations if enabled, then cleanup localization files
RUN if [ "$BUILD_TRANSLATIONS" = "true" ]; then \
        npm run build-translation; \
    fi; \
    rm -rf /app/superset/translations/*/*/*.po; \
    rm -rf /app/superset/translations/*/*/*.mo;


######################################################################
# PostgreSQL tools layer - build ecpg from source for SQL validation
######################################################################
FROM registry.access.redhat.com/ubi8/ubi:latest AS postgres-tools

# Install build dependencies
# Enable EPEL and PowerTools for additional build tools
RUN yum install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-8.noarch.rpm && \
    yum install -y gcc make tar gzip curl && \
    yum clean all

# Download and extract PostgreSQL 16 source
RUN curl -L https://ftp.postgresql.org/pub/source/v16.6/postgresql-16.6.tar.gz -o /tmp/postgresql.tar.gz && \
    tar -xzf /tmp/postgresql.tar.gz -C /tmp && \
    rm /tmp/postgresql.tar.gz

# Configure and build only ecpg (embedded SQL preprocessor)
# Use minimal configure options to avoid needing bison/flex
# ecpg is a dependency of Superset enabling SQL validation within the SQL IDE
WORKDIR /tmp/postgresql-16.6
RUN ./configure --prefix=/usr/local/pgsql --without-readline --without-zlib --without-icu && \
    make -C src/port && \
    make -C src/common && \
    make -C src/interfaces/libpq && \
    make -C src/interfaces/ecpg && \
    make -C src/interfaces/ecpg install && \
    make -C src/interfaces/libpq install

######################################################################
# Base python layer
######################################################################
FROM registry.access.redhat.com/ubi8/ubi-minimal:latest AS python-base

ARG PY_VER
ARG SUPERSET_HOME="/app/superset_home"
ENV SUPERSET_HOME=${SUPERSET_HOME}

# Install Python 3.11, pip, and shadow-utils (for useradd)
RUN microdnf install -y python${PY_VER} python${PY_VER}-pip python${PY_VER}-devel shadow-utils && \
    microdnf clean all && \
    rm -rf /var/cache/yum

# Create symlinks for python and pip
RUN ln -sf /usr/bin/python${PY_VER} /usr/bin/python3 && \
    ln -sf /usr/bin/python${PY_VER} /usr/bin/python && \
    ln -sf /usr/bin/pip${PY_VER} /usr/bin/pip3 && \
    ln -sf /usr/bin/pip${PY_VER} /usr/bin/pip

RUN mkdir -p $SUPERSET_HOME
RUN useradd --user-group -d ${SUPERSET_HOME} -m --no-log-init --shell /bin/bash superset \
    && chmod -R 1777 $SUPERSET_HOME \
    && chown -R superset:superset $SUPERSET_HOME

# Some bash scripts needed throughout the layers
COPY --chmod=755 docker/*.sh /app/docker/

RUN pip install --no-cache-dir --upgrade uv

# Using uv as it's faster/simpler than pip
RUN uv venv /app/.venv
ENV PATH="/app/.venv/bin:${PATH}"

######################################################################
# Python translation compiler layer
######################################################################
FROM python-base AS python-translation-compiler

ARG BUILD_TRANSLATIONS
ENV BUILD_TRANSLATIONS=${BUILD_TRANSLATIONS}

# Install Python dependencies using docker/pip-install.sh
COPY requirements/translations.txt requirements/
RUN --mount=type=cache,target=/root/.cache/uv \
    . /app/.venv/bin/activate && /app/docker/pip-install.sh --requires-build-essential -r requirements/translations.txt

COPY superset/translations/ /app/translations_mo/
RUN if [ "$BUILD_TRANSLATIONS" = "true" ]; then \
        pybabel compile -d /app/translations_mo | true; \
    fi; \
    rm -f /app/translations_mo/*/*/*.po; \
    rm -f /app/translations_mo/*/*/*.json;

######################################################################
# Python APP common layer
######################################################################
FROM python-base AS python-common

ENV SUPERSET_HOME="/app/superset_home" \
    HOME="/app/superset_home" \
    SUPERSET_ENV="production" \
    FLASK_APP="superset.app:create_app()" \
    PYTHONPATH="/app/pythonpath" \
    SUPERSET_PORT="8088"

# Copy the entrypoints, make them executable in userspace
COPY --chmod=755 docker/entrypoints /app/docker/entrypoints

WORKDIR /app
# Set up necessary directories and user
RUN mkdir -p \
      ${PYTHONPATH} \
      superset/static \
      superset-frontend \
      apache_superset.egg-info \
      requirements \
    && touch superset/static/version_info.json

# Install Playwright and optionally setup headless browsers
ARG INCLUDE_CHROMIUM="false"
ARG INCLUDE_FIREFOX="false"
RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    if [ "$INCLUDE_CHROMIUM" = "true" ] || [ "$INCLUDE_FIREFOX" = "true" ]; then \
        uv pip install playwright && \
        playwright install-deps && \
        if [ "$INCLUDE_CHROMIUM" = "true" ]; then playwright install chromium; fi && \
        if [ "$INCLUDE_FIREFOX" = "true" ]; then playwright install firefox; fi; \
    else \
        echo "Skipping browser installation"; \
    fi

# Copy required files for Python build
COPY pyproject.toml setup.py MANIFEST.in README.md ./
COPY superset-frontend/package.json superset-frontend/
COPY scripts/check-env.py scripts/

# keeping for backward compatibility
COPY --chmod=755 ./docker/entrypoints/run-server.sh /usr/bin/

# Install required libraries for UBI8
# Note: curl removed as it's not needed at runtime and brings in brotli (CVE-2025-6176)
RUN /app/docker/microdnf-install.sh \
      cyrus-sasl-devel \
      cyrus-sasl-gssapi \
      libpq-devel \
      postgresql-devel \
      openldap-devel

# Copy compiled things from previous stages
COPY --from=superset-node /app/superset/static/assets superset/static/assets

# TODO, when the next version comes out, use --exclude superset/translations
COPY superset superset
# TODO in the meantime, remove the .po files
RUN rm superset/translations/*/*/*.po

# Merging translations from backend and frontend stages
COPY --from=superset-node /app/superset/translations superset/translations
COPY --from=python-translation-compiler /app/translations_mo superset/translations

HEALTHCHECK CMD /app/docker/docker-healthcheck.sh
CMD ["/app/docker/entrypoints/run-server.sh"]
EXPOSE ${SUPERSET_PORT}

######################################################################
# Final image
######################################################################
FROM python-common AS final

# Copy requirements
COPY requirements/base.txt requirements/

# Install Python dependencies using docker/pip-install.sh
RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    /app/docker/pip-install.sh --requires-build-essential -r requirements/base.txt

# Explicitly upgrade setuptools to fix CVE-2024-6345 and CVE-2025-47273
RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    uv pip install --upgrade "setuptools>=78.1.1"

# Install the superset package
RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    uv pip install -e .

# Install DART-specific dependencies (includes gevent for gunicorn)
COPY requirements/dart.txt requirements/
RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    uv pip install -r requirements/dart.txt

# Copy ecpg binary and required libraries from postgres-tools stage
# ecpg is needed by pgsanity for SQL validation in Superset SQL IDE
# Built from source and installed to /usr/local/pgsql
COPY --from=postgres-tools /usr/local/pgsql/bin/ecpg /usr/bin/ecpg
COPY --from=postgres-tools /usr/local/pgsql/lib/libpgtypes.so.3* /usr/lib64/
COPY --from=postgres-tools /usr/local/pgsql/lib/libecpg.so.6* /usr/lib64/
COPY --from=postgres-tools /usr/local/pgsql/lib/libecpg_compat.so.3* /usr/lib64/
COPY --from=postgres-tools /usr/local/pgsql/lib/libpq.so.5* /usr/lib64/

RUN python -m compileall /app/superset

# Update all packages to latest versions to get security patches
RUN microdnf update -y && \
    microdnf clean all && \
    rm -rf /var/cache/yum

# Note: Cannot remove SQLite in UBI8 as gnupg2 and other system packages depend on it
# This is different from Debian where SQLite could be safely removed

# Remove old system setuptools to eliminate CVE-2024-6345 and CVE-2025-47273
# Note: In UBI8, system Python packages are in /usr/lib64 on x86_64
RUN rm -rf /usr/lib/python3.11/site-packages/setuptools* \
           /usr/lib/python3.11/site-packages/_distutils_hack \
           /usr/lib64/python3.11/site-packages/setuptools* \
           /usr/lib64/python3.11/site-packages/_distutils_hack 2>/dev/null || true

# Remove build-time dependencies to reduce attack surface and eliminate CVEs
# These packages were needed during pip install but are not required at runtime
# Remove compilers first, then their dependencies
RUN microdnf remove -y gcc gcc-c++ make && \
    microdnf remove -y \
    kernel-headers \
    glibc-headers \
    glibc-devel \
    libxcrypt-devel \
    binutils \
    libstdc++-devel \
    python3.11-devel && \
    microdnf clean all && \
    rm -rf /var/cache/yum

# Remove package manager and its dependencies to eliminate CVEs
# After all packages are installed, we don't need microdnf/rpm at runtime
# This removes: microdnf, rpm, curl, libcurl, brotli (CVE-2025-6176)
# We use rpm -e instead of microdnf to avoid dependency on microdnf itself
RUN rpm -e --nodeps microdnf rpm rpm-libs curl libcurl brotli gnupg2 2>/dev/null || \
    rpm -e --nodeps curl libcurl brotli 2>/dev/null || true && \
    rm -rf /var/cache/yum /var/lib/rpm

USER superset
