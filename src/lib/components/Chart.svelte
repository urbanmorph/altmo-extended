<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables } from 'chart.js';

  interface Props {
    type: 'bar' | 'line' | 'doughnut' | 'pie' | 'scatter';
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

  onDestroy(() => {
    chart?.destroy();
  });
</script>

<div class="relative h-full {className}">
  <canvas bind:this={canvas}></canvas>
</div>
