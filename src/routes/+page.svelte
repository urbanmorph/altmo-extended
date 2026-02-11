<script lang="ts">
  import MetricCard from '$lib/components/MetricCard.svelte';
  import DataReadinessGrid from '$lib/components/DataReadinessGrid.svelte';
</script>

<svelte:head>
  <title>Altmo Intelligence</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-text-primary">Altmo Intelligence</h1>
    <p class="mt-2 text-text-secondary">
      Active mobility analytics for government decision-makers.
    </p>
  </div>

  <div class="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
    <MetricCard label="Active Users" value="—" icon="fa-solid fa-user" />
    <MetricCard label="Total Trips" value="—" icon="fa-solid fa-bicycle" />
    <MetricCard label="Distance Covered" value="—" icon="fa-solid fa-ruler" />
    <MetricCard label="CO₂ Saved" value="—" icon="fa-solid fa-seedling" />
  </div>

  <h2 class="mb-4 text-xl font-semibold text-text-primary">Intelligence Modules</h2>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <a href="/access" class="group rounded-xl border border-border bg-surface-card p-6 transition-shadow hover:shadow-md">
      <h3 class="font-semibold text-primary group-hover:text-primary-dark">Access</h3>
      <p class="mt-1 text-sm text-text-secondary">First/last mile access to transit — walking and cycling catchments.</p>
    </a>
    <a href="/pulse" class="group rounded-xl border border-border bg-surface-card p-6 transition-shadow hover:shadow-md">
      <h3 class="font-semibold text-primary group-hover:text-primary-dark">Pulse</h3>
      <p class="mt-1 text-sm text-text-secondary">Trip analysis, commute patterns, and mobility trends.</p>
    </a>
    <a href="/impact" class="group rounded-xl border border-border bg-surface-card p-6 transition-shadow hover:shadow-md">
      <h3 class="font-semibold text-primary group-hover:text-primary-dark">Impact</h3>
      <p class="mt-1 text-sm text-text-secondary">ESG impact metrics and company-level reporting.</p>
    </a>
    <a href="/routes" class="group rounded-xl border border-border bg-surface-card p-6 transition-shadow hover:shadow-md">
      <h3 class="font-semibold text-primary group-hover:text-primary-dark">Routes</h3>
      <p class="mt-1 text-sm text-text-secondary">Route optimization and infrastructure planning.</p>
    </a>
    <a href="/forecast" class="group rounded-xl border border-border bg-surface-card p-6 transition-shadow hover:shadow-md">
      <h3 class="font-semibold text-primary group-hover:text-primary-dark">Forecast</h3>
      <p class="mt-1 text-sm text-text-secondary">Demand predictions and growth modelling.</p>
    </a>
  </div>

  <div class="mt-8">
    <h2 class="mb-2 text-xl font-semibold text-text-primary">Data Readiness</h2>
    <p class="mb-4 text-text-secondary">Data layer availability across cities. Green = available, amber = partial, red = unavailable.</p>
    <DataReadinessGrid />
  </div>
</div>
