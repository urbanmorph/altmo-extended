<script lang="ts">
  import MetricCard from '$lib/components/MetricCard.svelte';
  import { formatCompact } from '$lib/utils/format';
  import type { GlobalStats } from '$lib/server/altmo-core';

  interface Props {
    data: {
      stats: GlobalStats | null;
    };
  }

  let { data }: Props = $props();

  const totalTrips = $derived(data.stats ? formatCompact(data.stats.activitiesCount) : '—');
  const activeUsers = $derived(data.stats ? formatCompact(data.stats.people) : '—');
  const avgDistance = $derived(
    data.stats && data.stats.activitiesCount > 0
      ? (data.stats.distanceKm / data.stats.activitiesCount).toFixed(1) + ' km'
      : '—'
  );
  const co2Offset = $derived(data.stats ? formatCompact(data.stats.co2Offset) + ' kg' : '—');
</script>

<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
  <MetricCard label="Total Trips" value={totalTrips} icon="fa-solid fa-person-biking" />
  <MetricCard label="Active Users" value={activeUsers} icon="fa-solid fa-users" />
  <MetricCard label="Avg Distance" value={avgDistance} icon="fa-solid fa-ruler" />
  <MetricCard label="CO2 Offset" value={co2Offset} icon="fa-solid fa-leaf" />
</div>

<div class="mt-8 rounded-xl border border-border bg-surface-card p-6">
  <h2 class="text-lg font-semibold text-text-primary">Transit Analytics</h2>
  <p class="mt-2 text-sm text-text-secondary">
    Explore transit ridership data, station-level activity, and route coverage across cities.
  </p>
  <a
    href="/pulse/transit"
    class="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
  >
    <i class="fa-solid fa-train-subway"></i>
    View Transit Dashboard
  </a>
</div>
