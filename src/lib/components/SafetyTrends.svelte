<script lang="ts">
  import Chart from '$lib/components/Chart.svelte';
  import { CITIES } from '$lib/config/cities';

  interface TrendPoint {
    year: number;
    fatalitiesPerLakh: number;
  }

  interface Props {
    trends: Record<string, TrendPoint[]>;
  }

  let { trends }: Props = $props();

  const CITY_COLORS: Record<string, string> = {
    bengaluru: '#008409',
    chennai: '#2563eb',
    delhi: '#dc2626',
    hyderabad: '#9333ea',
    indore: '#df7e37',
    kochi: '#06b6d4',
    pune: '#d946ef'
  };

  const VISION_ZERO_TARGET = 2.0;

  let cityNames = $derived(
    Object.fromEntries(CITIES.map((c) => [c.id, c.name]))
  );

  let hasTrends = $derived(Object.keys(trends).length > 0);

  let years = $derived(() => {
    const allYears = new Set<number>();
    for (const points of Object.values(trends)) {
      for (const p of points) {
        allYears.add(p.year);
      }
    }
    return Array.from(allYears).sort((a, b) => a - b);
  });

  let chartData = $derived(() => {
    const labels = years();
    const datasets = Object.entries(trends).map(([cityId, points]) => {
      const pointMap = new Map(points.map((p) => [p.year, p.fatalitiesPerLakh]));
      return {
        label: cityNames[cityId] ?? cityId,
        data: labels.map((y) => pointMap.get(y) ?? null),
        borderColor: CITY_COLORS[cityId] ?? '#999999',
        backgroundColor: CITY_COLORS[cityId] ?? '#999999',
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 8,
        borderWidth: 3
      };
    });

    // Add Vision Zero reference line
    datasets.push({
      label: 'Vision Zero Target',
      data: labels.map(() => VISION_ZERO_TARGET),
      borderColor: '#16a34a',
      backgroundColor: '#16a34a',
      tension: 0,
      pointRadius: 0,
      pointHoverRadius: 0,
      borderWidth: 2,
      // @ts-ignore — Chart.js supports borderDash but the generic typing is loose
      borderDash: [6, 4]
    } as any);

    return { labels, datasets };
  });

  let chartOptions = $derived({
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 16,
          font: { family: 'Open Sans, Inter, sans-serif', size: 12 }
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1) ?? '—'} per lakh`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        min: 0,
        max: 22,
        ticks: {
          stepSize: 2,
          autoSkip: false
        },
        title: {
          display: true,
          text: 'Deaths per lakh population',
          font: { family: 'Open Sans, Inter, sans-serif', size: 13 }
        },
        grid: { color: 'rgba(0,0,0,0.06)' }
      },
      x: {
        title: {
          display: true,
          text: 'Year',
          font: { family: 'Open Sans, Inter, sans-serif', size: 13 }
        },
        grid: { display: false }
      }
    },
    interaction: {
      mode: 'index' as const,
      intersect: false
    }
  });
</script>

{#if hasTrends}
  <div class="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
    <div class="mb-4">
      <h3 class="text-lg font-semibold text-text-primary">Traffic Fatality Trends</h3>
      <p class="text-sm text-text-secondary">Deaths per lakh population</p>
    </div>
    <div class="h-96">
      <Chart type="line" data={chartData()} options={chartOptions} class="h-full" />
    </div>
    <p class="mt-3 text-xs text-text-secondary">
      <i class="fa-solid fa-circle-info mr-1"></i>
      Dashed green line shows the Vision Zero target (2.0 per lakh). Source: NCRB / MoRTH annual reports.
    </p>
  </div>
{:else}
  <div class="rounded-lg border border-neutral-200 bg-white p-6 text-center">
    <p class="text-sm text-text-secondary">No historical safety data available</p>
  </div>
{/if}
