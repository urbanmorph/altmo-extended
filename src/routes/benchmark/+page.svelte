<script lang="ts">
  import { computeAllQoL, QOL_DIMENSIONS, type QoLOverrides } from '$lib/config/city-qol-data';
  import BenchmarkTable from '$lib/components/BenchmarkTable.svelte';
  import BenchmarkRadar from '$lib/components/BenchmarkRadar.svelte';
  import DimensionDeepDive from '$lib/components/DimensionDeepDive.svelte';
  import MethodologyFooter from '$lib/components/MethodologyFooter.svelte';
  import { cityName } from '$lib/utils/qol-format';

  interface Props {
    data: {
      qolOverrides: QoLOverrides;
      cityId: string;
    };
  }

  let { data }: Props = $props();

  const scores = $derived(computeAllQoL(data.qolOverrides));

  // Tab state
  type Tab = 'rankings' | 'radar' | 'deep-dive';
  let activeTab: Tab = $state('rankings');

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'rankings', label: 'Rankings', icon: 'fa-solid fa-ranking-star' },
    { key: 'radar', label: 'Radar Comparison', icon: 'fa-solid fa-chart-pie' },
    { key: 'deep-dive', label: 'Dimension Deep-Dive', icon: 'fa-solid fa-magnifying-glass-chart' }
  ];

  // Rankings tab: sort state
  let sortBy = $state('composite');

  // Radar tab: city selection (default first 3)
  let selectedCities: string[] = $state(
    scores.slice(0, 3).map((s) => s.cityId)
  );

  function toggleCity(cityId: string) {
    if (selectedCities.includes(cityId)) {
      if (selectedCities.length > 1) {
        selectedCities = selectedCities.filter((c) => c !== cityId);
      }
    } else if (selectedCities.length < 4) {
      selectedCities = [...selectedCities, cityId];
    }
  }

  // Deep-dive tab: dimension selection
  let selectedDimension = $state('health');
</script>

<svelte:head>
  <title>Cross-City Benchmarking — Altmo Intelligence</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <!-- Header -->
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-text-primary">Cross-City Benchmarking</h1>
    <p class="mt-1 text-text-secondary">
      Compare transport quality of life across 7 Indian cities
    </p>
  </div>

  <!-- Tab bar -->
  <div class="mb-6 flex gap-1 rounded-xl border border-border bg-surface-card p-1">
    {#each tabs as tab (tab.key)}
      <button
        onclick={() => activeTab = tab.key}
        class="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
          {activeTab === tab.key
            ? 'bg-primary text-white shadow-sm'
            : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}"
      >
        <i class="{tab.icon} text-xs"></i>
        <span class="hidden sm:inline">{tab.label}</span>
        <span class="sm:hidden">{tab.label.split(' ')[0]}</span>
      </button>
    {/each}
  </div>

  <!-- Tab 1: Rankings -->
  {#if activeTab === 'rankings'}
    <div class="rounded-xl border border-border bg-surface-card p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            City Rankings
          </h2>
          <p class="text-xs text-text-secondary">Click a column header to re-rank by that dimension</p>
        </div>
        <div class="flex items-center gap-2 text-xs text-text-secondary">
          <span>Sort by:</span>
          <select
            bind:value={sortBy}
            class="rounded-md border border-border bg-surface-card px-2 py-1 text-xs text-text-primary"
          >
            <option value="composite">Composite</option>
            {#each QOL_DIMENSIONS as dim (dim.key)}
              <option value={dim.key}>{dim.label}</option>
            {/each}
          </select>
        </div>
      </div>
      <BenchmarkTable
        {scores}
        overrides={data.qolOverrides}
        {sortBy}
        highlightCity={data.cityId}
        onsort={(key) => sortBy = key}
      />
    </div>
  {/if}

  <!-- Tab 2: Radar Comparison -->
  {#if activeTab === 'radar'}
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <!-- City selector -->
      <div class="lg:col-span-4">
        <div class="rounded-xl border border-border bg-surface-card p-5">
          <h2 class="mb-1 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Select Cities
          </h2>
          <p class="mb-3 text-xs text-text-secondary">Choose up to 4 cities to compare</p>
          <div class="space-y-2">
            {#each scores as entry (entry.cityId)}
              {@const selected = selectedCities.includes(entry.cityId)}
              {@const disabled = !selected && selectedCities.length >= 4}
              <button
                onclick={() => toggleCity(entry.cityId)}
                {disabled}
                class="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors
                  {selected
                    ? 'border-primary bg-primary/5 text-text-primary'
                    : disabled
                      ? 'border-border/50 bg-surface-card text-text-secondary/50 cursor-not-allowed'
                      : 'border-border bg-surface-card text-text-secondary hover:border-primary/50 hover:bg-surface-hover'}"
              >
                <div
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded border
                    {selected ? 'border-primary bg-primary' : 'border-border'}"
                >
                  {#if selected}
                    <i class="fa-solid fa-check text-[0.6rem] text-white"></i>
                  {/if}
                </div>
                <span class="flex-1 font-medium">{cityName(entry.cityId)}</span>
                <span class="text-xs tabular-nums">{Math.round(entry.composite * 100)}/100</span>
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Radar chart -->
      <div class="lg:col-span-8">
        <div class="rounded-xl border border-border bg-surface-card p-5">
          <h2 class="mb-1 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Dimension Comparison
          </h2>
          <p class="mb-3 text-xs text-text-secondary">
            4 axes represent QoL dimensions. Larger area = better overall score.
          </p>
          {#if selectedCities.length > 0}
            <BenchmarkRadar {scores} {selectedCities} />
          {:else}
            <div class="flex h-64 items-center justify-center text-text-secondary">
              <p>Select at least one city to view the radar chart</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Tab 3: Dimension Deep-Dive -->
  {#if activeTab === 'deep-dive'}
    <div class="space-y-6">
      <!-- Dimension selector -->
      <div class="flex flex-wrap gap-2">
        {#each QOL_DIMENSIONS as dim (dim.key)}
          <button
            onclick={() => selectedDimension = dim.key}
            class="rounded-lg border px-4 py-2 text-sm font-medium transition-colors
              {selectedDimension === dim.key
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-surface-card text-text-secondary hover:border-primary/50 hover:text-text-primary'}"
          >
            {dim.label}
            <span class="ml-1 text-xs opacity-70">({Math.round(dim.weight * 100)}%)</span>
          </button>
        {/each}
      </div>

      <!-- Deep-dive content -->
      <div class="rounded-xl border border-border bg-surface-card p-5">
        <DimensionDeepDive
          {scores}
          dimension={selectedDimension}
          overrides={data.qolOverrides}
        />
      </div>
    </div>
  {/if}

  <!-- Methodology footer -->
  <div class="mt-8">
    <MethodologyFooter />
  </div>
</div>
