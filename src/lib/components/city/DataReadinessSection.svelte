<script lang="ts">
  interface LayerInfo {
    name: string;
    status: string;
  }

  interface ReadinessData {
    score: number;
    layers: LayerInfo[];
  }

  interface Props {
    readiness: ReadinessData | null;
    confidence: string | null;
  }

  let { readiness, confidence }: Props = $props();

  const statusColors: Record<string, string> = {
    available: '#01AA14',
    partial: '#FFB31C',
    unavailable: '#dc2626'
  };

  const statusLabels: Record<string, string> = {
    available: 'Available',
    partial: 'Partial',
    unavailable: 'Unavailable'
  };

  const statusIcons: Record<string, string> = {
    available: 'fa-solid fa-circle-check',
    partial: 'fa-solid fa-circle-half-stroke',
    unavailable: 'fa-solid fa-circle-xmark'
  };

  const readinessPercent = $derived(readiness ? Math.round(readiness.score) : 0);

  const availableCount = $derived(readiness ? readiness.layers.filter((l) => l.status === 'available').length : 0);
  const partialCount = $derived(readiness ? readiness.layers.filter((l) => l.status === 'partial').length : 0);
  const unavailableCount = $derived(readiness ? readiness.layers.filter((l) => l.status === 'unavailable').length : 0);

  const confidenceExplanation = $derived.by(() => {
    if (!confidence) return '';
    const explanations: Record<string, string> = {
      gold: 'Gold confidence: more than 80% of the 18 ETQOLI indicators have measured data. Scores are highly reliable.',
      silver: 'Silver confidence: 60-80% of indicators have measured data. Scores are reasonably reliable with some estimation.',
      bronze: 'Bronze confidence: fewer than 60% of indicators have measured data. Scores are indicative but should be interpreted with caution.'
    };
    return explanations[confidence] ?? '';
  });
</script>

<section id="data" class="scroll-mt-16">
  <h2 class="mb-6 text-xl font-bold text-text-primary">
    <i class="fa-solid fa-database mr-2 text-altmo-700"></i>
    Know Your Data
  </h2>

  {#if readiness}
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Score summary -->
      <div class="rounded-xl border border-border bg-surface-card p-6 shadow-sm">
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-text-secondary">Data Readiness</h3>
        <div class="flex flex-col items-center">
          <div class="relative flex h-28 w-28 items-center justify-center">
            <svg viewBox="0 0 36 36" class="h-28 w-28">
              <path
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#e8e5dc"
                stroke-width="3"
              />
              <path
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#008409"
                stroke-width="3"
                stroke-dasharray="{readinessPercent}, 100"
                stroke-linecap="round"
              />
            </svg>
            <span class="absolute text-2xl font-bold text-text-primary">{readinessPercent}%</span>
          </div>
          <div class="mt-4 flex gap-4 text-xs text-text-secondary">
            <span><i class="fa-solid fa-circle-check mr-1 text-status-available"></i>{availableCount}</span>
            <span><i class="fa-solid fa-circle-half-stroke mr-1 text-status-partial"></i>{partialCount}</span>
            <span><i class="fa-solid fa-circle-xmark mr-1 text-status-unavailable"></i>{unavailableCount}</span>
          </div>
        </div>

        {#if confidenceExplanation}
          <p class="mt-4 text-xs text-text-secondary">{confidenceExplanation}</p>
        {/if}
      </div>

      <!-- Layer breakdown table -->
      <div class="rounded-xl border border-border bg-surface-card p-6 shadow-sm lg:col-span-2">
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-text-secondary">Per-Layer Breakdown</h3>
        <div class="space-y-2">
          {#each readiness.layers as layer}
            <div class="flex items-center justify-between rounded-lg px-3 py-2 odd:bg-earth-50">
              <span class="text-sm text-text-primary">{layer.name}</span>
              <span class="flex items-center gap-2 text-xs font-medium" style="color: {statusColors[layer.status] ?? '#999'};">
                <i class="{statusIcons[layer.status] ?? 'fa-solid fa-circle-question'}"></i>
                {statusLabels[layer.status] ?? layer.status}
              </span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {:else}
    <div class="rounded-xl border border-border bg-surface-card p-8 text-center">
      <i class="fa-solid fa-circle-question text-3xl text-text-secondary"></i>
      <p class="mt-2 text-text-secondary">Data readiness information is not available for this city.</p>
    </div>
  {/if}
</section>
