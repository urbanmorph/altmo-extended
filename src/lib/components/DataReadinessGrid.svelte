<script lang="ts">
  import { DATA_LAYERS, CITY_READINESS, type DataStatus } from '$lib/config/data-readiness';
  import { CITIES } from '$lib/config/cities';

  interface Props {
    cityIds?: string[];
  }

  let { cityIds }: Props = $props();

  const displayCities = $derived(
    cityIds ? CITIES.filter((c) => cityIds!.includes(c.id)) : CITIES
  );

  function getStatus(cityId: string, layerKey: string): DataStatus {
    const readiness = CITY_READINESS.find((r) => r.cityId === cityId);
    return readiness?.layers[layerKey] ?? 'unavailable';
  }

  function statusColor(status: DataStatus): string {
    switch (status) {
      case 'available':
        return 'var(--color-status-available)';
      case 'partial':
        return 'var(--color-status-partial)';
      case 'unavailable':
        return 'var(--color-status-unavailable)';
    }
  }

  function statusLabel(status: DataStatus): string {
    switch (status) {
      case 'available':
        return 'Available';
      case 'partial':
        return 'Partial';
      case 'unavailable':
        return 'Unavailable';
    }
  }
</script>

<div class="overflow-x-auto rounded-xl border border-border">
  <table class="w-full text-sm">
    <thead>
      <tr class="border-b border-border bg-earth-50">
        <th class="px-4 py-3 text-left font-medium text-text-secondary">Data Layer</th>
        {#each displayCities as city}
          <th class="px-4 py-3 text-center font-medium text-text-secondary">{city.name}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each DATA_LAYERS as layer}
        <tr class="border-b border-border last:border-0">
          <td class="px-4 py-3 text-text-primary" title={layer.description}>{layer.label}</td>
          {#each displayCities as city}
            {@const status = getStatus(city.id, layer.key)}
            <td class="px-4 py-3 text-center">
              <span
                class="inline-block h-3 w-3 rounded-full"
                style="background-color: {statusColor(status)}"
                title="{city.name}: {layer.label} — {statusLabel(status)}"
              ></span>
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<div class="mt-3 flex items-center gap-4 text-xs text-text-secondary">
  <span class="flex items-center gap-1">
    <span
      class="inline-block h-2.5 w-2.5 rounded-full"
      style="background-color: var(--color-status-available)"
    ></span>
    Available
  </span>
  <span class="flex items-center gap-1">
    <span
      class="inline-block h-2.5 w-2.5 rounded-full"
      style="background-color: var(--color-status-partial)"
    ></span>
    Partial
  </span>
  <span class="flex items-center gap-1">
    <span
      class="inline-block h-2.5 w-2.5 rounded-full"
      style="background-color: var(--color-status-unavailable)"
    ></span>
    Unavailable
  </span>
</div>
