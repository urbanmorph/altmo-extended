<script lang="ts">
  import MetricCard from '$lib/components/MetricCard.svelte';
  import { formatCompact, formatINR, formatPercent } from '$lib/utils/format';
  import { getPM25Category, type CityPM25 } from '$lib/config/air-quality';
  import type { CongestionData } from '$lib/config/traffic-flow';
  import type { SafetyDataPoint } from '$lib/server/safety-data';
  import type { GlobalStats } from '$lib/server/altmo-core';
  import { CITIES } from '$lib/config/cities';

  interface Props {
    data: {
      stats: GlobalStats | null;
      pm25: Record<string, CityPM25 | null>;
      safety: Record<string, SafetyDataPoint>;
      congestion: Record<string, CongestionData | null>;
    };
  }

  let { data }: Props = $props();

  const co2 = $derived(data.stats ? formatCompact(data.stats.co2Offset) + ' kg' : '—');
  const fuel = $derived(data.stats ? formatCompact(data.stats.fuelSaved) + ' litres' : '—');
  const money = $derived(data.stats ? formatINR(data.stats.moneySaved) : '—');
  const distance = $derived(data.stats ? formatCompact(data.stats.distanceKm) + ' km' : '—');

  function cityName(id: string): string {
    return CITIES.find((c) => c.id === id)?.name ?? id;
  }

  // Air quality rows sorted worst-first
  const pm25Rows = $derived(
    CITIES.map((c) => ({ id: c.id, name: c.name, data: data.pm25?.[c.id] ?? null }))
      .sort((a, b) => {
        if (!a.data && !b.data) return 0;
        if (!a.data) return 1;
        if (!b.data) return -1;
        return b.data.pm25Avg - a.data.pm25Avg;
      })
  );

  // Safety rows sorted worst-first
  const safetyRows = $derived(
    Object.entries(data.safety ?? {})
      .map(([id, d]) => ({ id, name: cityName(id), ...d }))
      .sort((a, b) => b.fatalitiesPerLakh - a.fatalitiesPerLakh)
  );

  // Congestion rows sorted worst-first
  const congestionRows = $derived(
    CITIES.map((c) => ({ id: c.id, name: c.name, data: data.congestion?.[c.id] ?? null }))
      .filter((r) => r.data !== null)
      .sort((a, b) => (b.data?.congestionPct ?? 0) - (a.data?.congestionPct ?? 0))
  );

  function congestionColor(pct: number): string {
    if (pct > 50) return '#dc2626';
    if (pct > 30) return '#FF7B27';
    if (pct > 15) return '#eab308';
    return '#16a34a';
  }
</script>

