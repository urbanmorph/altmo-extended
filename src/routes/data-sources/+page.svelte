<script lang="ts">
  import { selectedCity } from '$lib/stores/city';
  import { CITIES } from '$lib/config/cities';

  interface Source {
    name: string;
    url: string | null;
    description: string;
    category: string;
    indicators: string[];
    dataType: string;
    confidence?: 'high' | 'medium' | 'low';
    year: string;
    license: string | null;
    notes?: string;
  }

  interface CategoryDef {
    label: string;
    icon: string;
  }

  interface ConfidenceLevelDef {
    label: string;
    description: string;
  }

  interface DataSourcesJSON {
    version: string;
    lastUpdated: string;
    categories: Record<string, CategoryDef>;
    confidenceLevels?: Record<string, ConfidenceLevelDef>;
    crossCitySources: Source[];
    cities: Record<string, { name: string; state: string; sources: Source[] }>;
  }

  interface Props {
    data: {
      dataSources: DataSourcesJSON;
      cityId: string;
    };
  }

  let { data }: Props = $props();
  let ds: DataSourcesJSON = $derived(data.dataSources);

  // Sync city from server data
  $effect(() => {
    const city = CITIES.find((c) => c.id === data.cityId);
    if (city) {
      selectedCity.set({ id: city.id, name: city.name, lat: city.lat, lng: city.lng, zoom: city.zoom });
    }
  });

  let cityId = $derived($selectedCity?.id ?? data.cityId);
  let cityData = $derived(ds.cities[cityId]);

  let activeTab: 'city' | 'cross-city' = $state('city');
  let filterCategory: string | null = $state(null);

  let citySources = $derived(
    filterCategory
      ? cityData?.sources.filter((s) => s.category === filterCategory) ?? []
      : cityData?.sources ?? []
  );

  let crossCitySources = $derived(
    filterCategory
      ? ds.crossCitySources.filter((s) => s.category === filterCategory)
      : ds.crossCitySources
  );

  let categoryList = $derived(Object.entries(ds.categories));

  function dataTypeBadge(dt: string): { label: string; classes: string } {
    switch (dt) {
      case 'live': return { label: 'Live', classes: 'bg-altmo-50 text-altmo-700' };
      case 'static': return { label: 'Static', classes: 'bg-neutral-100 text-text-secondary' };
      case 'research': return { label: 'Research', classes: 'bg-blue-50 text-blue-700' };
      case 'derived': return { label: 'Derived', classes: 'bg-tangerine-300/20 text-tangerine-500' };
      case 'reference': return { label: 'Reference', classes: 'bg-purple-50 text-purple-700' };
      default: return { label: dt, classes: 'bg-neutral-100 text-text-secondary' };
    }
  }

  function confidenceBadge(level: string | undefined): { label: string; icon: string; classes: string } {
    switch (level) {
      case 'high': return { label: 'High', icon: 'fa-solid fa-circle-check', classes: 'text-status-available' };
      case 'medium': return { label: 'Medium', icon: 'fa-solid fa-circle-minus', classes: 'text-status-partial' };
      case 'low': return { label: 'Low', icon: 'fa-solid fa-circle-exclamation', classes: 'text-status-unavailable' };
      default: return { label: 'Unknown', icon: 'fa-solid fa-circle-question', classes: 'text-text-secondary' };
    }
  }

  function countConfidence(sources: Source[]): { high: number; medium: number; low: number } {
    return sources.reduce((acc, s) => {
      if (s.confidence === 'high') acc.high++;
      else if (s.confidence === 'medium') acc.medium++;
      else acc.low++;
      return acc;
    }, { high: 0, medium: 0, low: 0 });
  }

  let allCitySources = $derived(
    Object.values(ds.cities).flatMap((c) => c.sources)
  );
  let allSources = $derived([...ds.crossCitySources, ...allCitySources]);
  let confidenceCounts = $derived(countConfidence(allSources));
</script>

