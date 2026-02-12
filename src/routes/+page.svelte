<script lang="ts">
  import QoLHeadlineStats from '$lib/components/QoLHeadlineStats.svelte';
  import QoLRankedList from '$lib/components/QoLRankedList.svelte';
  import AirQualityOverview from '$lib/components/AirQualityOverview.svelte';
  import QoLDataReadinessPaired from '$lib/components/QoLDataReadinessPaired.svelte';
  import SafetyTrends from '$lib/components/SafetyTrends.svelte';
  import IntelligenceModules from '$lib/components/IntelligenceModules.svelte';
  import MethodologyFooter from '$lib/components/MethodologyFooter.svelte';
  import type { QoLOverrides } from '$lib/config/city-qol-data';
  import type { CityPM25 } from '$lib/config/air-quality';

  interface Props {
    data: {
      qolOverrides: QoLOverrides;
      airQuality: Record<string, CityPM25 | null>;
      safetyTrends: Record<string, Array<{ year: number; fatalitiesPerLakh: number }>>;
    };
  }

  let { data }: Props = $props();
</script>

<svelte:head>
  <title>Altmo Intelligence</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-text-primary">Altmo Intelligence</h1>
    <p class="mt-2 text-text-secondary">
      Transport quality of life analytics for Indian cities
    </p>
  </div>

  <div class="mb-8">
    <QoLHeadlineStats overrides={data.qolOverrides} />
  </div>

  <div class="mb-8">
    <h2 class="mb-4 text-xl font-semibold text-text-primary">City QoL Rankings</h2>
    <QoLRankedList overrides={data.qolOverrides} />
  </div>

  <div class="mb-8">
    <h2 class="mb-4 text-xl font-semibold text-text-primary">Air Quality (Live)</h2>
    <AirQualityOverview airQuality={data.airQuality} />
  </div>

  <div class="mb-8">
    <h2 class="mb-4 text-xl font-semibold text-text-primary">Safety Trends</h2>
    <SafetyTrends trends={data.safetyTrends} />
  </div>

  <div class="mb-8">
    <h2 class="mb-4 text-xl font-semibold text-text-primary">QoL + Data Readiness</h2>
    <QoLDataReadinessPaired overrides={data.qolOverrides} />
  </div>

  <div class="mb-8">
    <h2 class="mb-4 text-xl font-semibold text-text-primary">Intelligence Modules</h2>
    <IntelligenceModules />
  </div>

  <MethodologyFooter />
</div>
