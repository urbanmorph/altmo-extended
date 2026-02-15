<script lang="ts">
  import { computeAllQoL, gradeColor, gradeLabel, type ConfidenceTier, type QoLOverrides } from '$lib/config/city-qol-data';
  import { computeAllGaps } from '$lib/config/city-qol-gaps';
  import { CITY_READINESS, type ReadinessScore, type DataStatus } from '$lib/config/data-readiness';
  import { cityName, fmtIndicatorValue, barPercent, dimensionColor, readinessScoreColor } from '$lib/utils/qol-format';

  interface Props {
    overrides?: QoLOverrides;
    readinessScores?: ReadinessScore[];
  }

  let { overrides, readinessScores }: Props = $props();

  function getReadiness(cityId: string) {
    return readinessScores?.find((r) => r.cityId === cityId);
  }

  function readinessDotColor(total: number): string {
    if (total >= 70) return 'var(--color-status-available)';
    if (total >= 40) return 'var(--color-status-partial)';
    return 'var(--color-status-unavailable)';
  }

  function countLayers(cityId: string, status: DataStatus): number {
    const city = CITY_READINESS.find((r) => r.cityId === cityId);
    if (!city) return 0;
    return Object.values(city.layers).filter((s) => s === status).length;
  }

  function missingLayerNames(cityId: string): string[] {
    const city = CITY_READINESS.find((r) => r.cityId === cityId);
    if (!city) return [];
    return Object.entries(city.layers)
      .filter(([, s]) => s === 'unavailable' || s === 'partial')
      .map(([key]) => key.replace(/_/g, ' '));
  }

  const scores = $derived(computeAllQoL(overrides));
  const gaps = $derived(computeAllGaps(overrides));

  function getGap(cityId: string) {
    return gaps.find((g) => g.cityId === cityId);
  }

  function confidenceIcon(tier: ConfidenceTier): string {
    if (tier === 'gold') return 'fa-solid fa-certificate';
    if (tier === 'silver') return 'fa-solid fa-certificate';
    return 'fa-solid fa-circle-half-stroke';
  }

  function confidenceColor(tier: ConfidenceTier): string {
    if (tier === 'gold') return '#D4AF37';
    if (tier === 'silver') return '#9CA3AF';
    return '#CD7F32';
  }

  function confidenceLabel(tier: ConfidenceTier): string {
    if (tier === 'gold') return 'Gold';
    if (tier === 'silver') return 'Silver';
    return 'Bronze';
  }

  const LIVE_SOURCE_LABELS: Record<string, string> = {
    traffic_fatalities: 'Supabase',
    pm25_annual: 'OpenAQ',
    congestion_level: 'TomTom'
  };

  function isLiveIndicator(cityId: string, indicatorKey: string): boolean {
    return overrides?.[cityId]?.[indicatorKey] !== undefined;
  }

  function liveSourceLabel(indicatorKey: string): string {
    return LIVE_SOURCE_LABELS[indicatorKey] ?? 'live source';
  }

  function liveIndicatorCount(cityId: string): number {
    return overrides?.[cityId] ? Object.keys(overrides[cityId]).length : 0;
  }

  let expandedIndex = $state(-1);

  function toggle(index: number) {
    expandedIndex = expandedIndex === index ? -1 : index;
  }
</script>

