<script lang="ts">
  import HeroInsight from '$lib/components/HeroInsight.svelte';
  import QoLRankedList from '$lib/components/QoLRankedList.svelte';
  import IntelligenceModules from '$lib/components/IntelligenceModules.svelte';
  import MethodologyTrustBar from '$lib/components/MethodologyTrustBar.svelte';
  import { computeAllQoL, gradeFromScore, type QoLOverrides } from '$lib/config/city-qol-data';
  import { computeAllScores } from '$lib/config/data-readiness';
  import { CITIES } from '$lib/config/cities';
  import { cityName } from '$lib/utils/qol-format';
  import { formatCompact } from '$lib/utils/format';
  import type { GlobalStats } from '$lib/server/altmo-core';

  interface Props {
    data: {
      qolOverrides: QoLOverrides;
      globalStats: GlobalStats | null;
      activitySummary: { totalTrips: number; totalDistanceKm: number; avgDistanceKm: string; modeBreakdown: { mode: string; count: number; pct: number }[]; directionBreakdown: { direction: string; count: number; pct: number }[] };
    };
  }

  let { data }: Props = $props();

  const allQoL = $derived(computeAllQoL(data.qolOverrides));
  const allReadiness = computeAllScores();

  // ── Hero stat derivations ──
  const avgComposite = $derived(allQoL.reduce((sum, q) => sum + q.composite, 0) / allQoL.length);
  const avgScore = $derived(`${gradeFromScore(avgComposite)} (${Math.round(avgComposite * 100)}/100)`);

  const topCityLabel = $derived.by(() => {
    const top = allQoL[0]; // already sorted highest-first
    return top ? `${cityName(top.cityId)} (${top.grade})` : '—';
  });

  const highestGrade = $derived(allQoL[0]?.grade ?? '—');

  const biggestGap = $derived.by(() => {
    const dimTotals: Record<string, { sum: number; count: number }> = {};
    for (const q of allQoL) {
      for (const d of q.dimensions) {
        if (!dimTotals[d.label]) dimTotals[d.label] = { sum: 0, count: 0 };
        dimTotals[d.label].sum += d.score;
        dimTotals[d.label].count += 1;
      }
    }
    return (
      Object.entries(dimTotals)
        .map(([label, { sum, count }]) => ({ label, avg: sum / count }))
        .sort((a, b) => a.avg - b.avg)[0]?.label ?? '—'
    );
  });

  // ── Cross-city headline ──
  const heroHeadline = $derived(
    `No Indian city scores above ${highestGrade} for transport quality of life`
  );
  const heroSubtitle = $derived(
    `${biggestGap} is the weakest dimension across all ${CITIES.length} cities — cycle infrastructure and bus fleet gaps are holding scores back`
  );

  const platformScale = $derived(
    data.globalStats
      ? `Tracking ${formatCompact(data.globalStats.activitiesCount)}+ activities across ${formatCompact(data.globalStats.people)} active commuters`
      : undefined
  );
</script>

<svelte:head>
  <title>Altmo Intelligence</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

  <!-- Section 1: HeroInsight -->
  <div class="mb-8">
    <HeroInsight
      headline={heroHeadline}
      subtitle={heroSubtitle}
      citiesTracked={CITIES.length.toString()}
      avgQoL={avgScore}
      topCity={topCityLabel}
      {biggestGap}
      {platformScale}
    />
  </div>

  <!-- Section 2: QoL Rankings -->
  <div class="mb-8" id="rankings">
    <h2 class="mb-4 text-xl font-semibold text-text-primary">City QoL Rankings</h2>
    <QoLRankedList overrides={data.qolOverrides} readinessScores={allReadiness} />
  </div>

  <!-- Section 4: Intelligence Modules -->
  <div class="mb-8">
    <h2 class="mb-1 text-xl font-semibold text-text-primary">Explore the Data</h2>
    <p class="mb-4 text-sm text-text-secondary">Dive into transit, activity analytics, impact, and scenario modelling.</p>
    <IntelligenceModules
      globalActivities={data.globalStats?.activitiesCount ?? 0}
      globalUsers={data.globalStats?.people ?? 0}
      globalDistanceKm={data.globalStats?.distanceKm ?? 0}
      globalCo2Kg={data.globalStats?.co2Offset ?? 0}
      routesAnalyzed={data.activitySummary.totalTrips}
    />
  </div>

  <!-- Section 5: Methodology Trust Bar -->
  <MethodologyTrustBar indicatorCount={allQoL[0]?.indicatorsTotal ?? 15} cityCount={CITIES.length} />
</div>