<svelte:head>
  <title>Impact — Altmo Intelligence</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <h1 class="text-2xl font-bold text-text-primary">Environmental Impact</h1>
  <p class="mt-1 text-text-secondary">City-level air quality, road safety, and congestion data alongside platform impact metrics.</p>

  <!-- Section 1: Platform Impact -->
  <div class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
    <MetricCard label="CO2 Offset" value={co2} icon="fa-solid fa-earth-americas" />
    <MetricCard label="Fuel Saved" value={fuel} icon="fa-solid fa-gas-pump" />
    <MetricCard label="Money Saved" value={money} icon="fa-solid fa-indian-rupee-sign" />
    <MetricCard label="Distance Tracked" value={distance} icon="fa-solid fa-route" />
  </div>

  <!-- Section 2: Air Quality -->
  <div class="mt-10">
    <h2 class="text-lg font-semibold text-text-primary">
      <i class="fa-solid fa-wind mr-2 text-text-secondary"></i>Air Quality
    </h2>
    <p class="mt-1 text-sm text-text-secondary">
      Real-time PM2.5 from CPCB monitoring stations via OpenAQ. Sorted worst-first.
    </p>
    <div class="mt-4 overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
            <th class="pb-3 pr-4 font-medium">City</th>
            <th class="pb-3 pr-4 font-medium">PM2.5 Avg</th>
            <th class="pb-3 pr-4 font-medium">PM2.5 Max</th>
            <th class="pb-3 pr-4 font-medium">Stations</th>
            <th class="pb-3 font-medium">AQI Category</th>
          </tr>
        </thead>
        <tbody>
          {#each pm25Rows as row}
            <tr class="border-b border-border/50">
              <td class="py-3 pr-4 font-medium text-text-primary">{row.name}</td>
              {#if row.data}
                {@const cat = getPM25Category(row.data.pm25Avg)}
                <td class="py-3 pr-4 text-text-primary">{row.data.pm25Avg.toFixed(1)} &#181;g/m&#179;</td>
                <td class="py-3 pr-4 text-text-secondary">{row.data.pm25Max.toFixed(1)}</td>
                <td class="py-3 pr-4 text-text-secondary">{row.data.stationsReporting}</td>
                <td class="py-3">
                  <span class="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium" style="background-color: {cat.color}20; color: {cat.color}">
                    {cat.label}
                  </span>
                </td>
              {:else}
                <td class="py-3 pr-4 text-text-secondary" colspan="4">No sensor data</td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="mt-2 text-xs text-text-secondary">
      WHO guideline: 5 &#181;g/m&#179; annual mean. India NAAQS: 40 &#181;g/m&#179; annual mean.
    </p>
  </div>

  <!-- Section 3: Road Safety -->
  <div class="mt-10">
    <h2 class="text-lg font-semibold text-text-primary">
      <i class="fa-solid fa-shield-halved mr-2 text-text-secondary"></i>Road Safety
    </h2>
    <p class="mt-1 text-sm text-text-secondary">
      Traffic fatality rates from NCRB / MoRTH records. Sorted worst-first.
    </p>
    {#if safetyRows.length > 0}
      <div class="mt-4 overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
              <th class="pb-3 pr-4 font-medium">City</th>
              <th class="pb-3 pr-4 font-medium">Fatalities / Lakh</th>
              <th class="pb-3 pr-4 font-medium">VRU Share</th>
              <th class="pb-3 font-medium">Year</th>
            </tr>
          </thead>
          <tbody>
            {#each safetyRows as row}
              <tr class="border-b border-border/50">
                <td class="py-3 pr-4 font-medium text-text-primary">{row.name}</td>
                <td class="py-3 pr-4 text-text-primary">{row.fatalitiesPerLakh.toFixed(1)}</td>
                <td class="py-3 pr-4 text-text-secondary">
                  {row.vruFatalityShare !== null ? formatPercent(row.vruFatalityShare) : '—'}
                </td>
                <td class="py-3 text-text-secondary">{row.year}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="mt-4 text-sm text-text-secondary">Safety data unavailable.</p>
    {/if}
  </div>

  <!-- Section 4: Traffic Congestion -->
  <div class="mt-10">
    <h2 class="text-lg font-semibold text-text-primary">
      <i class="fa-solid fa-traffic-light mr-2 text-text-secondary"></i>Traffic Congestion
    </h2>
    <p class="mt-1 text-sm text-text-secondary">
      Real-time congestion from TomTom Traffic Flow API. Sorted worst-first.
    </p>
    {#if congestionRows.length > 0}
      <div class="mt-4 overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
              <th class="pb-3 pr-4 font-medium">City</th>
              <th class="pb-3 pr-4 font-medium">Congestion</th>
              <th class="pb-3 pr-4 font-medium">Avg Speed</th>
              <th class="pb-3 pr-4 font-medium">Free-flow Speed</th>
              <th class="pb-3 font-medium">Sample Points</th>
            </tr>
          </thead>
          <tbody>
            {#each congestionRows as row}
              <tr class="border-b border-border/50">
                <td class="py-3 pr-4 font-medium text-text-primary">{row.name}</td>
                <td class="py-3 pr-4">
                  <span class="font-medium" style="color: {congestionColor(row.data?.congestionPct ?? 0)}">
                    {formatPercent(row.data?.congestionPct ?? 0, 0)}
                  </span>
                </td>
                <td class="py-3 pr-4 text-text-secondary">{row.data?.avgCurrentSpeed.toFixed(0)} km/h</td>
                <td class="py-3 pr-4 text-text-secondary">{row.data?.avgFreeFlowSpeed.toFixed(0)} km/h</td>
                <td class="py-3 text-text-secondary">{row.data?.pointsReporting}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="mt-4 text-sm text-text-secondary">Congestion data unavailable. Ensure the TomTom API key is configured.</p>
    {/if}
  </div>
</div>
