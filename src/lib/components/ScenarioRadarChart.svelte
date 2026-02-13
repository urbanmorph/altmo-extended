<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
  import type { ScenarioResult } from '$lib/config/scenarios';

  interface Props {
    result: ScenarioResult;
  }

  let { result }: Props = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart<'radar'> | undefined;

  Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

  function getDimensionScores(score: typeof result.baseline) {
    return score.dimensions.map((d) => Math.round(d.score * 100));
  }

  function getLabels() {
    return result.baseline.dimensions.map((d) => d.label);
  }

  function buildChartData() {
    return {
      labels: getLabels(),
      datasets: [
        {
          label: 'Current',
          data: getDimensionScores(result.baseline),
          borderColor: 'rgba(153, 153, 153, 0.8)',
          backgroundColor: 'rgba(153, 153, 153, 0.1)',
          borderWidth: 2,
          borderDash: [5, 5],
          pointBackgroundColor: 'rgba(153, 153, 153, 0.8)',
          pointRadius: 3
        },
        {
          label: 'Scenario',
          data: getDimensionScores(result.scenario),
          borderColor: 'var(--color-altmo-700)',
          backgroundColor: 'rgba(0, 132, 9, 0.15)',
          borderWidth: 2,
          pointBackgroundColor: 'var(--color-altmo-700)',
          pointRadius: 4
        }
      ]
    };
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
          font: { size: 12, weight: 500 as const }
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
    // Access result to create dependency
    const _baselineScore = result.baseline.composite;
    const _scenarioScore = result.scenario.composite;
    void _baselineScore;
    void _scenarioScore;

    chart.data = buildChartData();
    chart.update('none');
  });

  onDestroy(() => {
    chart?.destroy();
  });
</script>

<div class="relative aspect-square w-full max-w-md mx-auto">
  <canvas bind:this={canvas}></canvas>
</div>
