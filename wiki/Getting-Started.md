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

Once all containers are healthy, open **http://localhost** in your browser and log in with `admin` / `admin`.

## Services

| Base Service | Port | Description |
|---|---|---|
| nginx | 80 | Reverse proxy (main entry point) |
| superset | 8088 | Flask backend API |
| superset-node | 9000 | Webpack frontend dev server |
| superset-websocket | 8080 | WebSocket server |
| db | 5432 | PostgreSQL (Superset metadata) |
| redis | 6379 | Cache and Celery broker |


|GeoSet Service | Port | Description |
|---|---|---|
| nginx | 80 | Reverse proxy (main entry point) |
| superset | 8088 | Flask backend API |
| superset-node-geoset-1 | 9001 | Webpack frontend dev server (GeoSet) |
| superset-websocket | 8080 | WebSocket server |
| superset_postgis | 5433 | PostgreSQL (Geospatial data) |
| redis | 6379 | Cache and Celery broker |


## Common Commands

```bash
# Start all services (Base Superset)
docker compose up -d

# Start all services (GeoSet Stack)
docker compose -f docker-compose-geoset.yml up

# Rebuild after Dockerfile changes (GeoSet stack)
docker compose -f docker-compose-geoset.yml up --build

# View logs for a specific service
docker compose logs -f superset

# Restart the frontend dev server
docker compose restart superset-node

# Stop all services
docker compose down

# Stop and remove all data (full reset)
docker compose down -v

# Rebuild after Dockerfile changes
docker compose up -d --build
```

## Next Steps

- Load the [[Sample Data and Demo Dashboards]] to see GeoSet in action
- Create your first map chart: [[GeoSet Map Layer Chart]]
- Combine multiple layers: [[GeoSet Multi Map Chart]]
