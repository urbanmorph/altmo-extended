<script lang="ts">
  import MetricCard from '$lib/components/MetricCard.svelte';
</script>

<svelte:head>
  <title>Impact — Altmo Intelligence</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <h1 class="text-2xl font-bold text-text-primary">Impact</h1>
  <p class="mt-1 text-text-secondary">ESG impact metrics and sustainability reporting.</p>

  <div class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
    <MetricCard label="CO₂ Offset" value="—" icon="🌍" />
    <MetricCard label="Calories Burned" value="—" icon="🔥" />
    <MetricCard label="Cars Off Road" value="—" icon="🚗" />
    <MetricCard label="Active Companies" value="—" icon="🏢" />
  </div>

  <div class="mt-8 rounded-xl border border-border bg-surface-card p-6">
    <h2 class="text-lg font-semibold text-text-primary">Company Leaderboard</h2>
    <p class="mt-2 text-sm text-text-secondary">
      Connect to Supabase to view company impact rankings.
    </p>
  </div>
</div>
