<script lang="ts">
  import { page } from '$app/state';
  import MetricCard from '$lib/components/MetricCard.svelte';
</script>

<svelte:head>
  <title>Company — Altmo Intelligence</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <nav class="mb-4 text-sm text-text-secondary">
    <a href="/impact" class="hover:text-primary">Impact</a>
    <span class="mx-1">/</span>
    <span class="text-text-primary">Company {page.params.id}</span>
  </nav>

  <h1 class="text-2xl font-bold text-text-primary">Company Details</h1>
  <p class="mt-1 text-text-secondary">Impact metrics for company ID: {page.params.id}</p>

  <div class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
    <MetricCard label="Employees Active" value="—" />
    <MetricCard label="Total Distance" value="—" />
    <MetricCard label="CO₂ Saved" value="—" />
    <MetricCard label="Engagement Rate" value="—" />
  </div>
</div>
