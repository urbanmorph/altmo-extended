<script lang="ts">
  import { selectedCity } from '$lib/stores/city';
  import { CITIES } from '$lib/config/cities';
  import { gradeColor } from '$lib/config/city-qol-data';
  import type { QoLOverrides } from '$lib/config/city-qol-data';
  import {
    computeScenarioResult,
    getDefaultInterventions,
    resolvePresetForCity,
    getCityRailKm,
    type InterventionValues,
    type ScenarioPreset,
    type ScenarioResult
  } from '$lib/config/scenarios';
  import ScenarioSliders from '$lib/components/ScenarioSliders.svelte';
  import ScenarioRadarChart from '$lib/components/ScenarioRadarChart.svelte';
  import ScenarioPresets from '$lib/components/ScenarioPresets.svelte';

  interface Props {
    data: {
      qolOverrides: QoLOverrides;
      cityId: string;
    };
  }

  let { data }: Props = $props();

  // Sync city from server data
  $effect(() => {
    const city = CITIES.find((c) => c.id === data.cityId);
    if (city) {
      selectedCity.set({ id: city.id, name: city.name, lat: city.lat, lng: city.lng, zoom: city.zoom });
    }
  });

  let cityId = $derived($selectedCity?.id ?? data.cityId);
  let cityName = $derived($selectedCity?.name ?? 'Bengaluru');
  let isBengaluru = $derived(cityId === 'bengaluru');
  let showGuide = $state(false);

  let interventions: InterventionValues = $state(getDefaultInterventions(data.cityId, data.qolOverrides));
  let activePresetKey: string | null = $state(null);

  // Re-initialize when city changes
  $effect(() => {
    const id = cityId;
    interventions = getDefaultInterventions(id, data.qolOverrides);
    activePresetKey = null;
  });

  const result: ScenarioResult | null = $derived(
    computeScenarioResult(cityId, interventions, data.qolOverrides)
  );

  function handlePresetSelect(preset: ScenarioPreset) {
    if (preset.key === 'reset') {
      interventions = getDefaultInterventions(cityId, data.qolOverrides);
      activePresetKey = 'reset';
    } else {
      interventions = resolvePresetForCity(preset, cityId, data.qolOverrides);
      activePresetKey = preset.key;
    }
  }

  function handleSliderChange() {
    activePresetKey = null;
  }

  function formatIndicatorValue(value: number | null, unit: string): string {
    if (value === null) return '--';
    if (unit === '% trips' || unit === '% extra time') return `${value.toFixed(1)}%`;
    if (unit === 'per lakh pop.') return value.toFixed(1);
    if (unit === 'µg/m³') return value.toFixed(1);
    if (unit === 'km') return value.toFixed(1);
    if (unit === 'km/km²') return value.toFixed(1);
    return value.toFixed(1);
  }

  function formatDelta(delta: number | null, unit: string): string {
    if (delta === null) return '--';
    const sign = delta >= 0 ? '+' : '';
    if (unit === '% trips' || unit === '% extra time') return `${sign}${delta.toFixed(1)} pp`;
    if (unit === 'µg/m³') return `${sign}${delta.toFixed(1)}`;
    if (unit === 'km') return `${sign}${delta.toFixed(1)}`;
    return `${sign}${delta.toFixed(1)}`;
  }
</script>

