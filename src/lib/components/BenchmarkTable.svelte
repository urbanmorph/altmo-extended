<script lang="ts">
  import {
    gradeColor,
    type CityQoLScore,
    type QoLOverrides
  } from '$lib/config/city-qol-data';
  import { cityName, barPercent, dimensionColor, gapToNextGrade, confidenceIcon, confidenceColor, confidenceLabel, confidenceTooltipLines } from '$lib/utils/qol-format';

  interface Props {
    scores: CityQoLScore[];
    overrides?: QoLOverrides;
    sortBy?: string;
    highlightCity?: string;
    onsort?: (key: string) => void;
  }

  let { scores, overrides, sortBy = 'composite', highlightCity, onsort }: Props = $props();

  const sortedScores = $derived(() => {
    const arr = [...scores];
    if (sortBy === 'composite') {
      arr.sort((a, b) => b.composite - a.composite);
    } else {
      arr.sort((a, b) => {
        const aDim = a.dimensions.find((d) => d.key === sortBy);
        const bDim = b.dimensions.find((d) => d.key === sortBy);
        return (bDim?.score ?? 0) - (aDim?.score ?? 0);
      });
    }
    return arr;
  });

  function handleSort(key: string) {
    onsort?.(key);
  }


  function liveCount(cityId: string): number {
    return overrides?.[cityId] ? Object.keys(overrides[cityId]).length : 0;
  }

  const sortColumns = [
    { key: 'composite', label: 'Composite' },
    { key: 'health', label: 'Health' },
    { key: 'accessibility', label: 'Access' },
    { key: 'environmental', label: 'Environ.' },
    { key: 'mobility', label: 'Mobility' }
  ];
</script>

<div class="overflow-x-auto">
  <table class="w-full text-sm">
    <thead>
      <tr class="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
        <th class="pb-2 pr-3 w-10">#</th>
        <th class="pb-2 pr-3">City</th>
        <th class="pb-2 pr-3 text-center">Grade</th>
        {#each sortColumns as col (col.key)}
          <th class="pb-2 pr-3 text-right">
            <button
              class="inline-flex items-center gap-1 hover:text-text-primary transition-colors {sortBy === col.key ? 'text-primary font-bold' : ''}"
              onclick={() => handleSort(col.key)}
            >
              {col.label}
              {#if sortBy === col.key}
                <i class="fa-solid fa-caret-down text-[0.6rem]"></i>
              {/if}
            </button>
          </th>
        {/each}
        <th class="pb-2 pr-3 text-center">Conf.</th>
        <th class="pb-2 text-right">Gap</th>
      </tr>
    </thead>
    <tbody>
      {#each sortedScores() as entry, i (entry.cityId)}
        {@const rank = i + 1}
        {@const gap = gapToNextGrade(entry.composite)}
        {@const live = liveCount(entry.cityId)}
        {@const isHighlighted = highlightCity === entry.cityId}
        <tr
          class="border-b border-border/50 transition-colors {isHighlighted ? 'bg-altmo-700/5' : 'hover:bg-surface-hover'}"
        >
          <!-- Rank -->
          <td class="py-3 pr-3">
            <span
              class="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
              style="background-color: {gradeColor(entry.grade)}"
            >
              {rank}
            </span>
          </td>

          <!-- City name + live badge -->
          <td class="py-3 pr-3">
            <div class="font-medium text-text-primary">
              {cityName(entry.cityId)}
              {#if isHighlighted}
                <i class="fa-solid fa-location-dot ml-1 text-[0.6rem] text-primary"></i>
              {/if}
            </div>
            {#if live > 0}
              <div class="text-[0.6rem] text-text-secondary">
                <i class="fa-solid fa-tower-broadcast" style="color: var(--color-altmo-500)"></i>
                {live} live
              </div>
            {/if}
          </td>

          <!-- Grade -->
          <td class="py-3 pr-3 text-center">
            <span
              class="inline-flex rounded-full px-2 py-0.5 text-xs font-bold text-white"
              style="background-color: {gradeColor(entry.grade)}"
            >
              {entry.grade}
            </span>
          </td>

          <!-- Composite score -->
          <td class="py-3 pr-3 text-right">
            <div class="flex items-center justify-end gap-2">
              <div class="hidden sm:block h-1.5 w-16 rounded-full bg-earth-100">
                <div
                  class="h-1.5 rounded-full"
                  style="width: {barPercent(entry.composite)}%; background-color: {gradeColor(entry.grade)}"
                ></div>
              </div>
              <span class="font-semibold text-text-primary tabular-nums">
                {Math.round(entry.composite * 100)}
              </span>
            </div>
          </td>

          <!-- Dimension scores -->
          {#each ['health', 'accessibility', 'environmental', 'mobility'] as dimKey}
            {@const dim = entry.dimensions.find((d) => d.key === dimKey)}
            <td class="py-3 pr-3 text-right">
              {#if dim}
                <div class="flex items-center justify-end gap-2">
                  <div class="hidden sm:block h-1.5 w-12 rounded-full bg-earth-100">
                    <div
                      class="h-1.5 rounded-full"
                      style="width: {barPercent(dim.score)}%; background-color: {dimensionColor(dim.score)}"
                    ></div>
                  </div>
                  <span class="tabular-nums text-text-secondary">{Math.round(dim.score * 100)}</span>
                </div>
              {:else}
                <span class="text-text-secondary">--</span>
              {/if}
            </td>
          {/each}

          <!-- Confidence -->
          <td class="py-3 pr-3 text-center">
            <span class="group relative inline-block">
              <i
                class="{confidenceIcon(entry.confidence)} text-sm cursor-default"
                style="color: {confidenceColor(entry.confidence)}"
              ></i>
              {#if entry.confidenceBreakdown}
                <div class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-lg border border-border bg-surface-card p-3 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 w-56">
                  <p class="text-xs font-semibold text-text-primary">{confidenceLabel(entry.confidence)} ({entry.confidenceBreakdown.score}/100)</p>
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
          </td>

          <!-- Gap to next grade -->
          <td class="py-3 text-right">
            {#if gap}
              <span class="inline-flex items-center rounded-md bg-tangerine-300/10 px-1.5 py-0.5 text-[0.65rem] font-medium text-tangerine-500">
                +{gap.pointsNeeded} to {gap.grade}
              </span>
            {:else}
              <span class="text-[0.65rem] text-altmo-500 font-medium">
                <i class="fa-solid fa-check"></i> Top
              </span>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