<svelte:head>
  <title>Data Provenance — Altmo Intelligence</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <!-- Header -->
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-text-primary">Data Provenance</h1>
    <p class="mt-1 text-text-secondary">
      All data sources referenced in Altmo scoring and analytics
    </p>
  </div>

  <!-- Last updated -->
  <div class="mb-4 text-xs text-text-secondary">
    <i class="fa-solid fa-clock mr-1"></i>
    Last updated: {ds.lastUpdated} &middot; Version {ds.version}
  </div>

  <!-- Tabs -->
  <div class="mb-6 flex gap-1 rounded-lg border border-border bg-surface-card p-1">
    <button
      onclick={() => activeTab = 'city'}
      class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors
        {activeTab === 'city' ? 'bg-altmo-700 text-white' : 'text-text-secondary hover:text-text-primary'}"
    >
      <i class="fa-solid fa-city mr-1.5"></i>
      {cityData?.name ?? 'City'} Sources
      <span class="ml-1 text-xs opacity-70">({citySources.length})</span>
    </button>
    <button
      onclick={() => activeTab = 'cross-city'}
      class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors
        {activeTab === 'cross-city' ? 'bg-altmo-700 text-white' : 'text-text-secondary hover:text-text-primary'}"
    >
      <i class="fa-solid fa-globe mr-1.5"></i>
      Cross-City Sources
      <span class="ml-1 text-xs opacity-70">({crossCitySources.length})</span>
    </button>
  </div>

  <!-- Category filters -->
  <div class="mb-6 flex flex-wrap gap-1.5">
    <button
      onclick={() => filterCategory = null}
      class="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors
        {filterCategory === null
          ? 'border-primary bg-altmo-50 text-primary'
          : 'border-border bg-surface-card text-text-secondary hover:border-primary/40'}"
    >
      All
    </button>
    {#each categoryList as [key, cat]}
      <button
        onclick={() => filterCategory = filterCategory === key ? null : key}
        class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors
          {filterCategory === key
            ? 'border-primary bg-altmo-50 text-primary'
            : 'border-border bg-surface-card text-text-secondary hover:border-primary/40'}"
      >
        <i class="{cat.icon} text-[0.65rem]"></i>
        {cat.label}
      </button>
    {/each}
  </div>

  <!-- Source cards -->
  {#if activeTab === 'city'}
    {#if citySources.length === 0}
      <div class="rounded-xl border border-border bg-surface-card p-8 text-center text-text-secondary">
        <i class="fa-solid fa-folder-open mb-2 text-2xl"></i>
        <p>No sources found for this filter.</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        {#each citySources as source (source.name)}
          {@const badge = dataTypeBadge(source.dataType)}
          {@const conf = confidenceBadge(source.confidence)}
          {@const catDef = ds.categories[source.category]}
          <div class="rounded-xl border border-border bg-surface-card p-5">
            <div class="mb-2 flex items-start justify-between gap-2">
              <div class="flex items-center gap-2">
                {#if catDef}
                  <i class="{catDef.icon} text-sm text-primary"></i>
                {/if}
                <h3 class="text-sm font-semibold text-text-primary">{source.name}</h3>
              </div>
              <div class="flex shrink-0 items-center gap-1.5">
                <span class="inline-flex items-center gap-1 text-[0.6rem] {conf.classes}" title="Confidence: {conf.label}">
                  <i class="{conf.icon} text-[0.55rem]"></i>
                </span>
                <span class="rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide {badge.classes}">
                  {badge.label}
                </span>
              </div>
            </div>
            <p class="mb-3 text-xs leading-relaxed text-text-secondary">{source.description}</p>
            <div class="flex flex-wrap items-center gap-2 text-xs">
              {#if source.url}
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <i class="fa-solid fa-arrow-up-right-from-square text-[0.55rem]"></i>
                  Source
                </a>
              {/if}
              <span class="text-text-secondary">
                <i class="fa-regular fa-calendar mr-0.5"></i>
                {source.year}
              </span>
              {#if source.license}
                <span class="text-text-secondary">
                  <i class="fa-solid fa-scale-balanced mr-0.5"></i>
                  {source.license}
                </span>
              {/if}
              {#if catDef}
                <span class="text-text-secondary/60">{catDef.label}</span>
              {/if}
            </div>
            {#if source.indicators && source.indicators.length > 0}
              <div class="mt-2 flex flex-wrap gap-1">
                {#each source.indicators as ind}
                  <span class="rounded bg-neutral-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-text-secondary">
                    {ind}
                  </span>
                {/each}
              </div>
            {/if}
            {#if source.notes}
              <div class="mt-2 rounded bg-tangerine-300/10 px-2 py-1 text-[0.65rem] text-tangerine-500">
                <i class="fa-solid fa-triangle-exclamation mr-1"></i>{source.notes}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <!-- Cross-city sources -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      {#each crossCitySources as source (source.name)}
        {@const badge = dataTypeBadge(source.dataType)}
        {@const conf = confidenceBadge(source.confidence)}
        {@const catDef = ds.categories[source.category]}
        <div class="rounded-xl border border-border bg-surface-card p-5">
          <div class="mb-2 flex items-start justify-between gap-2">
            <div class="flex items-center gap-2">
              {#if catDef}
                <i class="{catDef.icon} text-sm text-primary"></i>
              {/if}
              <h3 class="text-sm font-semibold text-text-primary">{source.name}</h3>
            </div>
            <div class="flex shrink-0 items-center gap-1.5">
              <span class="inline-flex items-center gap-1 text-[0.6rem] {conf.classes}" title="Confidence: {conf.label}">
                <i class="{conf.icon} text-[0.55rem]"></i>
              </span>
              <span class="rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide {badge.classes}">
                {badge.label}
              </span>
            </div>
          </div>
          <p class="mb-3 text-xs leading-relaxed text-text-secondary">{source.description}</p>
          <div class="flex flex-wrap items-center gap-2 text-xs">
            {#if source.url}
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <i class="fa-solid fa-arrow-up-right-from-square text-[0.55rem]"></i>
                Source
              </a>
            {/if}
            <span class="text-text-secondary">
              <i class="fa-regular fa-calendar mr-0.5"></i>
              {source.year}
            </span>
            {#if source.license}
              <span class="text-text-secondary">
                <i class="fa-solid fa-scale-balanced mr-0.5"></i>
                {source.license}
              </span>
            {/if}
            {#if catDef}
              <span class="text-text-secondary/60">{catDef.label}</span>
            {/if}
          </div>
          {#if source.indicators && source.indicators.length > 0 && source.indicators[0] !== 'all'}
            <div class="mt-2 flex flex-wrap gap-1">
              {#each source.indicators as ind}
                <span class="rounded bg-neutral-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-text-secondary">
                  {ind}
                </span>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Stats footer -->
  <div class="mt-8 rounded-xl border border-border bg-surface-card p-5">
    <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
      Coverage Summary
    </h2>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div>
        <div class="text-2xl font-bold text-primary">{Object.keys(ds.cities).length}</div>
        <div class="text-xs text-text-secondary">Cities covered</div>
      </div>
      <div>
        <div class="text-2xl font-bold text-primary">
          {ds.crossCitySources.length + Object.values(ds.cities).reduce((sum, c) => sum + c.sources.length, 0)}
        </div>
        <div class="text-xs text-text-secondary">Total sources</div>
      </div>
      <div>
        <div class="text-2xl font-bold text-primary">
          {ds.crossCitySources.filter((s) => s.dataType === 'live').length +
            Object.values(ds.cities).reduce((sum, c) => sum + c.sources.filter((s) => s.dataType === 'live').length, 0)}
        </div>
        <div class="text-xs text-text-secondary">Live data feeds</div>
      </div>
      <div>
        <div class="text-2xl font-bold text-primary">{Object.keys(ds.categories).length}</div>
        <div class="text-xs text-text-secondary">Categories</div>
      </div>
    </div>

    <!-- Confidence breakdown -->
    <div class="mt-4 border-t border-border pt-4">
      <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Data Confidence
      </h3>
      <div class="flex flex-wrap gap-4">
        <div class="flex items-center gap-1.5 text-xs">
          <i class="fa-solid fa-circle-check text-status-available"></i>
          <span class="font-semibold text-text-primary">{confidenceCounts.high}</span>
          <span class="text-text-secondary">High</span>
        </div>
        <div class="flex items-center gap-1.5 text-xs">
          <i class="fa-solid fa-circle-minus text-status-partial"></i>
          <span class="font-semibold text-text-primary">{confidenceCounts.medium}</span>
          <span class="text-text-secondary">Medium</span>
        </div>
        <div class="flex items-center gap-1.5 text-xs">
          <i class="fa-solid fa-circle-exclamation text-status-unavailable"></i>
          <span class="font-semibold text-text-primary">{confidenceCounts.low}</span>
          <span class="text-text-secondary">Low</span>
        </div>
      </div>
      {#if ds.confidenceLevels}
        <div class="mt-2 space-y-0.5 text-[0.65rem] text-text-secondary">
          {#each Object.entries(ds.confidenceLevels) as [, def]}
            <div>{def.label}: {def.description}</div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
