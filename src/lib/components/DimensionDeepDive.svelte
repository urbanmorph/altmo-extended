<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
  import {
    QOL_DIMENSIONS,
    INDICATOR_BENCHMARKS,
    type CityQoLScore,
    type QoLOverrides
  } from '$lib/config/city-qol-data';
  import { cityName, barPercent, dimensionColor, fmtIndicatorValue } from '$lib/utils/qol-format';

  interface Props {
    scores: CityQoLScore[];
    dimension: string;
    overrides?: QoLOverrides;
  }

  let { scores, dimension, overrides }: Props = $props();

  Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

  const dimDef = $derived(QOL_DIMENSIONS.find((d) => d.key === dimension));

  // Cities sorted by this dimension's score (highest first)
  const sortedByDim = $derived(() => {
    return [...scores].sort((a, b) => {
      const aScore = a.dimensions.find((d) => d.key === dimension)?.score ?? 0;
      const bScore = b.dimensions.find((d) => d.key === dimension)?.score ?? 0;
      return bScore - aScore;
    });
  });

  let canvas: HTMLCanvasElement;
  let chart: Chart<'bar'> | undefined;

  function buildChartData() {
    const sorted = sortedByDim();
    return {
      labels: sorted.map((s) => cityName(s.cityId)),
      datasets: [
        {
          label: dimDef?.label ?? dimension,
          data: sorted.map((s) => {
            const dim = s.dimensions.find((d) => d.key === dimension);
            return dim ? Math.round(dim.score * 100) : 0;
          }),
          backgroundColor: sorted.map((s) => {
            const dim = s.dimensions.find((d) => d.key === dimension);
            return dim ? dimensionColor(dim.score) : 'rgba(153, 153, 153, 0.5)';
          }),
          borderRadius: 4,
          barThickness: 28
        }
      ]
    };
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    animation: false as const,
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        ticks: {
          stepSize: 25,
          font: { size: 11 }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.06)'
        }
      },
      y: {
        ticks: {
          font: { size: 12, weight: 500 as const }
        },
        grid: { display: false }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { raw: unknown }) => `Score: ${ctx.raw}/100`
        }
      }
    }
  };

  onMount(() => {
    chart = new Chart(canvas, {
      type: 'bar',
      data: buildChartData(),
      options: chartOptions
    });
  });

  $effect(() => {
    if (!chart) return;
    // Track dependencies
    const _dep = dimension + scores.map((s) => s.composite).join(',');
    void _dep;

    chart.data = buildChartData();
    chart.update('none');
  });

  onDestroy(() => {
    chart?.destroy();
  });

  function isLive(cityId: string, indicatorKey: string): boolean {
    return overrides?.[cityId]?.[indicatorKey] !== undefined;
  }

  /** Get metro/suburban rail breakdown text for a city, or null if not available */
  function railBreakdown(cityId: string): string | null {
    const metroKm = overrides?.[cityId]?.['metro_km'];
    const suburbanKm = overrides?.[cityId]?.['suburban_rail_km'];
    if (metroKm == null && suburbanKm == null) return null;
    const parts: string[] = [];
    if (metroKm != null && metroKm > 0) parts.push(`Metro ${Math.round(metroKm as number)}`);
    if (suburbanKm != null && suburbanKm > 0) parts.push(`Suburban ${Math.round(suburbanKm as number)}`);
    return parts.length > 0 ? parts.join(' + ') + ' km' : null;
  }
</script>

<div class="space-y-6">
  <!-- Horizontal bar chart -->
  <div class="relative" style="height: {Math.max(scores.length * 48, 200)}px">
    <canvas bind:this={canvas}></canvas>
  </div>

  <!-- Indicator breakdown table -->
  {#if dimDef}
    <div>
      <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
        Indicator Breakdown: {dimDef.label}
      </h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
              <th class="pb-2 pr-3">Indicator</th>
              <th class="pb-2 pr-3 text-right">Target</th>
              {#each sortedByDim() as entry (entry.cityId)}
                <th class="pb-2 pr-3 text-right">{cityName(entry.cityId)}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each dimDef.indicators as ind (ind.key)}
              {@const bench = INDICATOR_BENCHMARKS[ind.key]}
              <tr class="border-b border-border/50">
                <td class="py-2.5 pr-3">
                  <div class="font-medium text-text-primary">{ind.label}</div>
                  <div class="text-[0.65rem] text-text-secondary">{ind.unit}</div>
                </td>
                <td class="py-2.5 pr-3 text-right">
                  {#if bench}
                    <span class="text-xs font-medium text-primary">{bench.target}</span>
                    <div class="text-[0.6rem] text-text-secondary truncate max-w-[100px]" title={bench.source}>
                      {bench.source.split('/').pop()?.trim()}
                    </div>
                  {:else}
                    <span class="text-text-secondary">--</span>
                  {/if}
                </td>
                {#each sortedByDim() as entry (entry.cityId)}
                  {@const dimData = entry.dimensions.find((d) => d.key === dimension)}
                  {@const indData = dimData?.indicators.find((i) => i.key === ind.key)}
                  <td class="py-2.5 pr-3 text-right">
                    {#if indData && indData.value !== null}
                      <div class="flex items-center justify-end gap-1.5">
                        <div class="hidden sm:block h-1 w-10 rounded-full bg-earth-100">
                          <div
                            class="h-1 rounded-full"
                            style="width: {barPercent(indData.normalized ?? 0)}%; background-color: {dimensionColor(indData.normalized ?? 0)}"
                          ></div>
                        </div>
                        <span class="tabular-nums text-text-primary font-medium">
                          {fmtIndicatorValue(indData.value, ind.unit).replace(` ${ind.unit}`, '')}
                        </span>
                        {#if isLive(entry.cityId, ind.key)}
                          <i
                            class="fa-solid fa-tower-broadcast text-[0.5rem]"
                            style="color: var(--color-altmo-500)"
                            title="Live data"
                          ></i>
                        {/if}
                      </div>
                      {#if ind.key === 'rail_transit_km'}
                        {@const rb = railBreakdown(entry.cityId)}
                        {#if rb}
                          <div class="text-[0.6rem] text-text-secondary text-right">{rb}</div>
                        {/if}
                      {/if}
                    {:else}
                      <span class="text-text-secondary">--</span>
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
