#!/usr/bin/env bash
#
# GeoSet-specific init script. Runs the standard Superset init,
# then registers the PostGIS connection and loads GeoSet example configs.
#
set -e

# Run the standard Superset init (migrations, admin user, roles, examples)
/app/docker/docker-init.sh

echo "######################################################################"
echo "GeoSet — Registering PostGIS database connection"
echo "######################################################################"
superset set-database-uri -d geoset -u postgresql://geoset:geoset@postgis:5432/geoset

echo "######################################################################"
echo "GeoSet — Loading GeoSet example configs"
echo "######################################################################"
superset load-geoset-examples
