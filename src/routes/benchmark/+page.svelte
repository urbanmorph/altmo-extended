<script lang="ts">
  import {
    computeAllQoL,
    QOL_DIMENSIONS,
    INDICATOR_BENCHMARKS,
    gradeColor,
    type QoLOverrides,
    type CityQoLScore,
    type ConfidenceTier
  } from '$lib/config/city-qol-data';
  import { computeAllScores, type ReadinessScore } from '$lib/config/data-readiness';
  import { CITIES } from '$lib/config/cities';
  import BenchmarkRadar from '$lib/components/BenchmarkRadar.svelte';
  import { cityName, fmtIndicatorValue } from '$lib/utils/qol-format';

  interface Props {
    data: {
      qolOverrides: QoLOverrides;
    };
  }

  let { data }: Props = $props();

  const allScores = $derived(computeAllQoL(data.qolOverrides));
  const readinessScores = $derived(computeAllScores());

  // City selection state — default to top 3 by score
  let selectedCityIds: string[] = $state([]);

  // Initialize defaults after scores are available
  $effect(() => {
    if (selectedCityIds.length === 0 && allScores.length > 0) {
      selectedCityIds = allScores.slice(0, 3).map((s) => s.cityId);
    }
  });

  // Derived: selected city score objects
  const selectedScores = $derived(
    selectedCityIds
      .map((id) => allScores.find((s) => s.cityId === id))
      .filter((s): s is CityQoLScore => s !== undefined)
  );

  // Derived: readiness for selected cities
  function getReadinessScore(cityId: string): ReadinessScore | undefined {
    return readinessScores.find((r) => r.cityId === cityId);
  }

  function toggleCity(cityId: string) {
    if (selectedCityIds.includes(cityId)) {
      if (selectedCityIds.length > 1) {
        selectedCityIds = selectedCityIds.filter((c) => c !== cityId);
      }
    } else if (selectedCityIds.length < 4) {
      selectedCityIds = [...selectedCityIds, cityId];
    }
  }

  function confidenceLabel(tier: ConfidenceTier): string {
    if (tier === 'gold') return 'Gold';
    if (tier === 'silver') return 'Silver';
    return 'Bronze';
  }

  function confidenceIcon(tier: ConfidenceTier): string {
    if (tier === 'gold') return 'fa-solid fa-certificate';
    if (tier === 'silver') return 'fa-solid fa-certificate';
    return 'fa-solid fa-circle-half-stroke';
  }

  function confidenceColor(tier: ConfidenceTier): string {
    if (tier === 'gold') return '#D4AF37';
    if (tier === 'silver') return '#9CA3AF';
    return '#CD7F32';
  }

  // Key indicators to show in the comparison table
  const KEY_INDICATORS = [
    { key: 'traffic_fatalities', label: 'Traffic Fatalities', unit: 'per lakh pop.', dimension: 'health' },
    { key: 'walking_share', label: 'Walking Share', unit: '% trips', dimension: 'health' },
    { key: 'cycling_share', label: 'Cycling Share', unit: '% trips', dimension: 'health' },
    { key: 'rail_transit_km', label: 'Rail Transit', unit: 'km', dimension: 'accessibility' },
    { key: 'transit_stop_density', label: 'Transit Stop Density', unit: 'stops/km2', dimension: 'accessibility' },
    { key: 'pm25_annual', label: 'PM2.5', unit: 'ug/m3', dimension: 'environmental' },
    { key: 'congestion_level', label: 'Congestion', unit: '% extra time', dimension: 'environmental' },
    { key: 'noise_pollution', label: 'Noise', unit: 'dB(A)', dimension: 'environmental' },
    { key: 'carbon_emission_intensity', label: 'CO2 Emissions', unit: 't CO2/cap/yr', dimension: 'environmental' },
    { key: 'fuel_consumption', label: 'Fuel Consumption', unit: 'L/cap/yr', dimension: 'environmental' },
    { key: 'green_cover', label: 'Green Cover', unit: 'm2/person', dimension: 'environmental' },
    { key: 'sustainable_mode_share', label: 'Sustainable Modes', unit: '% trips', dimension: 'mobility' }
  ];

  function getIndicatorValue(score: CityQoLScore, indicatorKey: string): number | null {
    for (const dim of score.dimensions) {
      const ind = dim.indicators.find((i) => i.key === indicatorKey);
      if (ind) return ind.value;
    }
    return null;
  }

  function getIndicatorNormalized(score: CityQoLScore, indicatorKey: string): number | null {
    for (const dim of score.dimensions) {
      const ind = dim.indicators.find((i) => i.key === indicatorKey);
      if (ind) return ind.normalized;
    }
    return null;
  }

  /** Highlight the best value among selected cities for an indicator */
  function isBestValue(indicatorKey: string, cityScore: CityQoLScore): boolean {
    const thisNorm = getIndicatorNormalized(cityScore, indicatorKey);
    if (thisNorm === null) return false;
    return selectedScores.every((s) => {
      const otherNorm = getIndicatorNormalized(s, indicatorKey);
      return otherNorm === null || thisNorm >= otherNorm;
    });
  }

  const CITY_COLORS = [
    { border: 'rgba(0, 132, 9, 0.9)', bg: 'rgba(0, 132, 9, 0.08)', text: '#008409' },
    { border: 'rgba(255, 123, 39, 0.9)', bg: 'rgba(255, 123, 39, 0.08)', text: '#FF7B27' },
    { border: 'rgba(37, 99, 235, 0.9)', bg: 'rgba(37, 99, 235, 0.08)', text: '#2563eb' },
    { border: 'rgba(147, 51, 234, 0.9)', bg: 'rgba(147, 51, 234, 0.08)', text: '#9333ea' }
  ];

  function cityColor(cityId: string): typeof CITY_COLORS[0] {
    const idx = selectedCityIds.indexOf(cityId);
    return CITY_COLORS[idx >= 0 ? idx % CITY_COLORS.length : 0];
  }
