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
    state_boundary TEXT
);

CREATE TABLE IF NOT EXISTS nifc_wildfire_locations (
    id SERIAL PRIMARY KEY,
    fire_id INTEGER,
    irwin_id TEXT,
    incident_size DOUBLE PRECISION,
    containment_time TIMESTAMPTZ,
    percent_contained DOUBLE PRECISION,
    control_time TIMESTAMPTZ,
    incident_description TEXT,
    discovery_acres DOUBLE PRECISION,
    final_acres DOUBLE PRECISION,
    fire_cause TEXT,
    origin_coordinate TEXT,
    dispatch_center_id TEXT,
    fire_discovery_time TIMESTAMPTZ,
    nifc_created_time TIMESTAMPTZ,
    nifc_modified_time TIMESTAMPTZ,
    estimated_cost_to_date DOUBLE PRECISION,
    incident_name TEXT,
    origin_fips_code CHAR(5),
    origin_city_name TEXT,
    origin_state_code CHAR(5),
    origin_county_name TEXT,
    landowner_type TEXT,
    is_multijurisdictional BOOLEAN
);

CREATE TABLE IF NOT EXISTS nhc_advisory_forecast_track (
    id SERIAL PRIMARY KEY,
    effective_timestamp TIMESTAMPTZ NOT NULL,
    wind_speed_mph INTEGER,
    max_gust_mph INTEGER,
    storm_name TEXT NOT NULL,
    nhc_identifier TEXT,
    increment TEXT NOT NULL,
    year INTEGER NOT NULL,
    forecast_point TEXT
);

CREATE INDEX IF NOT EXISTS idx_nhc_identifier ON nhc_advisory_forecast_track (nhc_identifier);
CREATE INDEX IF NOT EXISTS idx_nhc_year ON nhc_advisory_forecast_track (year);
