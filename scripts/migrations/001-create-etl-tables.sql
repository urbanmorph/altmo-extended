-- ETL tables for syncing data from Altmo Core Rails API (rails-web-app)
-- Run against Supabase project: zztiiovryhdsdzmhkcjk
--
-- Usage:
--   Copy and paste into Supabase Dashboard → SQL Editor → New Query → Run
--   Or use: psql $DATABASE_URL -f scripts/migrations/001-create-etl-tables.sql

-- Activity routes from /api/v1/routes/bulk (IntelligenceController)
CREATE TABLE IF NOT EXISTS public.activity_routes (
  activity_id bigint PRIMARY KEY,
  activity_type text,
  start_date timestamptz,
  distance numeric,
  moving_time integer,
  start_lat numeric,
  start_lng numeric,
  end_lat numeric,
  end_lng numeric,
  direction text,
  facility_id integer,
  company_id integer,
  city_id integer,
  path jsonb,
  synced_at timestamptz DEFAULT now()
);

-- Leaderboard snapshot from /api/v1/leaderboard (BaseController)
CREATE TABLE IF NOT EXISTS public.leaderboards (
  company_name text PRIMARY KEY,
  rank integer,
  percentage numeric,
  riders integer,
  rides integer,
  carbon_credits integer,
  city_id integer,
  synced_at timestamptz DEFAULT now()
);

-- Daily global stats from /api/v1/stats/global (StatsController)
CREATE TABLE IF NOT EXISTS public.daily_stats (
  date date PRIMARY KEY,
  facilities integer,
  riders integer,
  rides integer,
  distance numeric,
  co2_saved numeric,
  petrol_saved numeric,
  synced_at timestamptz DEFAULT now()
);

-- Company groups from /api/v1/companies (BaseController)
CREATE TABLE IF NOT EXISTS public.companies (
  id integer PRIMARY KEY,
  name text,
  activities integer,
  distance numeric,
  emp_count integer,
  facilities jsonb,
  synced_at timestamptz DEFAULT now()
);

-- Facilities from /api/v1/facilities (BaseController)
CREATE TABLE IF NOT EXISTS public.facilities (
  id integer PRIMARY KEY,
  name text,
  approved boolean,
  activities integer,
  distance numeric,
  emp_count integer,
  city text,
  city_id integer,
  latlngs jsonb,
  synced_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activity_routes_city ON public.activity_routes (city_id);
CREATE INDEX IF NOT EXISTS idx_activity_routes_start_date ON public.activity_routes (start_date);
CREATE INDEX IF NOT EXISTS idx_facilities_city ON public.facilities (city_id);
CREATE INDEX IF NOT EXISTS idx_leaderboards_city ON public.leaderboards (city_id);

-- Enable RLS (service role bypasses, anon can read)
ALTER TABLE public.activity_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON public.activity_routes FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.leaderboards FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.daily_stats FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Public read" ON public.facilities FOR SELECT USING (true);