</script>

<svelte:head>
  <title>Compare Cities | Altmo Intelligence</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <!-- Header -->
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-text-primary">
      <i class="fa-solid fa-scale-balanced mr-2 text-primary"></i>
      Compare Cities
    </h1>
    <p class="mt-1 text-text-secondary">
      Select 2-4 cities to compare transport quality of life side by side
    </p>
  </div>

  <!-- City Selector Chips -->
  <div class="mb-6 rounded-xl border border-border bg-surface-card p-4">
    <div class="mb-2 flex items-center gap-2 text-sm text-text-secondary">
      <i class="fa-solid fa-city"></i>
      <span class="font-medium">Select cities to compare</span>
      <span class="ml-auto text-xs">{selectedCityIds.length}/4 selected</span>
    </div>
    <div class="flex flex-wrap gap-2">
      {#each CITIES as city (city.id)}
        {@const selected = selectedCityIds.includes(city.id)}
        {@const disabled = !selected && selectedCityIds.length >= 4}
        {@const color = selected ? cityColor(city.id) : null}
        <button
          onclick={() => toggleCity(city.id)}
          {disabled}
          class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all
            {selected
              ? 'text-white shadow-sm'
              : disabled
                ? 'border-border/50 bg-surface-card text-text-secondary/40 cursor-not-allowed'
                : 'border-border bg-surface-card text-text-secondary hover:border-primary/50 hover:text-text-primary'}"
          style={selected && color ? `background-color: ${color.border}; border-color: ${color.border}` : ''}
        >
          {#if selected}
            <i class="fa-solid fa-check text-[0.6rem]"></i>
          {/if}
          {city.name}
        </button>
      {/each}
    </div>
  </div>

  {#if selectedScores.length < 2}
    <div class="rounded-xl border border-border bg-surface-card p-12 text-center">
      <i class="fa-solid fa-arrow-up-long mb-3 text-3xl text-text-secondary/40"></i>
      <p class="text-text-secondary">Select at least 2 cities above to begin comparison</p>
    </div>
  {:else}
    <!-- Score Overview Cards -->
    <div class="mb-6 grid gap-4" style="grid-template-columns: repeat({selectedScores.length}, minmax(0, 1fr));">
      {#each selectedScores as score, i (score.cityId)}
        {@const color = CITY_COLORS[i % CITY_COLORS.length]}
        {@const readiness = getReadinessScore(score.cityId)}
        <div
          class="rounded-xl border-2 bg-surface-card p-4"
          style="border-color: {color.border}"
        >
          <!-- City name + grade badge -->
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-base font-bold text-text-primary">{cityName(score.cityId)}</h3>
            <span
              class="inline-flex rounded-full px-2.5 py-0.5 text-sm font-bold text-white"
              style="background-color: {gradeColor(score.grade)}"
            >
              {score.grade}
            </span>
          </div>

          <!-- Composite score -->
          <div class="mb-3">
            <div class="mb-1 flex items-end justify-between">
              <span class="text-xs font-medium uppercase tracking-wide text-text-secondary">ETQOLI Score</span>
              <span class="text-2xl font-bold tabular-nums" style="color: {color.text}">
                {Math.round(score.composite * 100)}
              </span>
            </div>
            <div class="h-2 w-full rounded-full bg-earth-100">
              <div
                class="h-2 rounded-full transition-all"
                style="width: {Math.round(score.composite * 100)}%; background-color: {color.border}"
              ></div>
            </div>
          </div>

          <!-- Dimension scores -->
          <div class="space-y-1.5">
            {#each score.dimensions as dim (dim.key)}
              <div class="flex items-center gap-2 text-xs">
                <span class="w-20 truncate text-text-secondary">{dim.label}</span>
                <div class="h-1.5 flex-1 rounded-full bg-earth-100">
                  <div
                    class="h-1.5 rounded-full"
                    style="width: {Math.round(dim.score * 100)}%; background-color: {color.border}"
                  ></div>
                </div>
                <span class="w-7 text-right font-medium tabular-nums text-text-primary">{Math.round(dim.score * 100)}</span>
              </div>
            {/each}
          </div>

          <!-- Confidence + Readiness -->
          <div class="mt-3 flex items-center justify-between border-t border-border/50 pt-2">
            <div class="flex items-center gap-1 text-xs text-text-secondary">
              <i
                class="{confidenceIcon(score.confidence)}"
                style="color: {confidenceColor(score.confidence)}"
              ></i>
              <span>{confidenceLabel(score.confidence)}</span>
            </div>
            {#if readiness}
              <div class="text-xs text-text-secondary">
                <i class="fa-solid fa-database mr-0.5"></i>
                Data: {Math.round(readiness.total)}/{readiness.maxScore}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <!-- Radar Chart + Dimension Comparison -->
    <div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- Radar Chart -->
      <div class="rounded-xl border border-border bg-surface-card p-5">
        <h2 class="mb-1 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          <i class="fa-solid fa-chart-pie mr-1.5"></i>
          Dimension Radar
        </h2>
        <p class="mb-3 text-xs text-text-secondary">
          4 axes represent QoL dimensions. Larger area = better overall score.
        </p>
        <BenchmarkRadar scores={allScores} selectedCities={selectedCityIds} />
      </div>

      <!-- Dimension Comparison Table -->
      <div class="rounded-xl border border-border bg-surface-card p-5">
        <h2 class="mb-1 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          <i class="fa-solid fa-layer-group mr-1.5"></i>
          Dimension Scores
        </h2>
        <p class="mb-3 text-xs text-text-secondary">
          Weighted dimension scores (0-100) contributing to composite ETQOLI.
        </p>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                <th class="pb-2 pr-3">Dimension</th>
                <th class="pb-2 pr-2 text-right text-[0.6rem]">Weight</th>
                {#each selectedScores as score, i (score.cityId)}
                  <th class="pb-2 pr-3 text-right" style="color: {CITY_COLORS[i % CITY_COLORS.length].text}">
                    {cityName(score.cityId)}
                  </th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each QOL_DIMENSIONS as dim (dim.key)}
                <tr class="border-b border-border/50">
                  <td class="py-2.5 pr-3 font-medium text-text-primary">{dim.label}</td>
                  <td class="py-2.5 pr-2 text-right text-xs text-text-secondary">{Math.round(dim.weight * 100)}%</td>
                  {#each selectedScores as score, i (score.cityId)}
                    {@const dimScore = score.dimensions.find((d) => d.key === dim.key)}
                    <td class="py-2.5 pr-3 text-right">
                      {#if dimScore}
                        {@const val = Math.round(dimScore.score * 100)}
                        {@const isBest = selectedScores.every((s) => {
                          const other = s.dimensions.find((d) => d.key === dim.key);
                          return !other || dimScore.score >= other.score;
                        })}
                        <span
                          class="tabular-nums {isBest ? 'font-bold' : 'font-medium'}"
                          style="color: {isBest ? CITY_COLORS[i % CITY_COLORS.length].text : 'var(--color-text-primary)'}"
                        >
                          {val}
                        </span>
                      {:else}
                        <span class="text-text-secondary">--</span>
                      {/if}
                    </td>
                  {/each}
                </tr>
              {/each}
              <!-- Composite row -->
              <tr class="border-t-2 border-border bg-surface-hover/50">
                <td class="py-2.5 pr-3 font-bold text-text-primary">Composite</td>
                <td class="py-2.5 pr-2 text-right text-xs text-text-secondary">100%</td>
                {#each selectedScores as score, i (score.cityId)}
                  <td class="py-2.5 pr-3 text-right">
                    <span class="font-bold tabular-nums" style="color: {CITY_COLORS[i % CITY_COLORS.length].text}">
                      {Math.round(score.composite * 100)}
                    </span>
                    <span
                      class="ml-1 inline-flex rounded-full px-1.5 py-0 text-[0.6rem] font-bold text-white"
                      style="background-color: {gradeColor(score.grade)}"
                    >
                      {score.grade}
                    </span>
                  </td>
                {/each}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Key Indicators Comparison -->
    <div class="mb-6 rounded-xl border border-border bg-surface-card p-5">
      <h2 class="mb-1 text-sm font-semibold uppercase tracking-wide text-text-secondary">
        <i class="fa-solid fa-magnifying-glass-chart mr-1.5"></i>
        Key Indicators
      </h2>
      <p class="mb-3 text-xs text-text-secondary">
        Raw indicator values across selected cities. Best value in each row is highlighted.
      </p>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
              <th class="pb-2 pr-3">Indicator</th>
              <th class="pb-2 pr-3 text-[0.6rem]">Unit</th>
              <th class="pb-2 pr-3 text-right text-[0.6rem]">Target</th>
              {#each selectedScores as score, i (score.cityId)}
                <th class="pb-2 pr-3 text-right" style="color: {CITY_COLORS[i % CITY_COLORS.length].text}">
                  {cityName(score.cityId)}
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each KEY_INDICATORS as ind (ind.key)}
              {@const bench = INDICATOR_BENCHMARKS[ind.key]}
              <tr class="border-b border-border/50">
                <td class="py-2.5 pr-3 font-medium text-text-primary">{ind.label}</td>
                <td class="py-2.5 pr-3 text-xs text-text-secondary">{ind.unit}</td>
                <td class="py-2.5 pr-3 text-right text-xs font-medium text-primary">
                  {bench ? bench.target : '--'}
                </td>
                {#each selectedScores as score, i (score.cityId)}
                  {@const value = getIndicatorValue(score, ind.key)}
                  {@const best = isBestValue(ind.key, score)}
                  <td class="py-2.5 pr-3 text-right">
                    {#if value !== null}
                      <span
                        class="tabular-nums {best ? 'font-bold' : ''}"
                        style={best ? `color: ${CITY_COLORS[i % CITY_COLORS.length].text}` : ''}
                      >
                        {Number.isInteger(value) ? value : value.toFixed(1)}
                      </span>
                    {:else}
                      <span class="text-text-secondary">--</span>
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Data Readiness Comparison -->
    <div class="rounded-xl border border-border bg-surface-card p-5">
      <h2 class="mb-1 text-sm font-semibold uppercase tracking-wide text-text-secondary">
        <i class="fa-solid fa-database mr-1.5"></i>
        Data Readiness
      </h2>
      <p class="mb-3 text-xs text-text-secondary">
        How much open data each city makes available for analysis.
      </p>
      <div class="grid gap-4" style="grid-template-columns: repeat({selectedScores.length}, minmax(0, 1fr));">
        {#each selectedScores as score, i (score.cityId)}
          {@const readiness = getReadinessScore(score.cityId)}
          {@const color = CITY_COLORS[i % CITY_COLORS.length]}
          <div>
            <h3 class="mb-2 text-sm font-bold" style="color: {color.text}">{cityName(score.cityId)}</h3>
            {#if readiness}
              <div class="mb-2 flex items-end justify-between">
                <span class="text-2xl font-bold tabular-nums text-text-primary">{Math.round(readiness.total)}</span>
                <span class="text-xs text-text-secondary">/ {readiness.maxScore}</span>
              </div>
              <div class="h-2 w-full rounded-full bg-earth-100">
                <div
                  class="h-2 rounded-full"
                  style="width: {Math.round((readiness.total / readiness.maxScore) * 100)}%; background-color: {color.border}"
                ></div>
              </div>
              <div class="mt-2 space-y-1">
                {#each readiness.categories as cat (cat.key)}
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-text-secondary">{cat.label}</span>
                    <span class="font-medium tabular-nums text-text-primary">{Math.round(cat.score)}/{cat.max}</span>
                  </div>
                {/each}
              </div>
            {:else}
              <span class="text-xs text-text-secondary">No data</span>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
