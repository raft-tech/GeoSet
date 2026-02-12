CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS census_state_boundaries (
    id SERIAL PRIMARY KEY,
    state_code VARCHAR(2) NOT NULL,
    state_gnis_code VARCHAR(8),
    state_abbrev VARCHAR(2) NOT NULL,
    full_geoid VARCHAR(14),
    geoid VARCHAR(2),
    legal_statistical_code VARCHAR(2),
    land_area BIGINT,
    water_area BIGINT,
    state_name VARCHAR(100) NOT NULL,
    state_boundary GEOGRAPHY(MULTIPOLYGON, 4326)
);
