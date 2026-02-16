<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';

  interface Props {
    center?: [number, number];
    zoom?: number;
    style?: string;
    class?: string;
    onReady?: (map: maplibregl.Map) => void;
  }

  let {
    center = [77.5946, 12.9716],
    zoom = 12,
    style = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    class: className = '',
    onReady
  }: Props = $props();

  let container: HTMLDivElement;
  let map: maplibregl.Map | undefined;

  export function getMap(): maplibregl.Map | undefined {
    return map;
  }

  onMount(() => {
    map = new maplibregl.Map({
      container,
      style,
      center,
      zoom
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    if (onReady) {
      map.on('load', () => onReady(map!));
    }
  });

  onDestroy(() => {
    map?.remove();
  });
</script>

<div bind:this={container} class="h-full w-full {className}"></div>
