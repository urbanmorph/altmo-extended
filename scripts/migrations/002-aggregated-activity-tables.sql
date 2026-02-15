-- Migration 002: Replace raw activity_routes with pre-computed analytics tables
-- Run against Supabase project: zztiiovryhdsdzmhkcjk
--
-- This migration:
--   1. Creates route_density (H3 hex activity counts for heatmap)
--   2. Creates city_activity_monthly (pre-computed city summaries for charts)
--   3. Drops activity_routes (raw data stays in Altmo Core as system of record)
--
-- Usage:
--   Copy and paste into Supabase Dashboard > SQL Editor > New Query > Run

-- ── route_density: H3 hex cell activity counts (for map heatmap) ──
CREATE TABLE IF NOT EXISTS public.route_density (
  h3_index text NOT NULL,
  city_id integer NOT NULL,
  total integer DEFAULT 0,
  rides integer DEFAULT 0,
  walks integer DEFAULT 0,
  PRIMARY KEY (h3_index, city_id)
);

CREATE INDEX IF NOT EXISTS idx_route_density_city ON public.route_density (city_id);

-- ── city_activity_monthly: pre-computed city summaries (for charts/metrics) ──
CREATE TABLE IF NOT EXISTS public.city_activity_monthly (
  city_id integer NOT NULL,
  month date NOT NULL,
  -- Counts
  total_trips integer DEFAULT 0,
  rides integer DEFAULT 0,
  walks integer DEFAULT 0,
  runs integer DEFAULT 0,
  -- Direction
  to_work integer DEFAULT 0,
  from_work integer DEFAULT 0,
  leisure integer DEFAULT 0,
  -- Cross-tabulated mode x direction
  commute_rides integer DEFAULT 0,
  commute_walks integer DEFAULT 0,
  commute_runs integer DEFAULT 0,
  leisure_rides integer DEFAULT 0,
  leisure_walks integer DEFAULT 0,
  leisure_runs integer DEFAULT 0,
  -- Distance
  total_distance_m numeric DEFAULT 0,
  avg_distance_m numeric DEFAULT 0,
  -- JSONB distributions
  hourly_distribution jsonb,
  hourly_commute jsonb,
  hourly_leisure jsonb,
  weekday_distribution jsonb,
  weekday_leisure jsonb,
  distance_buckets jsonb,
  top_corridors jsonb,
  top_corridors_commute jsonb,
  top_corridors_leisure jsonb,
  synced_at timestamptz DEFAULT now(),
  PRIMARY KEY (city_id, month)
);

-- ── RLS ──
ALTER TABLE public.route_density ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_activity_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON public.route_density FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.city_activity_monthly FOR SELECT USING (true);

-- ── Drop old raw routes table ──
-- activity_routes duplicated Altmo Core as system of record; analytics are now pre-computed
DROP TABLE IF EXISTS public.activity_routes;
