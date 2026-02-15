-- Migration 003: Geocode cache for Nominatim results
-- Stores reverse geocoding results to avoid repeated Nominatim calls.
-- Run this in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.geocode_cache (
  coord_key text PRIMARY KEY,         -- "12.97,77.59" (rounded to 2 decimal places)
  name text NOT NULL,                 -- Suburb/neighbourhood name from Nominatim
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on geocode_cache"
  ON public.geocode_cache FOR SELECT USING (true);

CREATE POLICY "Allow service role full access on geocode_cache"
  ON public.geocode_cache FOR ALL USING (true) WITH CHECK (true);
