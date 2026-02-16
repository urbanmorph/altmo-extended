<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { CITIES } from '$lib/config/cities';
  import ScoreOverview from '$lib/components/city/ScoreOverview.svelte';
  import InfrastructureSection from '$lib/components/city/InfrastructureSection.svelte';
  import ActivitySection from '$lib/components/city/ActivitySection.svelte';
  import ScenariosSection from '$lib/components/city/ScenariosSection.svelte';
  import DataReadinessSection from '$lib/components/city/DataReadinessSection.svelte';
  import TakeActionSection from '$lib/components/city/TakeActionSection.svelte';
  import { getActionsForCity } from '$lib/config/action-guides';
  import { DATA_LAYERS } from '$lib/config/data-readiness';

  // Data shape matches what +page.server.ts actually returns
  let { data } = $props();

  // ── Tab navigation ──

  const TABS = [
    { id: 'score', label: 'Score', icon: 'fa-solid fa-gauge-high' },
    { id: 'infrastructure', label: 'Infrastructure', icon: 'fa-solid fa-city' },
    { id: 'activity', label: 'Activity', icon: 'fa-solid fa-chart-line' },
    { id: 'scenarios', label: 'Scenarios', icon: 'fa-solid fa-wand-magic-sparkles' },
    { id: 'data', label: 'Data', icon: 'fa-solid fa-database' },
    { id: 'action', label: 'Action', icon: 'fa-solid fa-bolt' }
  ];

  let activeTab = $state('score');

  onMount(() => {
    const sections = TABS.map((t) => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            activeTab = entry.target.id;
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );

    for (const section of sections) {
      observer.observe(section);
    }

    return () => observer.disconnect();
  });

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      activeTab = id;
    }
  }

  function handleCityChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target.value && target.value !== data.cityId) {
      goto(`/city/${target.value}`);
    }
  }

  // ── Adapt server data to section component props ──

  const transitProps = $derived(data.transitMetrics ? {
    busStops: data.transitMetrics.totalBusStops ?? 0,
    metroStations: data.transitMetrics.totalMetroStations ?? 0,
    railKm: (data.transitMetrics.totalRailStations ?? 0) > 0 ? data.scenario?.railKm ?? 0 : 0,
    suburbanRailKm: 0,
    metroKm: 0
  } : null);

  const activityProps = $derived.by(() => {
    const summary = data.activity?.summary;
    if (!summary || summary.totalTrips === 0) return null;
    // Derive rides/walks from mode breakdown
    const rides = summary.modeBreakdown?.find((m: { mode: string }) => m.mode === 'Ride')?.count ?? 0;
    const walks = summary.modeBreakdown?.find((m: { mode: string }) => m.mode === 'Walk')?.count ?? 0;
    return {
      totalRides: rides,
      totalWalks: walks,
      totalDistance: summary.totalDistanceKm ?? 0,
      co2Offset: (summary.totalDistanceKm ?? 0) * 0.25,
      transitProximityPct: data.activity?.transitProximity?.pctConnected ?? 0,
      tripChaining: data.activity?.tripChaining ?? null
    };
  });

  const actions = $derived(getActionsForCity(data.cityId));

  // OG meta tag values
  const ogScore = $derived(data.qolScore ? Math.round(data.qolScore.composite * 100) : null);
  const ogGrade = $derived(data.qolScore?.grade ?? null);
  const ogDescription = $derived(
    ogScore !== null && ogGrade
      ? `${data.cityName} scores ${ogScore}/100 on the ETQOLI active mobility index.${data.gapAnalysis?.upgradeSentence ? ' ' + data.gapAnalysis.upgradeSentence : ''}`
      : `Active mobility scorecard for ${data.cityName}: transit infrastructure, activity data, air quality, safety, and scenario modelling.`
  );

  // Convert readiness Record<string, DataStatus> to array for DataReadinessSection
  const readinessForSection = $derived.by(() => {
    const dr = data.dataReadiness;
    if (!dr) return null;
    const layers = DATA_LAYERS.map((dl) => ({
      name: dl.label,
      status: dr.layers[dl.key] ?? 'unavailable'
    }));
    const score = data.readinessScore
      ? Math.round((data.readinessScore.total / data.readinessScore.maxScore) * 100)
      : 0;
    return { score, layers };
  });
