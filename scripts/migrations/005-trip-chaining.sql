-- Migration 005: Add trip_chaining JSONB column to city_activity_monthly
-- Stores per-month user-level trip chaining data computed by sync-routes ETL
-- Prerequisite: user_id now available in /routes/bulk API (PR #59, 2026-02-16)
--
-- Usage:
--   Copy and paste into Supabase Dashboard > SQL Editor > New Query > Run

ALTER TABLE city_activity_monthly
ADD COLUMN IF NOT EXISTS trip_chaining jsonb DEFAULT '{}';

COMMENT ON COLUMN city_activity_monthly.trip_chaining IS
'User-level trip chaining data: multimodal journey inference (user ends near station X, starts near station Y within transit time), repeated commute patterns (same user/station/time on weekdays), and weekday vs weekend differentiation. Computed by sync-routes ETL.';
