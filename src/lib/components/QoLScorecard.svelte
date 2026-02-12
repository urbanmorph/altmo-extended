<script lang="ts">
  import {
    computeAllQoL,
    gradeColor,
    gradeLabel,
    type CityQoLScore,
    type QoLOverrides
  } from '$lib/config/city-qol-data';
  import { CITIES } from '$lib/config/cities';

  interface Props {
    overrides?: QoLOverrides;
  }

  let { overrides }: Props = $props();

  const scores = $derived(computeAllQoL(overrides));

  function cityName(cityId: string): string {
    return CITIES.find((c) => c.id === cityId)?.name ?? cityId;
  }

  function fmtValue(value: number | null, unit: string): string {
    if (value === null) return '—';
    if (Number.isInteger(value)) return `${value} ${unit}`;
    return `${value.toFixed(1)} ${unit}`;
  }

  function barPercent(score: number): number {
    return Math.max(0, Math.min(100, score * 100));
  }

  function dimColor(score: number): string {
    if (score >= 0.60) return 'var(--color-altmo-500)';
    if (score >= 0.30) return 'var(--color-tangerine-300)';
    return 'var(--color-tangerine-500)';
  }
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {#each scores as entry (entry.cityId)}
    {@const color = gradeColor(entry.grade)}
    <div class="rounded-xl border border-border bg-surface-card p-5">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-semibold text-text-primary">{cityName(entry.cityId)}</h3>
          <p class="text-xs text-text-secondary">{gradeLabel(entry.grade)}</p>
        </div>
        <div class="text-right">
          <span class="text-3xl font-bold" style="color: {color}">{entry.grade}</span>
          <p class="text-xs text-text-secondary">{(entry.composite * 100).toFixed(0)}/100</p>
        </div>
      </div>

      <div class="mt-4 space-y-3">
        {#each entry.dimensions as dim (dim.key)}
          <div>
            <div class="flex items-center justify-between text-xs">
              <span class="font-medium text-text-primary">
                {dim.label}
                <span class="font-normal text-text-secondary">({(dim.weight * 100).toFixed(0)}%)</span>
              </span>
              <span class="text-text-secondary">{(dim.score * 100).toFixed(0)}</span>
            </div>
            <div class="mt-0.5 h-1.5 w-full rounded-full bg-earth-100">
              <div
                class="h-1.5 rounded-full transition-all"
                style="width: {barPercent(dim.score)}%; background-color: {dimColor(dim.score)}"
              ></div>
            </div>
            <div class="mt-1 flex gap-3 text-[0.65rem] text-text-secondary">
              {#each dim.indicators as ind (ind.key)}
                <span>{ind.label}: <span class="font-medium text-text-primary">{fmtValue(ind.value, ind.unit)}</span></span>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>
