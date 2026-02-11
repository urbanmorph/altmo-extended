<svelte:head>
  <title>Routes — Altmo Intelligence</title>
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl/dist/maplibre-gl.css" />
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <h1 class="text-2xl font-bold text-text-primary">Routes</h1>
  <p class="mt-1 text-text-secondary">Route optimization and infrastructure planning insights.</p>

  <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
    <div class="rounded-xl border border-border bg-surface-card p-6">
      <h2 class="text-lg font-semibold text-text-primary">Popular Corridors</h2>
      <p class="mt-2 text-sm text-text-secondary">
        Top cycling corridors ranked by usage frequency.
      </p>
    </div>
    <div class="rounded-xl border border-border bg-surface-card p-6">
      <h2 class="text-lg font-semibold text-text-primary">Infrastructure Gaps</h2>
      <p class="mt-2 text-sm text-text-secondary">
        Areas with high demand but low cycling infrastructure.
      </p>
    </div>
  </div>
</div>