<svelte:head>
  <title>Scenario Comparison — Altmo Intelligence</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <!-- Header -->
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-text-primary">Scenario Comparison Tool</h1>
    <p class="mt-1 text-text-secondary">
      What-if modelling for transport QoL interventions
    </p>
  </div>

  <!-- How to use guide -->
  <div class="mb-6 rounded-xl border border-border bg-surface-card">
    <button
      onclick={() => showGuide = !showGuide}
      class="flex w-full items-center justify-between px-5 py-3 text-left"
    >
      <div class="flex items-center gap-2">
        <i class="fa-solid fa-circle-info text-sm text-primary"></i>
        <span class="text-sm font-semibold text-text-primary">How to use this tool</span>
      </div>
      <i class="fa-solid fa-chevron-{showGuide ? 'up' : 'down'} text-xs text-text-secondary"></i>
    </button>
    {#if showGuide}
      <div class="border-t border-border px-5 pb-5 pt-4">
        <div class="grid grid-cols-1 gap-4 text-sm text-text-secondary sm:grid-cols-2">
          <div>
            <h3 class="mb-1 font-semibold text-text-primary">
              <i class="fa-solid fa-bullseye mr-1.5 text-xs text-primary"></i>What it does
            </h3>
            <p>
              Model the impact of transport infrastructure investments on your city's quality of life score.
              Adjust interventions using sliders or select a preset strategy, and see how the ETQOLI score
              changes in real time.
            </p>
          </div>
          <div>
            <h3 class="mb-1 font-semibold text-text-primary">
              <i class="fa-solid fa-sliders mr-1.5 text-xs text-primary"></i>Interventions
            </h3>
            <p>
              Five levers you can adjust: metro network expansion (km), bus fleet scaling (multiplier),
              cycle lane construction (km), public transport electrification (%), and grid renewable
              energy share (%). Each lever affects one or more ETQOLI indicators.
            </p>
          </div>
          <div>
            <h3 class="mb-1 font-semibold text-text-primary">
              <i class="fa-solid fa-bookmark mr-1.5 text-xs text-primary"></i>Preset Scenarios
            </h3>
            <p>
              ST1A-D are metro-led strategies (expanding rapid transit, then adding electrification).
              ST2A-D are bus + non-motorised transport strategies (fleet scaling, cycle lanes, then
              electrification). Based on IISc Bangalore research.
            </p>
          </div>
          <div>
            <h3 class="mb-1 font-semibold text-text-primary">
              <i class="fa-solid fa-chart-line mr-1.5 text-xs text-primary"></i>Reading the results
            </h3>
            <p>
              The score cards show current vs projected ETQOLI score (0-100) and grade (A-E). The radar
              chart compares all four dimensions. The table below shows exactly which indicators change
              and by how much. Green means improvement, orange means deterioration.
            </p>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- City-specific calibration note for non-Bengaluru -->
  {#if !isBengaluru}
    <div class="mb-6 flex items-start gap-3 rounded-lg border border-altmo-500/30 bg-altmo-500/5 px-4 py-3">
      <i class="fa-solid fa-flask mt-0.5 text-altmo-700"></i>
      <div>
        <span class="text-sm font-semibold text-altmo-700">City-Calibrated Coefficients</span>
        <p class="text-sm text-text-secondary">
          Intervention effects for {cityName} use research-calibrated coefficients from DIMTS, CMRL, HMRL, PMPML, RITES DPRs, and census mode share data. Preset scenarios (ST1/ST2) were originally designed for Bengaluru.
        </p>
      </div>
    </div>
  {/if}

  {#if result}
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <!-- Left column: Presets + Sliders -->
      <div class="lg:col-span-5 space-y-6">
        <!-- Presets -->
        <div class="rounded-xl border border-border bg-surface-card p-5">
          <h2 class="mb-1 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Preset Scenarios
          </h2>
          <p class="mb-3 text-xs text-text-secondary">Select a research-backed strategy or build your own below</p>
          <ScenarioPresets
            {activePresetKey}
            onselect={handlePresetSelect}
          />
        </div>

        <!-- Sliders -->
        <div class="rounded-xl border border-border bg-surface-card p-5">
          <h2 class="mb-1 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Interventions
          </h2>
          <p class="mb-3 text-xs text-text-secondary">Drag sliders to model infrastructure investments</p>
          <ScenarioSliders
            bind:interventions
            {cityId}
            baselineOverrides={data.qolOverrides}
            onchange={handleSliderChange}
          />
        </div>
      </div>

      <!-- Right column: Results -->
      <div class="lg:col-span-7 space-y-6">
        <!-- Score comparison cards -->
        <div class="grid grid-cols-2 gap-4">
          <div class="rounded-xl border border-border bg-surface-card p-5 text-center">
            <div class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Current</div>
            <div class="mt-2 text-4xl font-bold" style="color: {gradeColor(result.baseline.grade)}">
              {(result.baseline.composite * 100).toFixed(0)}
            </div>
            <div class="mt-1 text-sm text-text-secondary">/ 100</div>
            <div
              class="mx-auto mt-2 inline-flex rounded-full px-3 py-0.5 text-sm font-bold text-white"
              style="background-color: {gradeColor(result.baseline.grade)}"
            >
              Grade {result.baseline.grade}
            </div>
          </div>

          <div class="rounded-xl border-2 p-5 text-center {result.delta > 0 ? 'border-altmo-500' : 'border-border'}">
            <div class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Scenario</div>
            <div class="mt-2 text-4xl font-bold" style="color: {gradeColor(result.scenario.grade)}">
              {(result.scenario.composite * 100).toFixed(0)}
            </div>
            <div class="mt-1 text-sm text-text-secondary">/ 100</div>
            <div
              class="mx-auto mt-2 inline-flex rounded-full px-3 py-0.5 text-sm font-bold text-white"
              style="background-color: {gradeColor(result.scenario.grade)}"
            >
              Grade {result.scenario.grade}
            </div>
            {#if result.delta !== 0}
              <div class="mt-2 text-sm font-semibold {result.delta > 0 ? 'text-altmo-700' : 'text-tangerine-500'}">
                {result.delta > 0 ? '+' : ''}{(result.delta * 100).toFixed(1)} pts
              </div>
            {/if}
          </div>
        </div>

        <!-- Radar chart -->
        <div class="rounded-xl border border-border bg-surface-card p-5">
          <h2 class="mb-1 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Dimension Comparison
          </h2>
          <p class="mb-3 text-xs text-text-secondary">Dashed = current, solid = scenario. Larger area = better QoL.</p>
          <ScenarioRadarChart {result} />
        </div>

        <!-- Indicator changes table -->
        <div class="rounded-xl border border-border bg-surface-card p-5">
          <h2 class="mb-1 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Indicator Changes
          </h2>
          <p class="mb-3 text-xs text-text-secondary">How each underlying metric shifts under this scenario</p>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  <th class="pb-2 pr-4">Indicator</th>
                  <th class="pb-2 pr-4 text-right">Current</th>
                  <th class="pb-2 pr-4 text-right">Scenario</th>
                  <th class="pb-2 text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {#each result.indicatorChanges as change (change.key)}
                  {@const hasChange = change.delta !== null && Math.abs(change.delta) > 0.01}
                  <tr class="border-b border-border/50 {hasChange ? '' : 'opacity-60'}">
                    <td class="py-2 pr-4 font-medium text-text-primary">{change.label}</td>
                    <td class="py-2 pr-4 text-right text-text-secondary">
                      {formatIndicatorValue(change.baseline, change.unit)}
                      <span class="text-xs text-text-secondary/60">{change.unit}</span>
                    </td>
                    <td class="py-2 pr-4 text-right {hasChange ? 'font-semibold text-text-primary' : 'text-text-secondary'}">
                      {formatIndicatorValue(change.scenario, change.unit)}
                    </td>
                    <td class="py-2 text-right">
                      {#if hasChange}
                        <span class="font-semibold {change.delta! > 0 && (change.key === 'congestion_level' || change.key === 'pm25_annual' || change.key === 'traffic_fatalities') ? 'text-tangerine-500' : change.delta! < 0 && (change.key === 'congestion_level' || change.key === 'pm25_annual' || change.key === 'traffic_fatalities') ? 'text-altmo-700' : change.delta! > 0 ? 'text-altmo-700' : 'text-tangerine-500'}">
                          {formatDelta(change.delta, change.unit)}
                        </span>
                      {:else}
                        <span class="text-text-secondary">--</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Methodology footer -->
  <div class="mt-8 rounded-xl border border-border bg-surface-card p-5">
    <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-text-secondary">
      Methodology
    </h2>
    <p class="text-sm text-text-secondary leading-relaxed">
      Scenario strategies (ST1A-D, ST2A-D) adapted from Allirani & Verma (2025) "A novel transportation
      Quality of Life Index framework", IISc Bangalore. Scores use the ETQOLI methodology
      (benchmark-anchored normalization, policy-meaningful grade boundaries) which differs from the
      paper's original TQOLI scoring. Dimension weights from Fuzzy-AHP expert survey (40 transport
      planners): Health 0.43, Accessibility 0.23, Environmental 0.18, Mobility 0.16.
      Intervention coefficients are city-specific, calibrated from DIMTS (Delhi), CMRL (Chennai),
      HMRL (Hyderabad), PMPML (Pune), Kochi Metro Ltd, AICTSL/BRT (Indore), RITES DPRs, and
      Census 2011 mode share data. Bengaluru baseline from IISc study. Fleet electrification
      reduces PM2.5 using city-specific transport emission shares (UrbanEmissions APnA); grid
      renewables reduce PM2.5 using state-level power generation shares (CEA/Ember).
    </p>
  </div>
</div>
