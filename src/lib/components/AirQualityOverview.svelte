<script lang="ts">
  import { CITIES } from '$lib/config/cities';
  import { getPM25Category, PM25_THRESHOLDS, type CityPM25 } from '$lib/config/air-quality';

  interface Props {
    airQuality: Record<string, CityPM25 | null>;
  }

  let { airQuality }: Props = $props();

  const cityEntries = $derived(
    Object.entries(airQuality).map(([id, data]) => ({
      id,
      name: CITIES.find((c) => c.id === id)?.name ?? id,
      data
    }))
  );
</script>

<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  {#each cityEntries as entry (entry.id)}
    <div class="rounded-xl border border-border bg-surface-card p-4">
      <div class="mb-2 flex items-center gap-2">
        <i class="fa-solid fa-wind text-sm text-text-secondary"></i>
        <h3 class="text-sm font-semibold text-text-primary">{entry.name}</h3>
      </div>

      {#if entry.data}
        {@const category = getPM25Category(entry.data.pm25Avg)}
        <div class="flex items-center gap-2">
          <span
            class="inline-block h-3 w-3 shrink-0 rounded-full"
            style="background-color: {category.color}"
            title={category.label}
          ></span>
          <span class="text-2xl font-bold text-text-primary">
            {entry.data.pm25Avg}
          </span>
          <span class="text-xs text-text-secondary">ug/m3</span>
        </div>
        <p class="mt-1 text-xs font-medium" style="color: {category.color}">
          {category.label}
        </p>
        <p class="mt-2 text-[0.65rem] text-text-secondary">
          <i class="fa-solid fa-tower-broadcast mr-0.5"></i>
          {entry.data.stationsReporting} station{entry.data.stationsReporting !== 1 ? 's' : ''} reporting
          &middot; {entry.data.readings} readings
        </p>
      {:else}
        <p class="mt-1 text-sm text-text-secondary">No data</p>
      {/if}
    </div>
  {/each}
</div>

<p class="mt-3 text-[0.65rem] text-text-secondary">
  <i class="fa-solid fa-circle-info mr-0.5"></i>
  Reference: WHO guideline {PM25_THRESHOLDS.who.annual} ug/m3 &middot; India NAAQS {PM25_THRESHOLDS.naaqs.annual} ug/m3
  &middot; Last 24h average from OpenAQ
</p>