<div class="space-y-3">
  {#each scores as entry, i (entry.cityId)}
    {@const rank = i + 1}
    {@const color = gradeColor(entry.grade)}
    {@const gap = getGap(entry.cityId)}
    {@const expanded = expandedIndex === i}
    {@const readinessEntry = getReadiness(entry.cityId)}

    <div class="rounded-xl border border-border bg-surface-card transition-shadow" class:shadow-md={expanded}>
      <!-- Collapsed header -->
      <button
        class="flex w-full items-center gap-4 p-4 text-left"
        onclick={() => toggle(i)}
      >
        <!-- Rank badge -->
        <span
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style="background-color: {color}"
        >
          {rank}
        </span>

        <!-- City name + upgrade path teaser + scorecard link -->
        <div class="min-w-0 flex-1">
          <h3 class="font-semibold text-text-primary">{cityName(entry.cityId)}</h3>
          {#if gap}
            <p class="truncate text-xs text-text-secondary">
              <i class="fa-solid fa-arrow-up-right-dots mr-0.5 text-[0.6rem]" style="color: {color}"></i>
              {gap.upgradeSentence}
            </p>
          {/if}
          <a
            href="/city/{entry.cityId}"
            class="mt-1 inline-flex items-center gap-1 text-[0.7rem] font-medium text-primary hover:text-primary-dark hover:underline"
            onclick={(e) => e.stopPropagation()}
          >
            View scorecard <i class="fa-solid fa-arrow-right text-[0.55rem]"></i>
          </a>
        </div>

        <!-- Grade + score + confidence -->
        <div class="shrink-0 text-right">
          <div class="flex items-center justify-end gap-1">
            <span class="text-2xl font-bold" style="color: {color}">{entry.grade}</span>
            <i
              class="{confidenceIcon(entry.confidence)} text-xs"
              style="color: {confidenceColor(entry.confidence)}"
              title="{confidenceLabel(entry.confidence)} confidence ({entry.indicatorsAvailable} of {entry.indicatorsTotal} indicators)"
            ></i>
          </div>
          <p class="text-xs text-text-secondary">{Math.round(entry.composite * 100)}/100</p>
          {#if liveIndicatorCount(entry.cityId) > 0}
            <p class="text-[0.6rem] text-text-secondary">
              <i class="fa-solid fa-tower-broadcast" style="color: var(--color-altmo-500)"></i>
              {liveIndicatorCount(entry.cityId)} of {entry.indicatorsAvailable} live
            </p>
          {/if}
          {#if readinessEntry}
            <p class="text-[0.6rem] text-text-secondary" title="Data readiness: {countLayers(entry.cityId, 'available')} available, {countLayers(entry.cityId, 'partial')} partial, {countLayers(entry.cityId, 'unavailable')} missing layers">
              <span class="mr-0.5 inline-block h-1.5 w-1.5 rounded-full" style="background-color: {readinessDotColor(readinessEntry.total)}"></span>
              {Math.round(readinessEntry.total)}%
            </p>
          {/if}
        </div>

        <!-- Chevron -->
        <i
          class="fa-solid fa-chevron-down shrink-0 text-text-secondary transition-transform duration-200"
          class:rotate-180={expanded}
        ></i>
      </button>

      <!-- Expanded detail -->
      {#if expanded}
        <div class="border-t border-border px-4 pb-4 pt-3">
          <!-- Dimension breakdown -->
          <div class="space-y-3">
            {#each entry.dimensions as dim (dim.key)}
              <div>
                <div class="flex items-center justify-between text-xs">
                  <span class="font-medium text-text-primary">
                    {dim.label}
                    <span class="font-normal text-text-secondary">({Math.round(dim.weight * 100)}%)</span>
                    <span class="font-normal text-text-secondary">&middot; {dim.availableCount} of {dim.totalCount} indicators</span>
                  </span>
                  <span class="text-text-secondary">{Math.round(dim.score * 100)}/100</span>
                </div>
                <div class="mt-0.5 h-1.5 w-full rounded-full bg-earth-100">
                  <div
                    class="h-1.5 rounded-full transition-all"
                    style="width: {barPercent(dim.score)}%; background-color: {dimensionColor(dim.score)}"
                  ></div>
                </div>
                <div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.65rem] text-text-secondary">
                  {#each dim.indicators as ind (ind.key)}
                    <span>
                      {ind.label}: <span class="font-medium text-text-primary">{fmtIndicatorValue(ind.value, ind.unit)}</span>
                      {#if isLiveIndicator(entry.cityId, ind.key)}
                        <i
                          class="fa-solid fa-tower-broadcast ml-0.5 text-[0.5rem]"
                          style="color: var(--color-altmo-500)"
                          title="Live data from {liveSourceLabel(ind.key)}"
                        ></i>
                      {/if}
                    </span>
                  {/each}
                </div>
              </div>
            {/each}
          </div>

          <!-- Data gap strip -->
          {#if readinessEntry}
            {@const missingLayers = missingLayerNames(entry.cityId)}
            <div class="mt-4 rounded-lg bg-earth-50 p-3">
              <div class="flex items-center justify-between text-xs">
                <span class="font-medium text-text-primary">
                  <i class="fa-solid fa-database mr-1 text-text-secondary"></i>
                  Data Readiness
                </span>
                <span class="font-bold" style="color: {readinessScoreColor(readinessEntry.total)}">{Math.round(readinessEntry.total)}/100</span>
              </div>
              <div class="mt-1.5 h-1.5 w-full rounded-full bg-earth-100">
                <div
                  class="h-1.5 rounded-full transition-all"
                  style="width: {readinessEntry.total}%; background-color: {readinessScoreColor(readinessEntry.total)}"
                ></div>
              </div>
              {#if missingLayers.length > 0}
                <p class="mt-1.5 text-[0.65rem] text-text-secondary">
                  Missing/partial: {missingLayers.join(', ')}
                </p>
              {/if}
            </div>
          {/if}

          <!-- Upgrade path + recommendation -->
          {#if gap}
            <div class="mt-4 rounded-lg border p-3" style="border-color: {color}30; background-color: {color}08">
              <p class="text-xs font-medium text-text-primary">
                <i class="fa-solid fa-arrow-up-right-dots mr-1" style="color: {color}"></i>
                {gap.upgradeSentence}
              </p>
            </div>
            <div class="mt-2 rounded-lg border border-border bg-earth-50 p-3">
              <p class="text-xs text-text-secondary">
                <i class="fa-solid fa-triangle-exclamation mr-1 text-tangerine-500"></i>
                <span class="font-medium text-text-primary">Biggest gap:</span> {gap.gapSentence}
              </p>
              <p class="mt-1.5 text-xs text-text-secondary">
                <i class="fa-solid fa-lightbulb mr-1 text-tangerine-500"></i>
                {gap.recommendation}
              </p>
            </div>
          {/if}

          <!-- Link to city deep-dive -->
          <div class="mt-4">
            <a
              href="/city/{entry.cityId}"
              class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-dark"
            >
              View city scorecard
              <i class="fa-solid fa-arrow-right text-xs"></i>
            </a>
          </div>
        </div>
      {/if}
    </div>
  {/each}
</div>