</script>

<svelte:head>
  <title>{data.cityName}{ogGrade ? ` — Grade ${ogGrade}` : ''} | Altmo Intelligence</title>
  <meta name="description" content={ogDescription} />

  <!-- Open Graph -->
  <meta property="og:title" content="{data.cityName}{ogGrade ? ` — Grade ${ogGrade}` : ''} | Altmo Intelligence" />
  <meta property="og:description" content={ogDescription} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://intelligence.altmo.app/city/{data.cityId}" />
  <meta property="og:site_name" content="Altmo Intelligence" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="{data.cityName}{ogGrade ? ` — Grade ${ogGrade}` : ''} | Altmo Intelligence" />
  <meta name="twitter:description" content={ogDescription} />
</svelte:head>

<!-- Sticky tab bar -->
<div class="sticky top-0 z-30 border-b border-border bg-surface-card/95 backdrop-blur-sm">
  <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-3 border-r border-border py-3 pr-4">
        <div class="min-w-0">
          <h1 class="text-lg font-bold text-text-primary">{data.cityName}</h1>
          {#if data.regionCities}
            <p class="text-[0.65rem] leading-tight text-text-secondary">{data.regionCities}</p>
          {/if}
        </div>
        <select
          class="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-primary focus:ring-2 focus:ring-altmo-500 focus:outline-none"
          value={data.cityId}
          onchange={handleCityChange}
        >
          {#each CITIES as city}
            <option value={city.id}>{city.name}</option>
          {/each}
        </select>
      </div>

      <nav class="flex flex-1 gap-1 overflow-x-auto py-2" aria-label="City sections">
        {#each TABS as tab}
          <button
            class="flex flex-shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors
              {activeTab === tab.id
                ? 'bg-altmo-700 text-white'
                : 'text-text-secondary hover:bg-earth-50 hover:text-text-primary'}"
            onclick={() => scrollToSection(tab.id)}
          >
            <i class="{tab.icon} text-xs"></i>
            <span class="hidden sm:inline">{tab.label}</span>
          </button>
        {/each}
      </nav>
    </div>
  </div>
</div>

<!-- Page content -->
<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <div class="space-y-16">
    <ScoreOverview
      cityId={data.cityId}
      cityName={data.cityName}
      qolScore={data.qolScore ?? null}
      gap={data.gapAnalysis ?? null}
      readinessScore={data.readinessScore ? Math.round((data.readinessScore.total / data.readinessScore.maxScore) * 100) : null}
    />

    <InfrastructureSection
      cityId={data.cityId}
      transit={transitProps}
      transitGeo={data.transit}
      geoMarkers={data.geoMarkers ?? []}
      densityCells={data.activity?.densityCells ?? []}
      center={data.cityCenter}
      zoom={data.cityZoom}
    />

    <ActivitySection
      activity={activityProps}
      pm25={data.environmental?.pm25}
      safety={data.environmental?.safety}
      congestion={data.environmental?.congestion}
      companies={data.companies ?? null}
      cityName={data.cityName}
    />

    <ScenariosSection
      currentScore={data.qolScore?.composite ?? null}
      currentGrade={data.qolScore?.grade ?? null}
      scenarios={data.computedScenarios ?? []}
    />

    <DataReadinessSection
      readiness={readinessForSection}
      confidence={data.qolScore?.confidence ?? null}
    />

    <TakeActionSection {actions} />
  </div>

  <div class="mt-16 border-t border-border pt-8 text-center">
    <a
      href="/"
      class="inline-flex items-center gap-2 text-sm font-medium text-altmo-700 hover:text-altmo-800 hover:underline"
    >
      <i class="fa-solid fa-arrow-left"></i>
      Back to City Leaderboard
    </a>
  </div>
</div>
