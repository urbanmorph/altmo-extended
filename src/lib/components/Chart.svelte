<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables } from 'chart.js';

  interface Props {
    type: 'bar' | 'line' | 'doughnut' | 'pie' | 'scatter' | 'radar';
    data: object;
    options?: object;
    class?: string;
  }

  let { type, data, options = {}, class: className = '' }: Props = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart | undefined;

  Chart.register(...registerables);

  onMount(() => {
    chart = new Chart(canvas, {
      type,
      data: data as any,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...options
      } as any
    });
  });

  // Update chart when data changes (e.g. client-side navigation)
  let prevData: object | undefined;
  $effect(() => {
    if (!chart) return;
    const currentData = data;
    if (currentData === prevData) return;
    prevData = currentData;
    chart.data = currentData as any;
    chart.update();
  });

  onDestroy(() => {
    chart?.destroy();
  });
</script>

<div class="relative {className}">
  <canvas bind:this={canvas}></canvas>
</div>
