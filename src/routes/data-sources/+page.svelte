<script lang="ts">
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

  // Local city selector state (no global store dependency)
  let cityId: string = $state(data.cityId);
  let cityData = $derived(ds.cities[cityId]);

  let activeTab: 'city' | 'cross-city' = $state('city');
  let filterCategory: string | null = $state(null);
  let searchQuery: string = $state('');

  // Available cities from data-sources.json
  let availableCities = $derived(
    Object.entries(ds.cities).map(([id, c]) => ({ id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name))
  );

  // Filter sources by category and search
  function filterSources(sources: Source[]): Source[] {
    let filtered = sources;
    if (filterCategory) {
      filtered = filtered.filter((s) => s.category === filterCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.indicators.some((i) => i.toLowerCase().includes(q))
      );
    }
    return filtered;
  }

  let citySources = $derived(filterSources(cityData?.sources ?? []));
  let crossCitySources = $derived(filterSources(ds.crossCitySources));

  let categoryList = $derived(Object.entries(ds.categories));

  // ETQOLI dimensions
  const dimensions = [
    { name: 'Health', weight: 43, icon: 'fa-solid fa-heart-pulse', color: 'text-red-600', bg: 'bg-red-50', indicators: ['Traffic fatalities', 'VRU fatality share', 'Walking share', 'Cycling share', 'Footpath coverage'] },
    { name: 'Accessibility', weight: 23, icon: 'fa-solid fa-route', color: 'text-blue-600', bg: 'bg-blue-50', indicators: ['Rail transit km', 'Bus fleet per lakh', 'Transit stop density', 'Cycle infra km', 'PT accessibility'] },
    { name: 'Environmental', weight: 18, icon: 'fa-solid fa-leaf', color: 'text-green-600', bg: 'bg-green-50', indicators: ['PM2.5', 'NO2', 'Congestion', 'Noise', 'CO2 emissions', 'Fuel consumption', 'Green cover'] },
    { name: 'Mobility', weight: 16, icon: 'fa-solid fa-person-walking', color: 'text-purple-600', bg: 'bg-purple-50', indicators: ['Sustainable mode share', 'Road density'] }
  ];

  // Grade scale
  const grades = [
    { grade: 'A', min: 0.75, label: 'Excellent', color: 'bg-green-600' },
    { grade: 'B', min: 0.60, label: 'Good', color: 'bg-green-500' },
    { grade: 'C', min: 0.45, label: 'Fair', color: 'bg-yellow-500' },
    { grade: 'D', min: 0.30, label: 'Below average', color: 'bg-orange-500' },
    { grade: 'E', min: 0.0, label: 'Poor', color: 'bg-red-500' }
  ];

  // Confidence tiers
  const confidenceTiers = [
    { tier: 'Gold', threshold: '>80%', icon: 'fa-solid fa-certificate', color: 'text-yellow-500' },
    { tier: 'Silver', threshold: '>60%', icon: 'fa-solid fa-certificate', color: 'text-neutral-400' },
    { tier: 'Bronze', threshold: '<60%', icon: 'fa-solid fa-certificate', color: 'text-amber-700' }
  ];

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
  <title>Data Provenance | Altmo Intelligence</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <!-- Header -->
  <div class="mb-8">
    <h1 class="text-2xl font-bold text-text-primary">
      <i class="fa-solid fa-microscope mr-2 text-primary"></i>Data Provenance
    </h1>
    <p class="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">
      Altmo Intelligence scores cities using the ETQOLI (Enhanced Transportation Quality of Life Index) framework
      -- a research-backed model with 19 indicators across 4 dimensions. Every data point is traceable to a
      published source. This page explains how we score and lists every data source we use.
    </p>
  </div>

  <!-- ============================================================ -->
  <!-- Section 1: How We Score                                       -->
  <!-- ============================================================ -->
  <section class="mb-12">
    <h2 class="mb-5 flex items-center gap-2 text-lg font-bold text-text-primary">
      <i class="fa-solid fa-calculator text-primary"></i>
      How We Score
    </h2>

    <!-- Scoring overview -->
    <div class="mb-6 rounded-xl border border-border bg-surface-card p-5">
      <p class="mb-4 text-sm leading-relaxed text-text-secondary">
        Each city receives a composite ETQOLI score from 0 to 1, computed as a weighted sum across 4 dimensions.
        Weights are derived from Fuzzy-AHP analysis in the underlying research framework
        (Allirani & Verma, 2025). Indicators use <strong>benchmark-anchored normalization</strong>
        -- fixed worst-case and target values from global and Indian benchmarks, so adding a new city never
        shifts existing scores.
      </p>
      <div class="text-xs text-text-secondary">
        <i class="fa-solid fa-book-open mr-1 text-primary"></i>
        Based on: "A novel transportation Quality of Life Index framework for evaluating sustainable transport interventions" (IISc Bangalore, 2025)
      </div>
    </div>

    <!-- 4 Dimension cards -->
    <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {#each dimensions as dim}
        <div class="rounded-xl border border-border bg-surface-card p-4">
          <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="flex h-8 w-8 items-center justify-center rounded-lg {dim.bg}">
                <i class="{dim.icon} text-sm {dim.color}"></i>
              </span>
              <h3 class="text-sm font-semibold text-text-primary">{dim.name}</h3>
            </div>
            <span class="text-lg font-bold text-primary">{dim.weight}%</span>
          </div>
          <div class="flex flex-wrap gap-1">
            {#each dim.indicators as ind}
              <span class="rounded bg-neutral-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-text-secondary">
                {ind}
              </span>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <!-- Grade scale + Confidence tiers -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <!-- Grade scale -->
      <div class="rounded-xl border border-border bg-surface-card p-5">
        <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
          <i class="fa-solid fa-ranking-star text-primary"></i>
          Grade Scale
        </h3>
        <div class="space-y-2">
          {#each grades as g}
            <div class="flex items-center gap-3">
              <span class="flex h-7 w-7 items-center justify-center rounded-md {g.color} text-xs font-bold text-white">
                {g.grade}
              </span>
              <div class="flex-1 text-xs">
                <span class="font-medium text-text-primary">{g.label}</span>
                <span class="ml-1 text-text-secondary">
                  {#if g.grade === 'A'}
                    (score >= 0.75)
                  {:else if g.grade === 'B'}
                    (0.60 -- 0.74)
                  {:else if g.grade === 'C'}
                    (0.45 -- 0.59)
                  {:else if g.grade === 'D'}
                    (0.30 -- 0.44)
                  {:else}
                    (score &lt; 0.30)
                  {/if}
                </span>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Confidence tiers -->
      <div class="rounded-xl border border-border bg-surface-card p-5">
        <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
          <i class="fa-solid fa-shield-halved text-primary"></i>
          Confidence Tiers
        </h3>
        <p class="mb-3 text-xs leading-relaxed text-text-secondary">
          Each city's score is accompanied by a confidence tier indicating what percentage of its 19 indicators
          are backed by measured (non-estimated) data.
        </p>
        <div class="space-y-2.5">
          {#each confidenceTiers as ct}
            <div class="flex items-center gap-3">
              <i class="{ct.icon} text-base {ct.color}"></i>
              <div class="text-xs">
                <span class="font-semibold text-text-primary">{ct.tier}</span>
                <span class="ml-1 text-text-secondary">{ct.threshold} of indicators measured</span>
              </div>
            </div>
          {/each}
        </div>
        <div class="mt-4 rounded bg-altmo-50 px-3 py-2 text-[0.65rem] leading-relaxed text-primary">
          <i class="fa-solid fa-info-circle mr-1"></i>
          19 indicators total. Cities with more live data feeds (OpenAQ, TomTom, GTFS) earn higher confidence.
        </div>
      </div>
    </div>
  </section>

  <!-- ============================================================ -->
  <!-- Section 2: Data Sources                                       -->
  <!-- ============================================================ -->
  <section>
    <h2 class="mb-5 flex items-center gap-2 text-lg font-bold text-text-primary">
      <i class="fa-solid fa-database text-primary"></i>
      Data Sources
    </h2>

    <!-- Last updated -->
    <div class="mb-4 text-xs text-text-secondary">
      <i class="fa-solid fa-clock mr-1"></i>
      Last updated: {ds.lastUpdated} &middot; Version {ds.version}
    </div>

    <!-- City selector + search bar -->
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="flex items-center gap-2">
        <label for="city-select" class="text-xs font-medium text-text-secondary">
          <i class="fa-solid fa-city mr-1"></i>City
        </label>
        <select
          id="city-select"
          bind:value={cityId}
          class="rounded-lg border border-border bg-surface-card px-3 py-1.5 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {#each availableCities as city}
            <option value={city.id}>{city.name}</option>
          {/each}
        </select>
      </div>
      <div class="relative flex-1">
        <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary"></i>
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search sources by name, description, or indicator..."
          class="w-full rounded-lg border border-border bg-surface-card py-1.5 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>

    <!-- Tabs -->
    <div class="mb-4 flex gap-1 rounded-lg border border-border bg-surface-card p-1">
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
          {#each citySources as source (source.name ?? source.description)}
            {@const badge = dataTypeBadge(source.dataType)}
            {@const conf = confidenceBadge(source.confidence)}
            {@const catDef = ds.categories[source.category]}
            <div class="rounded-xl border border-border bg-surface-card p-5">
              <div class="mb-2 flex items-start justify-between gap-2">
                <div class="flex items-center gap-2">
                  {#if catDef}
                    <i class="{catDef.icon} text-sm text-primary"></i>
                  {/if}
                  <h3 class="text-sm font-semibold text-text-primary">{source.name ?? 'Unnamed source'}</h3>
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
      {#if crossCitySources.length === 0}
        <div class="rounded-xl border border-border bg-surface-card p-8 text-center text-text-secondary">
          <i class="fa-solid fa-folder-open mb-2 text-2xl"></i>
          <p>No sources found for this filter.</p>
        </div>
      {:else}
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
    {/if}

    <!-- Stats footer -->
    <div class="mt-8 rounded-xl border border-border bg-surface-card p-5">
      <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
        <i class="fa-solid fa-chart-pie mr-1.5 text-primary"></i>
        Coverage Summary
      </h3>
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
        <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Data Confidence
        </h4>
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
  </section>
</div>
