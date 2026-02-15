<script lang="ts">
  import {
    computeCityQoL,
    gradeColor,
    gradeLabel,
    type CityQoLScore,
    type QoLOverrides
  } from '$lib/config/city-qol-data';
  import { computeReadinessScore } from '$lib/config/data-readiness';
  import { CITIES } from '$lib/config/cities';
  import { confidenceIcon, confidenceColor, confidenceLabel, confidenceTooltipLines } from '$lib/utils/qol-format';

  interface Props {
    cityId: string;
    overrides?: QoLOverrides;
  }

  let { cityId, overrides }: Props = $props();

  let qol = $derived(computeCityQoL(cityId, overrides));
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
    if (score >= 0.60) return 'var(--color-altmo-500)';
    if (score >= 0.30) return 'var(--color-tangerine-300)';
    return 'var(--color-tangerine-500)';
  }


  const LIVE_SOURCE_LABELS: Record<string, string> = {
    traffic_fatalities: 'Supabase',
    pm25_annual: 'OpenAQ',
    congestion_level: 'TomTom'
  };

  function isLiveIndicator(indicatorKey: string): boolean {
    return overrides?.[cityId]?.[indicatorKey] !== undefined;
  }

  function liveSourceLabel(indicatorKey: string): string {
    return LIVE_SOURCE_LABELS[indicatorKey] ?? 'live source';
  }

  function liveIndicatorCount(): number {
    return overrides?.[cityId] ? Object.keys(overrides[cityId]).length : 0;
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
      <div class="text-right">
        <div class="flex items-center justify-end gap-2">
          <div class="flex items-center gap-1.5">
            <span class="text-3xl font-bold" style="color: {gradeColor(qol.grade)}">{qol.grade}</span>
            <span class="group relative">
              <i
                class="{confidenceIcon(qol.confidence)} text-xs cursor-default"
                style="color: {confidenceColor(qol.confidence)}"
              ></i>
              {#if qol.confidenceBreakdown}
                <div class="pointer-events-none absolute bottom-full right-0 z-50 mb-2 rounded-lg border border-border bg-surface-card p-3 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 w-56">
                  <p class="text-xs font-semibold text-text-primary">{confidenceLabel(qol.confidence)} ({qol.confidenceBreakdown.score}/100)</p>
                  {#each confidenceTooltipLines(qol.confidenceBreakdown) as f}
                    <div class="mt-1.5 flex items-center justify-between text-[0.65rem]">
                      <span class="text-text-secondary">{f.label}</span>
                      <span class="font-medium text-text-primary">{f.score}%</span>
                    </div>
                    <div class="mt-0.5 h-1 w-full rounded-full bg-earth-100">
                      <div class="h-1 rounded-full bg-primary" style="width: {f.score}%"></div>
                    </div>
                  {/each}
                </div>
              {/if}
            </span>
          </div>
          <span class="text-sm text-text-secondary">{(qol.composite * 100).toFixed(0)}/100</span>
        </div>
        {#if liveIndicatorCount() > 0}
          <p class="text-[0.6rem] text-text-secondary">
            <i class="fa-solid fa-tower-broadcast" style="color: var(--color-altmo-500)"></i>
            {liveIndicatorCount()} of {qol.indicatorsAvailable} live
          </p>
        {/if}
      </div>
    </div>

    <!-- Dimension bars -->
    <div class="mt-3 space-y-2">
      {#each qol.dimensions as dim (dim.key)}
        <div>
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-text-primary">
              {dim.label}
              <span class="font-normal text-text-secondary">({dim.availableCount} of {dim.totalCount} indicators)</span>
            </span>
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
            {#if isLiveIndicator(ind.key)}
              <i
                class="fa-solid fa-tower-broadcast ml-0.5 text-[0.5rem]"
                style="color: var(--color-altmo-500)"
                title="Live data from {liveSourceLabel(ind.key)}"
              ></i>
            {/if}
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
          <span class="font-semibold" style="color: {readiness.total >= 70 ? 'var(--color-altmo-500)' : readiness.total >= 40 ? 'var(--color-tangerine-300)' : 'var(--color-status-unavailable)'}">
            {Math.round(readiness.total)}/{readiness.maxScore}
          </span>
        </a>
      </div>
    {/if}
  </div>
{/if}
