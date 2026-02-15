<script lang="ts">
  import Map from '$lib/components/Map.svelte';
  import MapLayerToggle from '$lib/components/MapLayerToggle.svelte';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import { formatNumber, formatCompact } from '$lib/utils/format';
  import {
    busStopsToGeoJSON,
    metroStationsToGeoJSON,
    metroLinesToGeoJSON,
    railStationsToGeoJSON,
    railLinesToGeoJSON,
    circlePolygon,
    TRANSIT_COLORS,
    CATCHMENT,
    type TransitData
  } from '$lib/utils/transit';
  import { densityToGeoJSON } from '$lib/utils/h3';
  import type { DensityCell } from '$lib/server/activity-data';
  import maplibregl from 'maplibre-gl';

  interface TransitMetricData {
    busStops: number;
    metroStations: number;
    railKm: number;
    suburbanRailKm: number;
    metroKm: number;
  }

  interface GeoMarkerData {
    id: number;
    name: string;
    lat: number;
    lon: number;
    type: string;
  }

  interface Props {
    cityId: string;
    transit: TransitMetricData | null;
    transitGeo: TransitData | null;
    geoMarkers: GeoMarkerData[];
    densityCells: DensityCell[];
    center: [number, number];
    zoom: number;
  }

  let { cityId, transit, transitGeo, geoMarkers, densityCells, center, zoom }: Props = $props();

  // ── Layer visibility toggles ──

  // Static layers
  let showBusStops = $state(true);
  let showMetroStations = $state(true);
  let showMetroLines = $state(true);
  let showRailStations = $state(true);
  let showRailLines = $state(true);
  let showCompanies = $state(false);
  let showCatchmentWalk400 = $state(false);
  let showCatchmentWalk800 = $state(false);
  let showCatchmentCycle = $state(false);

  // Dynamic layers
  let showActivityHeatmap = $state(false);

  // Track map instance
  let mapInstance: maplibregl.Map | undefined = $state();

  // ── Metric labels ──
  const railKmLabel = $derived(transit ? `${formatNumber(transit.railKm)} km` : '—');
  const railBreakdown = $derived.by(() => {
    if (!transit) return '';
    const parts: string[] = [];
    if (transit.metroKm > 0) parts.push(`Metro ${formatNumber(transit.metroKm)} km`);
    if (transit.suburbanRailKm > 0) parts.push(`Suburban ${formatNumber(transit.suburbanRailKm)} km`);
    return parts.join(' + ');
  });
  const busStopsLabel = $derived(transit ? formatCompact(transit.busStops) : '—');
  const metroStationsLabel = $derived(transit ? formatNumber(transit.metroStations) : '—');

  // ── Layer counts ──
  const busCount = $derived(transitGeo?.busStops.length ?? 0);
  const metroStationCount = $derived(transitGeo?.metroStations.length ?? 0);
  const metroLineCount = $derived(transitGeo?.metroLines.length ?? 0);
  const railStationCount = $derived(transitGeo?.railStations.length ?? 0);
  const railLineCount = $derived(transitGeo?.railLines.length ?? 0);
  const companyMarkers = $derived(geoMarkers.filter(m => m.lat && m.lon && (m.type === 'Company' || m.type === 'Campus')));
  const companyCount = $derived(companyMarkers.length);
  const densityCount = $derived(densityCells.length);

  // GeoJSON for company markers
  function markersToGeoJSON(markers: GeoMarkerData[]): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: markers.map(m => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [m.lon, m.lat] },
        properties: { id: m.id, name: m.name, marker_type: m.type }
      }))
    };
  }

  // Has any geo data to show on map?
  const hasGeoData = $derived(
    busCount > 0 || metroStationCount > 0 || metroLineCount > 0 ||
    railStationCount > 0 || railLineCount > 0 ||
    companyCount > 0 || densityCount > 0
  );

  // Build catchment rings for all metro + rail stations
  function buildCatchmentRings(radiusMeters: number): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = [];
    if (transitGeo) {
      for (const s of transitGeo.metroStations) features.push(circlePolygon(s.lng, s.lat, radiusMeters));
      for (const s of transitGeo.railStations) features.push(circlePolygon(s.lng, s.lat, radiusMeters));
    }
    return { type: 'FeatureCollection', features };
  }

  const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

  function onMapReady(map: maplibregl.Map) {
    mapInstance = map;

    // ── Catchment ring sources (empty initially, populated on toggle) ──
    map.addSource('catchment-walk-400', { type: 'geojson', data: emptyFC });
    map.addSource('catchment-walk-800', { type: 'geojson', data: emptyFC });
    map.addSource('catchment-cycle', { type: 'geojson', data: emptyFC });

    for (const { id, source, color } of [
      { id: 'catchment-cycle', source: 'catchment-cycle', color: TRANSIT_COLORS.catchmentCycle },
      { id: 'catchment-walk-800', source: 'catchment-walk-800', color: TRANSIT_COLORS.catchmentWalk },
      { id: 'catchment-walk-400', source: 'catchment-walk-400', color: TRANSIT_COLORS.catchmentWalk }
    ]) {
      map.addLayer({ id: `${id}-fill`, type: 'fill', source, paint: { 'fill-color': color, 'fill-opacity': 0.1 } });
      map.addLayer({ id: `${id}-border`, type: 'line', source, paint: { 'line-color': color, 'line-width': 1, 'line-opacity': 0.4 } });
    }

    // ── Metro lines ──
    if (transitGeo && transitGeo.metroLines.length > 0) {
      map.addSource('metro-lines', { type: 'geojson', data: metroLinesToGeoJSON(transitGeo.metroLines) });
      map.addLayer({
        id: 'metro-lines', type: 'line', source: 'metro-lines',
        paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.85 }
      });
    }

    // ── Rail lines ──
    if (transitGeo && transitGeo.railLines.length > 0) {
      map.addSource('rail-lines', { type: 'geojson', data: railLinesToGeoJSON(transitGeo.railLines) });
      map.addLayer({
        id: 'rail-lines', type: 'line', source: 'rail-lines',
        paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-opacity': 0.75, 'line-dasharray': [4, 2] }
      });
    }

    // ── Bus stops ──
    if (transitGeo && transitGeo.busStops.length > 0) {
      map.addSource('bus-stops', { type: 'geojson', data: busStopsToGeoJSON(transitGeo.busStops) });
      map.addLayer({
        id: 'bus-stops', type: 'circle', source: 'bus-stops',
        paint: {
          'circle-color': TRANSIT_COLORS.bus,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 14, 4],
          'circle-opacity': 0.6, 'circle-stroke-width': 0.5, 'circle-stroke-color': '#ffffff'
        }
      });
    }

    // ── Metro stations ──
    if (transitGeo && transitGeo.metroStations.length > 0) {
      map.addSource('metro-stations', { type: 'geojson', data: metroStationsToGeoJSON(transitGeo.metroStations) });
      map.addLayer({
        id: 'metro-stations', type: 'circle', source: 'metro-stations',
        paint: { 'circle-color': TRANSIT_COLORS.metro, 'circle-radius': 6, 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' }
      });
    }

    // ── Rail stations ──
    if (transitGeo && transitGeo.railStations.length > 0) {
      map.addSource('rail-stations', { type: 'geojson', data: railStationsToGeoJSON(transitGeo.railStations) });
      map.addLayer({
        id: 'rail-stations', type: 'circle', source: 'rail-stations',
        paint: { 'circle-color': TRANSIT_COLORS.rail, 'circle-radius': 5, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff' }
      });
    }

    // ── Commuter destinations (companies/campuses) ──
    if (companyCount > 0) {
      map.addSource('companies', { type: 'geojson', data: markersToGeoJSON(companyMarkers) });
      map.addLayer({
        id: 'companies', type: 'circle', source: 'companies',
        paint: { 'circle-color': '#FF7B27', 'circle-radius': 5, 'circle-opacity': 0.8, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff' },
        layout: { visibility: 'none' }
      });
    }

    // ── Activity heatmap (H3 hex polygons) ──
    if (densityCount > 0) {
      const hexGeoJSON = densityToGeoJSON(densityCells);
      // Compute max for color interpolation
      const maxTotal = Math.max(...densityCells.map(c => c.total), 1);

      map.addSource('activity-heatmap', { type: 'geojson', data: hexGeoJSON });
      map.addLayer({
        id: 'activity-heatmap', type: 'fill', source: 'activity-heatmap',
        paint: {
          'fill-color': [
            'interpolate', ['linear'], ['get', 'total'],
            1, '#c6dbef',
            Math.round(maxTotal * 0.25), '#6baed6',
            Math.round(maxTotal * 0.5), '#2171b5',
            maxTotal, '#08306b'
          ],
          'fill-opacity': 0.5
        },
        layout: { visibility: 'none' }
      });
      map.addLayer({
        id: 'activity-heatmap-border', type: 'line', source: 'activity-heatmap',
        paint: { 'line-color': '#2171b5', 'line-width': 0.5, 'line-opacity': 0.3 },
        layout: { visibility: 'none' }
      });
    }

    // ── Click popups ──
    const popupLayers = [
      { id: 'bus-stops', template: (p: Record<string, unknown>) => `<strong>${p.name}</strong><br/>${p.routeCount} routes` },
      { id: 'metro-stations', template: (p: Record<string, unknown>) => `<strong>${p.name}</strong><br/>${p.line} line` },
      { id: 'rail-stations', template: (p: Record<string, unknown>) => `<strong>${p.name}</strong><br/>${p.line} line` },
      { id: 'companies', template: (p: Record<string, unknown>) => `<strong>${p.name}</strong><br/>${p.marker_type}` },
      { id: 'activity-heatmap', template: (p: Record<string, unknown>) => `<strong>${p.total} trips</strong><br/>Rides: ${p.rides}, Walks: ${p.walks}` }
    ];

    for (const layer of popupLayers) {
      if (!map.getLayer(layer.id)) continue;
      map.on('click', layer.id, (e) => {
        if (!e.features?.[0]) return;
        const geometry = e.features[0].geometry;
        let coords: [number, number];
        if (geometry.type === 'Point') {
          coords = geometry.coordinates.slice() as [number, number];
        } else {
          coords = [e.lngLat.lng, e.lngLat.lat];
        }
        const props = e.features[0].properties ?? {};
        new maplibregl.Popup({ closeButton: false, maxWidth: '200px' })
          .setLngLat(coords)
          .setHTML(layer.template(props))
          .addTo(map);
      });
      map.on('mouseenter', layer.id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer.id, () => { map.getCanvas().style.cursor = ''; });
    }
  }

  // ── Reactive layer visibility ──
  function setLayerVisibility(layerId: string, visible: boolean) {
    if (!mapInstance?.getLayer(layerId)) return;
    mapInstance.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
  }

  $effect(() => { setLayerVisibility('bus-stops', showBusStops); });
  $effect(() => { setLayerVisibility('metro-stations', showMetroStations); });
  $effect(() => { setLayerVisibility('metro-lines', showMetroLines); });
  $effect(() => { setLayerVisibility('rail-stations', showRailStations); });
  $effect(() => { setLayerVisibility('rail-lines', showRailLines); });
  $effect(() => { setLayerVisibility('companies', showCompanies); });
  $effect(() => {
    setLayerVisibility('activity-heatmap', showActivityHeatmap);
    setLayerVisibility('activity-heatmap-border', showActivityHeatmap);
  });

  // Catchment ring effects
  $effect(() => {
    if (!mapInstance) return;
    const src = mapInstance.getSource('catchment-walk-400') as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(showCatchmentWalk400 ? buildCatchmentRings(CATCHMENT.WALK_NEAR) : emptyFC);
  });
  $effect(() => {
    if (!mapInstance) return;
    const src = mapInstance.getSource('catchment-walk-800') as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(showCatchmentWalk800 ? buildCatchmentRings(CATCHMENT.WALK_FAR) : emptyFC);
  });
  $effect(() => {
    if (!mapInstance) return;
    const src = mapInstance.getSource('catchment-cycle') as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(showCatchmentCycle ? buildCatchmentRings(CATCHMENT.CYCLE) : emptyFC);
  });
</script>

<section id="infrastructure" class="scroll-mt-16">
  <h2 class="mb-6 text-xl font-bold text-text-primary">
    <i class="fa-solid fa-city mr-2 text-altmo-700"></i>
    Infrastructure & Activity Map
  </h2>

  {#if transit}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Rail Transit" value={railKmLabel} icon="fa-solid fa-train-subway" />
      <MetricCard label="Bus Stops" value={busStopsLabel} icon="fa-solid fa-bus" />
      <MetricCard label="Metro Stations" value={metroStationsLabel} icon="fa-solid fa-circle-dot" />
      <MetricCard label="Rail Breakdown" value={railBreakdown || '—'} icon="fa-solid fa-code-branch" />
    </div>

    {#key cityId}
      {#if hasGeoData}
        <div class="mt-6 rounded-xl border border-border bg-surface-card shadow-sm overflow-hidden">
          <div class="relative h-[32rem]">
            <Map {center} {zoom} onReady={onMapReady} />

            <!-- Layer panel -->
            <div class="absolute top-3 left-3 rounded-lg border border-border bg-surface-card/95 p-3 shadow-md backdrop-blur-sm max-h-[28rem] overflow-y-auto w-52">
              <!-- Static layers -->
              <p class="mb-2 text-[0.65rem] font-semibold text-text-secondary uppercase tracking-wider">
                <i class="fa-solid fa-layer-group mr-1"></i> Static
              </p>
              <div class="space-y-1">
                {#if busCount > 0}
                  <MapLayerToggle label="Bus Stops" color={TRANSIT_COLORS.bus} count={busCount} bind:checked={showBusStops} />
                {/if}
                {#if metroLineCount > 0}
                  <MapLayerToggle label="Metro Lines" color={TRANSIT_COLORS.metro} count={metroLineCount} bind:checked={showMetroLines} />
                {/if}
                {#if metroStationCount > 0}
                  <MapLayerToggle label="Metro Stations" color={TRANSIT_COLORS.metro} count={metroStationCount} bind:checked={showMetroStations} />
                {/if}
                {#if railLineCount > 0}
                  <MapLayerToggle label="Rail Lines" color={TRANSIT_COLORS.rail} count={railLineCount} bind:checked={showRailLines} />
                {/if}
                {#if railStationCount > 0}
                  <MapLayerToggle label="Rail Stations" color={TRANSIT_COLORS.rail} count={railStationCount} bind:checked={showRailStations} />
                {/if}
                {#if companyCount > 0}
                  <MapLayerToggle label="Commuter Destinations" color="#FF7B27" count={companyCount} bind:checked={showCompanies} />
                {/if}
                {#if metroStationCount > 0 || railStationCount > 0}
                  <div class="mt-1.5 border-t border-border pt-1.5">
                    <MapLayerToggle label="Walk 400m" color={TRANSIT_COLORS.catchmentWalk} bind:checked={showCatchmentWalk400} />
                    <MapLayerToggle label="Walk 800m" color={TRANSIT_COLORS.catchmentWalk} bind:checked={showCatchmentWalk800} />
                    <MapLayerToggle label="Cycle 2km" color={TRANSIT_COLORS.catchmentCycle} bind:checked={showCatchmentCycle} />
                  </div>
                {/if}
              </div>

              <!-- Dynamic layers -->
              {#if densityCount > 0}
                <p class="mt-3 mb-2 text-[0.65rem] font-semibold text-text-secondary uppercase tracking-wider">
                  <i class="fa-solid fa-bolt mr-1"></i> Activity
                </p>
                <div class="space-y-1">
                  <MapLayerToggle label="Trip Heatmap" color="#2171b5" count={densityCount} bind:checked={showActivityHeatmap} />
                </div>
              {/if}
            </div>
          </div>
        </div>
      {:else}
        <div class="mt-6 flex h-48 items-center justify-center rounded-xl border border-dashed border-border bg-earth-50">
          <div class="text-center text-text-secondary">
            <i class="fa-solid fa-map text-3xl"></i>
            <p class="mt-2 text-sm">No map data available for this city</p>
          </div>
        </div>
      {/if}
    {/key}
  {:else}
    <div class="rounded-xl border border-border bg-surface-card p-8 text-center">
      <i class="fa-solid fa-road text-3xl text-text-secondary"></i>
      <p class="mt-2 text-text-secondary">Transit infrastructure data is not yet available for this city.</p>
    </div>
  {/if}
</section>
