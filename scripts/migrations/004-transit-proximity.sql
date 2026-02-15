-- Migration 004: Add transit_proximity JSONB column to city_activity_monthly
-- Stores per-month first/last mile transit connection data computed by sync-routes ETL

ALTER TABLE city_activity_monthly
ADD COLUMN IF NOT EXISTS transit_proximity jsonb DEFAULT '{}';

COMMENT ON COLUMN city_activity_monthly.transit_proximity IS
'First/last mile transit proximity data: connected count, first/last mile splits, top stations, mode/type breakdowns. Computed by sync-routes ETL using weighted proximity scoring.';
