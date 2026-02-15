<script lang="ts">
  import { computeAllQoL, gradeColor, gradeLabel, type QoLOverrides } from '$lib/config/city-qol-data';
  import { computeAllGaps } from '$lib/config/city-qol-gaps';
  import { CITY_READINESS, type ReadinessScore, type DataStatus } from '$lib/config/data-readiness';
  import { cityName, cityRegionSubtitle, fmtIndicatorValue, barPercent, dimensionColor, readinessScoreColor, confidenceIcon, confidenceColor, confidenceLabel, confidenceTooltipLines } from '$lib/utils/qol-format';

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

  import { goto } from '$app/navigation';

  let expandedIndex = $state(-1);

  function toggle(index: number) {
    expandedIndex = expandedIndex === index ? -1 : index;
  }

  function handleCardClick(cityId: string, index: number) {
    // Single click: navigate to city page. Toggle via chevron only.
    goto(`/city/${cityId}`);
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
      <!-- Collapsed header — click navigates to city, chevron expands details -->
      <button
        class="w-full text-left cursor-pointer hover:bg-earth-50 transition-colors rounded-xl p-4 sm:p-5"
        onclick={() => handleCardClick(entry.cityId, i)}
      >
        <!-- Top row: rank + city + grade + chevron -->
        <div class="flex items-center gap-3 sm:gap-4">
          <!-- Rank badge -->
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white sm:h-10 sm:w-10 sm:text-base"
            style="background-color: {color}"
          >
            {rank}
          </span>

          <!-- City name -->
          <div class="min-w-0 flex-1">
            <h3 class="text-base font-semibold text-text-primary sm:text-lg">{cityName(entry.cityId)}</h3>
            {#if cityRegionSubtitle(entry.cityId)}
              <p class="text-xs text-text-secondary">{cityRegionSubtitle(entry.cityId)}</p>
            {/if}
            {#if gap}
              <p class="truncate text-xs text-text-secondary sm:text-sm">
                <i class="fa-solid fa-arrow-up-right-dots mr-0.5 text-[0.6rem]" style="color: {color}"></i>
                {gap.upgradeSentence}
              </p>
            {/if}
          </div>

          <!-- Grade + score -->
          <div class="shrink-0 text-right">
            <span class="text-3xl font-bold sm:text-4xl" style="color: {color}">{entry.grade}</span>
            <p class="text-xs text-text-secondary sm:text-sm">{Math.round(entry.composite * 100)}/100</p>
          </div>

          <!-- Chevron (expand/collapse details) -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span
            role="button"
            tabindex="0"
            class="shrink-0 rounded-md p-1.5 text-text-secondary hover:bg-earth-100 hover:text-text-primary transition-colors cursor-pointer"
            onclick={(e) => { e.stopPropagation(); toggle(i); }}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); toggle(i); } }}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            <i
              class="fa-solid fa-chevron-down transition-transform duration-200"
              class:rotate-180={expanded}
            ></i>
          </span>
        </div>

        <!-- Dimension bars — visible on desktop, hidden on mobile -->
        <div class="mt-3 hidden gap-3 sm:grid sm:grid-cols-4">
          {#each entry.dimensions as dim (dim.key)}
            <div>
              <div class="flex items-center justify-between text-xs text-text-secondary">
                <span class="font-medium">{dim.label}</span>
                <span>{Math.round(dim.score * 100)}</span>
              </div>
              <div class="mt-1 h-1.5 w-full rounded-full bg-earth-100">
                <div
                  class="h-1.5 rounded-full"
                  style="width: {barPercent(dim.score)}%; background-color: {dimensionColor(dim.score)}"
                ></div>
              </div>
            </div>
          {/each}
        </div>

        <!-- Meta badges row -->
        <div class="mt-2 flex flex-wrap items-center gap-2 sm:mt-3">
          {#if liveIndicatorCount(entry.cityId) > 0}
            <span class="group relative inline-flex items-center gap-1 rounded-full bg-altmo-50 px-2 py-0.5 text-[0.65rem] text-altmo-800 sm:text-xs cursor-default">
              <i class="fa-solid fa-tower-broadcast text-[0.55rem]" style="color: var(--color-altmo-500)"></i>
              {liveIndicatorCount(entry.cityId)}/{entry.indicatorsAvailable} live
              <div class="pointer-events-none absolute bottom-full left-0 z-50 mb-2 rounded-lg border border-border bg-surface-card p-3 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 w-52">
                <p class="text-xs font-semibold text-text-primary">
                  <i class="fa-solid fa-tower-broadcast mr-1" style="color: var(--color-altmo-500)"></i>
                  Live Data Sources
                </p>
                {#each entry.dimensions as dim}
                  {#each dim.indicators as ind}
                    {#if isLiveIndicator(entry.cityId, ind.key)}
                      <div class="mt-1.5 flex items-center justify-between text-[0.65rem]">
                        <span class="text-text-secondary">{ind.label}</span>
                        <span class="font-medium text-altmo-700">{liveSourceLabel(ind.key)}</span>
                      </div>
                    {/if}
                  {/each}
                {/each}
              </div>
            </span>
          {/if}
          {#if readinessEntry}
            {@const avail = countLayers(entry.cityId, 'available')}
            {@const partial = countLayers(entry.cityId, 'partial')}
            {@const missing = countLayers(entry.cityId, 'unavailable')}
            {@const missingNames = missingLayerNames(entry.cityId)}
            <span class="group relative inline-flex items-center gap-1 rounded-full bg-earth-50 px-2 py-0.5 text-[0.65rem] text-text-secondary sm:text-xs cursor-default">
              <span class="inline-block h-1.5 w-1.5 rounded-full" style="background-color: {readinessDotColor(readinessEntry.total)}"></span>
              {Math.round(readinessEntry.total)}% data
              <div class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-lg border border-border bg-surface-card p-3 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 w-56">
                <p class="text-xs font-semibold text-text-primary">
                  <i class="fa-solid fa-database mr-1 text-text-secondary"></i>
                  Data Readiness ({Math.round(readinessEntry.total)}%)
                </p>
                <div class="mt-1.5 flex items-center justify-between text-[0.65rem]">
                  <span class="text-text-secondary">Available layers</span>
                  <span class="font-medium text-text-primary">{avail}</span>
                </div>
                <div class="mt-1 flex items-center justify-between text-[0.65rem]">
                  <span class="text-text-secondary">Partial layers</span>
                  <span class="font-medium text-text-primary">{partial}</span>
                </div>
                <div class="mt-1 flex items-center justify-between text-[0.65rem]">
                  <span class="text-text-secondary">Missing layers</span>
                  <span class="font-medium text-text-primary">{missing}</span>
                </div>
                {#if missingNames.length > 0}
                  <p class="mt-2 text-[0.6rem] text-text-secondary">
                    <i class="fa-solid fa-circle-exclamation mr-0.5 text-tangerine-400"></i>
                    Gaps: {missingNames.join(', ')}
                  </p>
                {/if}
              </div>
            </span>
          {/if}
          <span class="group relative inline-flex items-center gap-1 rounded-full bg-earth-50 px-2 py-0.5 text-[0.65rem] text-text-secondary sm:text-xs cursor-default">
            <i class="fa-solid fa-certificate text-[0.55rem]" style="color: {confidenceColor(entry.confidence)}"></i>
            {confidenceLabel(entry.confidence)}{#if entry.confidenceBreakdown}&nbsp;({entry.confidenceBreakdown.score}){/if}
            {#if entry.confidenceBreakdown}
              <div class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-lg border border-border bg-surface-card p-3 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 w-56">
                <p class="text-xs font-semibold text-text-primary">{confidenceLabel(entry.confidence)} Confidence ({entry.confidenceBreakdown.score}/100)</p>
                {#each confidenceTooltipLines(entry.confidenceBreakdown) as f}
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
      </button>

      <!-- Expanded detail -->
      {#if expanded}
        <div class="border-t border-border px-4 pb-5 pt-4 sm:px-6">
          <!-- Dimension cards — 2x2 grid on desktop, stacked on mobile -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {#each entry.dimensions as dim (dim.key)}
              <div class="rounded-lg border border-border bg-surface p-4">
                <!-- Dimension header -->
                <div class="flex items-center justify-between">
                  <h4 class="text-sm font-semibold text-text-primary">{dim.label}</h4>
                  <span class="text-lg font-bold" style="color: {dimensionColor(dim.score)}">{Math.round(dim.score * 100)}</span>
                </div>
                <div class="mt-1 flex items-center gap-2 text-xs text-text-secondary">
                  <span>Weight: {Math.round(dim.weight * 100)}%</span>
                  <span>&middot;</span>
                  <span>{dim.availableCount}/{dim.totalCount} indicators</span>
                </div>
                <!-- Progress bar -->
                <div class="mt-2 h-2 w-full rounded-full bg-earth-100">
                  <div
                    class="h-2 rounded-full transition-all"
                    style="width: {barPercent(dim.score)}%; background-color: {dimensionColor(dim.score)}"
                  ></div>
                </div>
                <!-- Indicator list -->
                <div class="mt-3 space-y-1.5">
                  {#each dim.indicators as ind (ind.key)}
                    <div class="flex items-center justify-between text-xs">
                      <span class="text-text-secondary">
                        {ind.label}
                        {#if isLiveIndicator(entry.cityId, ind.key)}
                          <i
                            class="fa-solid fa-tower-broadcast ml-1 text-[0.55rem]"
                            style="color: var(--color-altmo-500)"
                            title="Live data from {liveSourceLabel(ind.key)}"
                          ></i>
                        {/if}
                      </span>
                      <span class="font-semibold text-text-primary">{fmtIndicatorValue(ind.value, ind.unit)}</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>

          <!-- Bottom row: data readiness + gap analysis side by side on desktop -->
          <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <!-- Data readiness -->
            {#if readinessEntry}
              {@const missingLayers = missingLayerNames(entry.cityId)}
              <div class="rounded-lg bg-earth-50 p-4">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold text-text-primary">
                    <i class="fa-solid fa-database mr-1.5 text-text-secondary"></i>
                    Data Readiness
                  </span>
                  <span class="text-lg font-bold" style="color: {readinessScoreColor(readinessEntry.total)}">{Math.round(readinessEntry.total)}%</span>
                </div>
                <div class="mt-2 h-2 w-full rounded-full bg-earth-100">
                  <div
                    class="h-2 rounded-full transition-all"
                    style="width: {readinessEntry.total}%; background-color: {readinessScoreColor(readinessEntry.total)}"
                  ></div>
                </div>
                {#if missingLayers.length > 0}
                  <p class="mt-2 text-xs text-text-secondary">
                    <i class="fa-solid fa-circle-exclamation mr-1 text-tangerine-400"></i>
                    Gaps: {missingLayers.join(', ')}
                  </p>
                {/if}
              </div>
            {/if}

            <!-- Upgrade path + recommendation -->
            {#if gap}
              <div class="space-y-2">
                <div class="rounded-lg border p-4" style="border-color: {color}30; background-color: {color}08">
                  <p class="text-sm font-medium text-text-primary">
                    <i class="fa-solid fa-arrow-up-right-dots mr-1.5" style="color: {color}"></i>
                    {gap.upgradeSentence}
                  </p>
                </div>
                <div class="rounded-lg border border-border bg-earth-50 p-4">
                  <p class="text-xs text-text-secondary">
                    <i class="fa-solid fa-triangle-exclamation mr-1 text-tangerine-500"></i>
                    <span class="font-medium text-text-primary">Biggest gap:</span> {gap.gapSentence}
                  </p>
                  <p class="mt-2 text-xs text-text-secondary">
                    <i class="fa-solid fa-lightbulb mr-1 text-tangerine-500"></i>
                    {gap.recommendation}
                  </p>
                </div>
              </div>
            {/if}
          </div>

          <!-- Link to city deep-dive -->
          <div class="mt-4 text-center sm:text-left">
            <a
              href="/city/{entry.cityId}"
              class="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-dark"
              onclick={(e) => e.stopPropagation()}
            >
              View full scorecard
              <i class="fa-solid fa-arrow-right text-xs"></i>
            </a>
          </div>
        </div>
      {/if}
    </div>
  {/each}
</div>
