<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
  import type { CityQoLScore } from '$lib/config/city-qol-data';
  import { cityName } from '$lib/utils/qol-format';

  interface Props {
    scores: CityQoLScore[];
    selectedCities: string[];
  }

  let { scores, selectedCities }: Props = $props();

  const CITY_COLORS = [
    { border: 'rgba(0, 132, 9, 0.9)', bg: 'rgba(0, 132, 9, 0.12)' },         // green
    { border: 'rgba(255, 123, 39, 0.9)', bg: 'rgba(255, 123, 39, 0.12)' },    // orange
    { border: 'rgba(37, 99, 235, 0.9)', bg: 'rgba(37, 99, 235, 0.12)' },      // blue
    { border: 'rgba(147, 51, 234, 0.9)', bg: 'rgba(147, 51, 234, 0.12)' }     // purple
  ];

  let canvas: HTMLCanvasElement;
  let chart: Chart<'radar'> | undefined;

  Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

  function buildChartData() {
    const labels = ['Health', 'Accessibility', 'Environmental', 'Mobility'];

    const datasets: {
      label: string;
      data: number[];
      borderColor: string;
      backgroundColor: string;
      borderWidth: number;
      pointBackgroundColor: string;
      pointRadius: number;
      pointHoverRadius: number;
    }[] = [];

    selectedCities.slice(0, 4).forEach((cityId, i) => {
      const score = scores.find((s) => s.cityId === cityId);
      if (!score) return;
      const color = CITY_COLORS[i % CITY_COLORS.length];
      datasets.push({
        label: cityName(cityId),
        data: score.dimensions.map((d) => Math.round(d.score * 100)),
        borderColor: color.border,
        backgroundColor: color.bg,
        borderWidth: 2,
        pointBackgroundColor: color.border,
        pointRadius: 4,
        pointHoverRadius: 6
      });
    });

    return { labels, datasets };
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    animation: false as const,
    scales: {
      r: {
        beginAtZero: true,
        min: 0,
        max: 100,
        ticks: {
          stepSize: 25,
          font: { size: 10 },
          backdropColor: 'transparent'
        },
        pointLabels: {
          font: { size: 13, weight: 500 as const }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.08)'
        }
      }
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 16,
          font: { size: 12 }
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
            `${ctx.dataset.label}: ${ctx.raw}/100`
        }
      }
    }
  };

  onMount(() => {
    chart = new Chart(canvas, {
      type: 'radar',
      data: buildChartData(),
      options: chartOptions
    });
  });

  $effect(() => {
    if (!chart) return;
    // Track dependency on selectedCities + scores
    const _dep = selectedCities.join(',') + scores.map((s) => s.composite).join(',');
    void _dep;

    chart.data = buildChartData();
    chart.update('none');
  });

  onDestroy(() => {
    chart?.destroy();
  });
</script>

<div class="relative aspect-square w-full max-w-lg mx-auto">
  <canvas bind:this={canvas}></canvas>
</div>
