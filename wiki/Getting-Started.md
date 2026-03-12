# Getting Started

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- [Git](https://git-scm.com/)
- A [Mapbox access token](https://www.mapbox.com/) (free tier is sufficient)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/raft-tech/GeoSet.git
cd GeoSet
```

### 2. Configure the Environment

```bash
cp docker/.env.example docker/.env
```

Open `docker/.env` and set your Mapbox token:

```env
MAPBOX_API_KEY=your_mapbox_token_here
```

### 3. Start the Application

```bash
docker compose up -d
```

On first run, the `superset-init` container automatically:
- Runs database migrations
- Creates an admin user (`admin` / `admin`)
- Sets up default roles and permissions

Once all containers are healthy, open **http://localhost:9001** in your browser and log in with `admin` / `admin`.

## Services

GeoSet runs in light mode (no Redis or Celery). The stack includes:

| Service | Port | Description |
|---|---|---|
| superset-node | 9001 | Webpack frontend dev server (main entry point) |
| superset | 8088 | Flask backend API (internal) |
| db | — | PostgreSQL (Superset metadata, internal only) |
| postgis | 5433 | PostGIS (geospatial data) |
| superset-init | — | One-shot: runs migrations, creates admin user |
| sample-data-ingest | — | One-shot: loads demo datasets into PostGIS |

## Common Commands

```bash
# Start all services (detached)
docker compose up -d

# Rebuild after Dockerfile changes
docker compose up --build

# View logs for a specific service
docker compose logs -f superset

# Restart the frontend dev server
docker compose restart superset-node

# Stop all services
docker compose down

# Stop and remove all data (full reset)
docker compose down -v
```

## Next Steps

- Load the [[Sample Data and Demo Dashboards]] to see GeoSet in action
- Create your first map chart: [[GeoSet Map Layer Chart]]
- Combine multiple layers: [[GeoSet Multi Map Chart]]
