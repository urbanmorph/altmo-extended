-- Air quality daily aggregates from OpenAQ
-- Phase 2a: PM2.5 monitoring data per city per day
create table air_quality_daily (
  id bigint generated always as identity primary key,
  city_id text not null,
  date date not null,
  pm25_avg numeric,
  pm25_max numeric,
  pm10_avg numeric,
  stations_reporting integer,
  source text default 'openaq',
  created_at timestamptz default now(),
  unique(city_id, date)
);
create index idx_aq_city_date on air_quality_daily(city_id, date desc);
