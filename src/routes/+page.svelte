<script lang="ts">
  import QoLRankedList from '$lib/components/QoLRankedList.svelte';
  import MethodologyTrustBar from '$lib/components/MethodologyTrustBar.svelte';
  import { computeAllQoL, type QoLOverrides } from '$lib/config/city-qol-data';
  import { computeAllScores } from '$lib/config/data-readiness';
  import { CITIES } from '$lib/config/cities';

  interface Props {
    data: {
      qolOverrides: QoLOverrides;
    };
  }

  let { data }: Props = $props();

  const allQoL = $derived(computeAllQoL(data.qolOverrides));
  const allReadiness = computeAllScores();
</script>

<svelte:head>
  <title>Altmo Intelligence</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

  <!-- Hero: simple heading -->
  <div class="mb-10 text-center">
    <h1 class="text-3xl font-bold text-text-primary sm:text-4xl">Transport Quality of Life Ranking</h1>
    <p class="mt-2 text-base text-text-secondary">
      Ranking {CITIES.length} Indian cities on transport quality of life — powered by open data and real activity traces.
    </p>
  </div>

  <!-- Leaderboard -->
  <div class="mb-10" id="rankings">
    <QoLRankedList overrides={data.qolOverrides} readinessScores={allReadiness} />
  </div>

  <!-- Methodology Trust Bar -->
  <MethodologyTrustBar indicatorCount={allQoL[0]?.indicatorsTotal ?? 15} cityCount={CITIES.length} />
</div>
