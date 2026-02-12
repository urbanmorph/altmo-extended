<script lang="ts">
  import MetricCard from './MetricCard.svelte';
  import { CITIES } from '$lib/config/cities';
  import { computeAllQoL, gradeFromScore, type QoLOverrides } from '$lib/config/city-qol-data';
  import { computeAllScores } from '$lib/config/data-readiness';

  interface Props {
    overrides?: QoLOverrides;
  }

  let { overrides }: Props = $props();

  const allQoL = $derived(computeAllQoL(overrides));
  const allReadiness = computeAllScores();

  // Cities tracked
  const cityCount = CITIES.length.toString();

  // Average QoL composite -> grade
  const avgScore = $derived.by(() => {
    const avgComposite = allQoL.reduce((sum, q) => sum + q.composite, 0) / allQoL.length;
    const avgGrade = gradeFromScore(avgComposite);
    return `${avgGrade} (${Math.round(avgComposite * 100)}/100)`;
  });

  // Biggest gap: dimension with lowest average score across all cities
  const biggestGap = $derived.by(() => {
    const dimTotals: Record<string, { sum: number; count: number }> = {};
    for (const q of allQoL) {
      for (const d of q.dimensions) {
        if (!dimTotals[d.label]) dimTotals[d.label] = { sum: 0, count: 0 };
        dimTotals[d.label].sum += d.score;
        dimTotals[d.label].count += 1;
      }
    }
    return Object.entries(dimTotals)
      .map(([label, { sum, count }]) => ({ label, avg: sum / count }))
      .sort((a, b) => a.avg - b.avg)[0]?.label ?? '—';
  });

  // Data coverage: mean of readiness totals (out of 100)
  const avgReadiness = allReadiness.reduce((sum, r) => sum + r.total, 0) / allReadiness.length;
  const dataCoverage = `${Math.round(avgReadiness)}%`;
</script>

<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
  <MetricCard label="Cities Tracked" value={cityCount} icon="fa-solid fa-city" />
  <MetricCard label="Average QoL" value={avgScore} icon="fa-solid fa-chart-line" />
  <MetricCard label="Biggest Gap" value={biggestGap} icon="fa-solid fa-triangle-exclamation" />
  <MetricCard label="Data Coverage" value={dataCoverage} icon="fa-solid fa-database" />
</div>
