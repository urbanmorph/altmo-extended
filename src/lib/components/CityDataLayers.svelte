<script lang="ts">
  import {
    DATA_LAYERS,
    getReadiness,
    type DataStatus
  } from '$lib/config/data-readiness';

  interface Props {
    cityId: string;
  }

  let { cityId }: Props = $props();

  let readiness = $derived(getReadiness(cityId));
  let expanded = $state(false);

  function statusColor(status: DataStatus): string {
    const colors: Record<DataStatus, string> = {
      available: 'var(--color-status-available)',
      partial: 'var(--color-status-partial)',
      unavailable: 'var(--color-status-unavailable)'
    };
    return colors[status];
  }

  function statusLabel(status: DataStatus): string {
    const labels: Record<DataStatus, string> = {
      available: 'Available',
      partial: 'Partial',
      unavailable: 'Unavailable'
    };
    return labels[status];
  }

  let summary = $derived(() => {
    if (!readiness) return { available: 0, partial: 0, unavailable: 0 };
    const layers = readiness.layers;
    let available = 0;
    let partial = 0;
    let unavailable = 0;
    for (const key of Object.keys(layers)) {
      const status = layers[key];
      if (status === 'available') available++;
      else if (status === 'partial') partial++;
      else unavailable++;
    }
    return { available, partial, unavailable };
  });
</script>

{#if readiness}
  <div class="rounded-xl border border-border bg-surface-card p-5">
    <!-- Header with toggle -->
    <button
      type="button"
      class="flex w-full items-center justify-between text-left"
      onclick={() => expanded = !expanded}
    >
      <div>
        <h3 class="text-sm font-semibold text-text-primary">Data Layers</h3>
        <p class="mt-0.5 text-xs text-text-secondary">
          <span style="color: var(--color-status-available)">{summary().available}</span> available,
          <span style="color: var(--color-status-partial)">{summary().partial}</span> partial,
          <span style="color: var(--color-status-unavailable)">{summary().unavailable}</span> unavailable
        </p>
      </div>
      <i class="fa-solid fa-chevron-{expanded ? 'up' : 'down'} text-xs text-text-secondary"></i>
    </button>

    <!-- Expanded layer list -->
    {#if expanded}
      <div class="mt-3 space-y-2 border-t border-border pt-3">
        {#each DATA_LAYERS as layer (layer.key)}
          {@const status = readiness.layers[layer.key] ?? 'unavailable'}
          <div class="flex items-start gap-2">
            <span
              class="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
              style="background-color: {statusColor(status)}"
              title={statusLabel(status)}
            ></span>
            <div class="min-w-0">
              <p class="text-xs font-medium text-text-primary">{layer.label}</p>
              <p class="text-[0.65rem] text-text-secondary">{layer.description}</p>
            </div>
            <span
              class="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] font-medium text-white"
              style="background-color: {statusColor(status)}"
            >
              {statusLabel(status)}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}
