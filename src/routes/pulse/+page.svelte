<script lang="ts">
  import MetricCard from '$lib/components/MetricCard.svelte';
</script>

<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
  <MetricCard label="Total Trips" value="—" />
  <MetricCard label="Avg Distance" value="—" />
  <MetricCard label="Avg Duration" value="—" />
  <MetricCard label="Active Users" value="—" />
</div>

<div class="mt-8 rounded-xl border border-border bg-surface-card p-6">
  <h2 class="text-lg font-semibold text-text-primary">Activity Summary</h2>
  <p class="mt-2 text-sm text-text-secondary">
    Connect to Supabase to view real-time mobility data.
  </p>
</div>
