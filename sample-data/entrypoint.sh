#!/bin/bash
set -e

echo "=== Running sample data ingest scripts ==="

echo "--- Census State Boundaries ---"
python census_state_boundaries.py

echo "--- NIFC Wildfire Locations ---"
python nifc_wildfire_locations.py

echo "--- NHC Best Track ---"
python nhc_best_track.py

echo "=== All ingest scripts completed ==="
