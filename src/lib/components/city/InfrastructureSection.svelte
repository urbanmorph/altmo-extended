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
    totalActivities?: number;
    activeUsers?: number;
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

  // Static layers — only lines on by default (stations/stops are heavy to render)
  let showBusStops = $state(false);
  let showMetroStations = $state(false);
  let showMetroLines = $state(true);
  let showRailStations = $state(false);
  let showRailLines = $state(true);
  let showCompanies = $state(false);
  let showCatchmentWalk400 = $state(false);
  let showCatchmentWalk800 = $state(false);
  let showCatchmentCycle = $state(false);

  // Dynamic layers
  let showActivityHeatmap = $state(true);

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
        properties: {
          id: m.id, name: m.name, marker_type: m.type,
          totalActivities: m.totalActivities ?? 0,
          activeUsers: m.activeUsers ?? 0
        }
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

    try {
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
        },
        layout: { visibility: 'none' }
      });
    }

    // ── Metro stations ──
    if (transitGeo && transitGeo.metroStations.length > 0) {
      map.addSource('metro-stations', { type: 'geojson', data: metroStationsToGeoJSON(transitGeo.metroStations) });
      map.addLayer({
        id: 'metro-stations', type: 'circle', source: 'metro-stations',
        paint: { 'circle-color': TRANSIT_COLORS.metro, 'circle-radius': 6, 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' },
        layout: { visibility: 'none' }
      });
    }

    // ── Rail stations ──
    if (transitGeo && transitGeo.railStations.length > 0) {
      map.addSource('rail-stations', { type: 'geojson', data: railStationsToGeoJSON(transitGeo.railStations) });
      map.addLayer({
        id: 'rail-stations', type: 'circle', source: 'rail-stations',
        paint: { 'circle-color': TRANSIT_COLORS.rail, 'circle-radius': 5, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff' },
        layout: { visibility: 'none' }
      });
    }

    // ── Activity heatmap (H3 hex polygons) ──
    if (densityCount > 0) {
      const hexGeoJSON = densityToGeoJSON(densityCells);
      // Use sorted percentiles for color stops — avoids outlier skew
      const sorted = densityCells.map(c => c.total).sort((a, b) => a - b);
      const pRaw = (pct: number) => sorted[Math.min(Math.floor(sorted.length * pct), sorted.length - 1)];
      // Deduplicate stops — MapLibre requires strictly increasing values
      const stops: Array<[number, string]> = [
        [1, '#d4e8c2'],                   // pale sage — lowest
        [pRaw(0.5), '#8cc63f'],           // altmo green — median
        [pRaw(0.75), '#eab308'],          // amber — above average
        [pRaw(0.9), '#FF7B27'],           // tangerine — high
        [pRaw(0.99), '#dc2626']           // red — hotspot
      ];
      // Remove stops with duplicate values (keep last color for each value)
      const deduped: Array<[number, string]> = [];
      for (const stop of stops) {
        if (deduped.length > 0 && deduped[deduped.length - 1][0] >= stop[0]) continue;
        deduped.push(stop);
      }

      map.addSource('activity-heatmap', { type: 'geojson', data: hexGeoJSON });
      map.addLayer({
        id: 'activity-heatmap', type: 'fill', source: 'activity-heatmap',
        paint: {
          'fill-color': deduped.length >= 2
            ? ['interpolate', ['linear'], ['get', 'total'], ...deduped.flat()]
            : deduped[0]?.[1] ?? '#8cc63f',
          'fill-opacity': 0.55
        },
      });
      map.addLayer({
        id: 'activity-heatmap-border', type: 'line', source: 'activity-heatmap',
        paint: { 'line-color': '#666666', 'line-width': 0.3, 'line-opacity': 0.2 }
      });
    }

    // ── Commuter destinations (companies/campuses) — added after heatmap so dots render on top ──
    if (companyCount > 0) {
      map.addSource('companies', { type: 'geojson', data: markersToGeoJSON(companyMarkers) });
      map.addLayer({
        id: 'companies', type: 'circle', source: 'companies',
        paint: { 'circle-color': '#FF7B27', 'circle-radius': 5, 'circle-opacity': 0.8, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff' },
        layout: { visibility: 'none' }
      });
    }
    } catch (err) {
      console.error('[map] Error setting up layers:', err);
    }

    // ── Click popups — single handler, priority-ordered layers ──
    const popupLayerDefs: Array<{ id: string; template: (p: Record<string, unknown>) => string }> = [
      { id: 'companies', template: (p) => {
        const acts = Number(p.totalActivities || 0);
        const users = Number(p.activeUsers || 0);
        const stats = acts > 0 ? `<br/>${acts.toLocaleString()} activities` + (users > 0 ? ` · ${users.toLocaleString()} users` : '') : '';
        return `<strong>${p.name}</strong>${stats}<br/><em style="font-size:0.75em;color:#999">via Altmo</em>`;
      }},
      { id: 'bus-stops', template: (p) => `<strong>${p.name}</strong><br/>${p.routeCount} routes` },
      { id: 'metro-stations', template: (p) => `<strong>${p.name}</strong><br/>${p.line} line` },
      { id: 'rail-stations', template: (p) => `<strong>${p.name}</strong><br/>${p.line} line` },
      { id: 'activity-heatmap', template: (p) => `<strong>${p.total} trips</strong><br/>Rides: ${p.rides}, Walks: ${p.walks}<br/><em style="font-size:0.75em;color:#999">via Altmo</em>` }
    ];

    // Only include layers that actually exist on the map
    const activeLayerIds = popupLayerDefs.filter(l => map.getLayer(l.id)).map(l => l.id);
    const templateLookup: Record<string, (p: Record<string, unknown>) => string> = {};
    for (const l of popupLayerDefs) templateLookup[l.id] = l.template;

    let activePopup: maplibregl.Popup | null = null;

    // Single map-wide click handler — queries layers in priority order, first match wins
    map.on('click', (e) => {
      if (activePopup) { activePopup.remove(); activePopup = null; }

      for (const layerId of activeLayerIds) {
        const features = map.queryRenderedFeatures(e.point, { layers: [layerId] });
        if (!features.length) continue;

        const feature = features[0];
        const geometry = feature.geometry;
        let coords: [number, number];
        if (geometry.type === 'Point') {
          coords = geometry.coordinates.slice() as [number, number];
        } else {
          coords = [e.lngLat.lng, e.lngLat.lat];
        }
        const props = feature.properties ?? {};
        const template = templateLookup[layerId];
        activePopup = new maplibregl.Popup({ closeButton: false, maxWidth: '220px' })
          .setLngLat(coords)
          .setHTML(template(props))
          .addTo(map);
        activePopup.on('close', () => { activePopup = null; });
        return; // first match wins — don't check lower-priority layers
      }
    });

    // Cursor changes for interactive layers
    for (const layerId of activeLayerIds) {
      map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
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
                  <MapLayerToggle label="Commute Destinations (Altmo)" color="#FF7B27" count={companyCount} bind:checked={showCompanies} />
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
                  <i class="fa-solid fa-bolt mr-1"></i> Altmo Activity
                </p>
                <div class="space-y-1">
                  <MapLayerToggle label="Trip Heatmap (Altmo)" color="#2171b5" count={densityCount} bind:checked={showActivityHeatmap} />
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
