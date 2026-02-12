<script lang="ts">
  import {
    computeCityQoL,
    gradeColor,
    gradeLabel,
    type CityQoLScore
  } from '$lib/config/city-qol-data';
  import { computeReadinessScore } from '$lib/config/data-readiness';
  import { CITIES } from '$lib/config/cities';

  interface Props {
    cityId: string;
  }

  let { cityId }: Props = $props();

  let qol = $derived(computeCityQoL(cityId));
  let readiness = $derived(computeReadinessScore(cityId));

  function cityName(id: string): string {
    return CITIES.find((c) => c.id === id)?.name ?? id;
  }

  function fmtValue(value: number | null, unit: string): string {
    if (value === null) return '\u2014';
    if (Number.isInteger(value)) return `${value} ${unit}`;
    return `${value.toFixed(1)} ${unit}`;
  }

  function barPercent(score: number): number {
    return Math.max(0, Math.min(100, score * 100));
  }

  function dimColor(score: number): string {
    if (score >= 0.6) return 'var(--color-status-available)';
    if (score >= 0.4) return 'var(--color-status-partial)';
    return 'var(--color-status-unavailable)';
  }
</script>

{#if qol}
  <div class="rounded-xl border border-border bg-surface-card p-5">
    <!-- Header: City name, grade, composite score -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-sm font-semibold text-text-primary">Transport QoL</h3>
        <p class="text-xs text-text-secondary">{gradeLabel(qol.grade)}</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-3xl font-bold" style="color: {gradeColor(qol.grade)}">{qol.grade}</span>
        <span class="text-sm text-text-secondary">{(qol.composite * 100).toFixed(0)}/100</span>
      </div>
    </div>

    <!-- Dimension bars -->
    <div class="mt-3 space-y-2">
      {#each qol.dimensions as dim (dim.key)}
        <div>
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-text-primary">{dim.label}</span>
            <span class="text-text-secondary">{(dim.score * 100).toFixed(0)}</span>
          </div>
          <div class="mt-0.5 h-1.5 w-full rounded-full bg-earth-100">
            <div
              class="h-1.5 rounded-full transition-all"
              style="width: {barPercent(dim.score)}%; background-color: {dimColor(dim.score)}"
            ></div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Key indicator values -->
    <div class="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
      {#each qol.dimensions as dim (dim.key)}
        {#each dim.indicators as ind (ind.key)}
          <span class="text-[0.65rem] text-text-secondary">
            {ind.label}: <span class="font-medium text-text-primary">{fmtValue(ind.value, ind.unit)}</span>
          </span>
        {/each}
      {/each}
    </div>

    <!-- Data readiness link -->
    {#if readiness}
      <div class="mt-3 border-t border-border pt-3">
        <a href="/" class="flex items-center justify-between text-xs text-text-secondary hover:text-primary transition-colors">
          <span class="flex items-center gap-1.5">
            <i class="fa-solid fa-database"></i>
            Data Readiness
          </span>
          <span class="font-semibold" style="color: {readiness.total >= 70 ? 'var(--color-status-available)' : readiness.total >= 40 ? 'var(--color-status-partial)' : 'var(--color-status-unavailable)'}">
            {Math.round(readiness.total)}/{readiness.maxScore}
          </span>
        </a>
      </div>
    {/if}
  </div>
{/if}
