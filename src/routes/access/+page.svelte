<script lang="ts">
	import type maplibregl from 'maplibre-gl';
	import MapLayerToggle from '$lib/components/MapLayerToggle.svelte';
	import CatchmentRingLegend from '$lib/components/CatchmentRingLegend.svelte';
	import CityQoLSummary from '$lib/components/CityQoLSummary.svelte';
	import CityDataLayers from '$lib/components/CityDataLayers.svelte';
	import { TRANSIT_COLORS, CATCHMENT, circlePolygon } from '$lib/utils/transit';
	import { selectedCity } from '$lib/stores/city';
	import { goto } from '$app/navigation';

	let { data } = $props();

	let map = $state<maplibregl.Map | null>(null);
	let layersAdded = $state(false);
	let showBusStops = $state(true);
	let showMetroStations = $state(true);
	let showMetroLines = $state(false);
	let showRailStations = $state(false);
	let showRailLines = $state(false);
	let showCompanies = $state(false);
	let showTransitPoints = $state(false);
	let showCatchmentWalk400 = $state(false);
	let showCatchmentWalk800 = $state(false);
	let showCatchmentCycle = $state(false);

	// Track the current city from server data to detect changes
	let currentCityId = $derived(data.cityId);

	// Sync the city store when the page loads with a city param
	$effect(() => {
		if (data.cityId && data.cityName) {
			selectedCity.set({
				id: data.cityId,
				name: data.cityName,
				lat: data.cityCenter[1],
				lng: data.cityCenter[0],
				zoom: data.cityZoom
			});
		}
	});

	// Watch the city store for changes — navigate when user picks a new city
	$effect(() => {
		const city = $selectedCity;
		if (city && city.id !== currentCityId) {
			goto(`/access?city=${city.id}`);
		}
	});

	// When data changes (city switch), update map sources and re-center
	$effect(() => {
		if (!map || !layersAdded) return;
		// Access reactive data properties to track them
		const busStops = data.busStopsGeoJSON;
		const metroStations = data.metroStationsGeoJSON;
		const metroLines = data.metroLinesGeoJSON;
		const railStations = data.railStationsGeoJSON;
		const railLines = data.railLinesGeoJSON;
		const companies = data.companiesGeoJSON;
		const transitPoints = data.transitPointsGeoJSON;
		const center = data.cityCenter;
		const zoom = data.cityZoom;

		try {
			const busSource = map.getSource('bus-stops') as maplibregl.GeoJSONSource | undefined;
			const metroStationSource = map.getSource('metro-stations') as maplibregl.GeoJSONSource | undefined;
			const metroLineSource = map.getSource('metro-lines') as maplibregl.GeoJSONSource | undefined;
			const railStationSource = map.getSource('rail-stations') as maplibregl.GeoJSONSource | undefined;
			const railLineSource = map.getSource('rail-lines') as maplibregl.GeoJSONSource | undefined;
			const companySource = map.getSource('companies') as maplibregl.GeoJSONSource | undefined;
			const transitPointSource = map.getSource('transit-points') as maplibregl.GeoJSONSource | undefined;

			if (busSource) busSource.setData(busStops as GeoJSON.FeatureCollection);
			if (metroStationSource) metroStationSource.setData(metroStations as GeoJSON.FeatureCollection);
			if (metroLineSource) metroLineSource.setData(metroLines as GeoJSON.FeatureCollection);
			if (railStationSource) railStationSource.setData(railStations as GeoJSON.FeatureCollection);
			if (railLineSource) railLineSource.setData(railLines as GeoJSON.FeatureCollection);
			if (companySource) companySource.setData(companies as GeoJSON.FeatureCollection);
			if (transitPointSource) transitPointSource.setData(transitPoints as GeoJSON.FeatureCollection);

			// Clear catchment rings on city change
			const emptyFC = { type: 'FeatureCollection' as const, features: [] };
			const c400 = map.getSource('catchment-walk-400') as maplibregl.GeoJSONSource | undefined;
			const c800 = map.getSource('catchment-walk-800') as maplibregl.GeoJSONSource | undefined;
			const cCycle = map.getSource('catchment-cycle') as maplibregl.GeoJSONSource | undefined;
			if (c400) c400.setData(emptyFC);
			if (c800) c800.setData(emptyFC);
			if (cCycle) cCycle.setData(emptyFC);

			map.flyTo({ center: center as [number, number], zoom });
		} catch (err) {
			console.error('[access-map] Failed to update map sources:', err);
		}
	});

	function onMapReady(mapInstance: maplibregl.Map) {
		map = mapInstance;

		// Log errors for debugging
		mapInstance.on('error', (e) => {
			console.error('[map error]', e.error?.message ?? e);
		});

		console.log('[access-map] Data received:', {
			busStops: data.busStopsGeoJSON?.features?.length ?? 0,
			metroStations: data.metroStationsGeoJSON?.features?.length ?? 0,
			metroLines: data.metroLinesGeoJSON?.features?.length ?? 0
		});

		try {
			// Add sources
			mapInstance.addSource('bus-stops', {
				type: 'geojson',
				data: data.busStopsGeoJSON as GeoJSON.FeatureCollection
			});

			mapInstance.addSource('metro-stations', {
				type: 'geojson',
				data: data.metroStationsGeoJSON as GeoJSON.FeatureCollection
			});

			mapInstance.addSource('metro-lines', {
				type: 'geojson',
				data: data.metroLinesGeoJSON as GeoJSON.FeatureCollection
			});

			// Add empty sources for catchment rings
			mapInstance.addSource('catchment-walk-400', {
				type: 'geojson',
				data: { type: 'FeatureCollection' as const, features: [] }
			});

			mapInstance.addSource('catchment-walk-800', {
				type: 'geojson',
				data: { type: 'FeatureCollection' as const, features: [] }
			});

			mapInstance.addSource('catchment-cycle', {
				type: 'geojson',
				data: { type: 'FeatureCollection' as const, features: [] }
			});

			mapInstance.addSource('companies', {
				type: 'geojson',
				data: data.companiesGeoJSON as GeoJSON.FeatureCollection
			});

			mapInstance.addSource('rail-stations', {
				type: 'geojson',
				data: data.railStationsGeoJSON as GeoJSON.FeatureCollection
			});

			mapInstance.addSource('rail-lines', {
				type: 'geojson',
				data: data.railLinesGeoJSON as GeoJSON.FeatureCollection
			});

			mapInstance.addSource('transit-points', {
				type: 'geojson',
				data: data.transitPointsGeoJSON as GeoJSON.FeatureCollection
			});

		// Add layers for bus stops
		mapInstance.addLayer({
			id: 'bus-stops',
			type: 'circle',
			source: 'bus-stops',
			paint: {
				'circle-radius': 3,
				'circle-color': TRANSIT_COLORS.bus,
				'circle-opacity': 0.7
			},
			layout: {
				visibility: showBusStops ? 'visible' : 'none'
			}
		});

		// Add layers for metro stations
		mapInstance.addLayer({
			id: 'metro-stations',
			type: 'circle',
			source: 'metro-stations',
			paint: {
				'circle-radius': 6,
				'circle-color': [
					'match',
					['get', 'line'],
					'purple',
					TRANSIT_COLORS.metroPurple,
					'green',
					TRANSIT_COLORS.metroGreen,
					'yellow',
					TRANSIT_COLORS.metroYellow,
					'pink',
					TRANSIT_COLORS.metroPink,
					'blue',
					TRANSIT_COLORS.metroBlue,
					'red',
					TRANSIT_COLORS.metroRed,
					'aqua',
					TRANSIT_COLORS.metroAqua,
					TRANSIT_COLORS.metroPurple
				],
				'circle-stroke-width': 2,
				'circle-stroke-color': '#ffffff'
			},
			layout: {
				visibility: showMetroStations ? 'visible' : 'none'
			}
		});

		// Add layers for metro lines (color-matched to line property)
		mapInstance.addLayer({
			id: 'metro-lines',
			type: 'line',
			source: 'metro-lines',
			paint: {
				'line-color': ['get', 'color'],
				'line-width': 3
			},
			layout: {
				visibility: showMetroLines ? 'visible' : 'none'
			}
		});

		// Add catchment ring layers (fill + border)
		mapInstance.addLayer({
			id: 'catchment-walk-400-fill',
			type: 'fill',
			source: 'catchment-walk-400',
			paint: {
				'fill-color': TRANSIT_COLORS.catchmentWalk,
				'fill-opacity': 0.08
			},
			layout: {
				visibility: showCatchmentWalk400 ? 'visible' : 'none'
			}
		});

		mapInstance.addLayer({
			id: 'catchment-walk-400-border',
			type: 'line',
			source: 'catchment-walk-400',
			paint: {
				'line-color': TRANSIT_COLORS.catchmentWalk,
				'line-width': 1.5,
				'line-opacity': 0.6
			},
			layout: {
				visibility: showCatchmentWalk400 ? 'visible' : 'none'
			}
		});

		mapInstance.addLayer({
			id: 'catchment-walk-800-fill',
			type: 'fill',
			source: 'catchment-walk-800',
			paint: {
				'fill-color': TRANSIT_COLORS.catchmentWalk,
				'fill-opacity': 0.08
			},
			layout: {
				visibility: showCatchmentWalk800 ? 'visible' : 'none'
			}
		});

		mapInstance.addLayer({
			id: 'catchment-walk-800-border',
			type: 'line',
			source: 'catchment-walk-800',
			paint: {
				'line-color': TRANSIT_COLORS.catchmentWalk,
				'line-width': 1.5,
				'line-opacity': 0.4
			},
			layout: {
				visibility: showCatchmentWalk800 ? 'visible' : 'none'
			}
		});

		mapInstance.addLayer({
			id: 'catchment-cycle-fill',
			type: 'fill',
			source: 'catchment-cycle',
			paint: {
				'fill-color': TRANSIT_COLORS.catchmentCycle,
				'fill-opacity': 0.08
			},
			layout: {
				visibility: showCatchmentCycle ? 'visible' : 'none'
			}
		});

		mapInstance.addLayer({
			id: 'catchment-cycle-border',
			type: 'line',
			source: 'catchment-cycle',
			paint: {
				'line-color': TRANSIT_COLORS.catchmentCycle,
				'line-width': 1.5,
				'line-opacity': 0.6
			},
			layout: {
				visibility: showCatchmentCycle ? 'visible' : 'none'
			}
		});

		// Add companies layer (tangerine dots, default hidden)
		mapInstance.addLayer({
			id: 'companies',
			type: 'circle',
			source: 'companies',
			paint: {
				'circle-radius': 5,
				'circle-color': '#FF7B27',
				'circle-opacity': 0.8,
				'circle-stroke-width': 1,
				'circle-stroke-color': '#ffffff'
			},
			layout: {
				visibility: showCompanies ? 'visible' : 'none'
			}
		});

		// Add suburban rail line layer (dashed, color from feature property)
		mapInstance.addLayer({
			id: 'rail-lines',
			type: 'line',
			source: 'rail-lines',
			paint: {
				'line-color': ['get', 'color'],
				'line-width': 3,
				'line-dasharray': [4, 2]
			},
			layout: {
				visibility: showRailLines ? 'visible' : 'none'
			}
		});

		// Add suburban rail station layer
		mapInstance.addLayer({
			id: 'rail-stations',
			type: 'circle',
			source: 'rail-stations',
			paint: {
				'circle-radius': 5,
				'circle-color': TRANSIT_COLORS.railSuburban,
				'circle-opacity': 0.8,
				'circle-stroke-width': 1.5,
				'circle-stroke-color': '#ffffff'
			},
			layout: {
				visibility: showRailStations ? 'visible' : 'none'
			}
		});

		// Add transit points layer (Altmo geo_markers of type TransitPoint, hidden by default)
		mapInstance.addLayer({
			id: 'transit-points',
			type: 'circle',
			source: 'transit-points',
			paint: {
				'circle-radius': 4,
				'circle-color': '#059669',
				'circle-opacity': 0.7,
				'circle-stroke-width': 1,
				'circle-stroke-color': '#ffffff'
			},
			layout: {
				visibility: showTransitPoints ? 'visible' : 'none'
			}
		});

		// Add click handlers for popups
		mapInstance.on('click', 'rail-stations', (e) => {
			if (!e.features || e.features.length === 0) return;
			const feature = e.features[0];
			const { name, line } = feature.properties || {};

			import('maplibre-gl').then(({ Popup }) => {
				new Popup()
					.setLngLat(e.lngLat)
					.setHTML(
						`<div class="text-sm">
							<div class="font-semibold">${name || 'Rail Station'}</div>
							<div class="text-text-secondary">${line || 'Suburban'}</div>
						</div>`
					)
					.addTo(mapInstance);
			});
		});

		mapInstance.on('click', 'transit-points', (e) => {
			if (!e.features || e.features.length === 0) return;
			const feature = e.features[0];
			const { name, marker_type } = feature.properties || {};

			import('maplibre-gl').then(({ Popup }) => {
				new Popup()
					.setLngLat(e.lngLat)
					.setHTML(
						`<div class="text-sm">
							<div class="font-semibold">${name || 'Transit Point'}</div>
							<div class="text-text-secondary">${marker_type || 'TransitPoint'}</div>
						</div>`
					)
					.addTo(mapInstance);
			});
		});

		mapInstance.on('click', 'companies', (e) => {
			if (!e.features || e.features.length === 0) return;
			const feature = e.features[0];
			const { name, marker_type } = feature.properties || {};

			import('maplibre-gl').then(({ Popup }) => {
				new Popup()
					.setLngLat(e.lngLat)
					.setHTML(
						`<div class="text-sm">
							<div class="font-semibold">${name || 'Location'}</div>
							<div class="text-text-secondary">${marker_type || ''}</div>
						</div>`
					)
					.addTo(mapInstance);
			});
		});

		mapInstance.on('click', 'bus-stops', (e) => {
			if (!e.features || e.features.length === 0) return;
			const feature = e.features[0];
			const { name, routeCount } = feature.properties || {};

			// Dynamically import maplibregl for Popup
			import('maplibre-gl').then(({ Popup }) => {
				new Popup()
					.setLngLat(e.lngLat)
					.setHTML(
						`<div class="text-sm">
							<div class="font-semibold">${name || 'Bus Stop'}</div>
							<div class="text-text-secondary">${routeCount || 0} routes</div>
						</div>`
					)
					.addTo(mapInstance);
			});
		});

		mapInstance.on('click', 'metro-stations', (e) => {
			if (!e.features || e.features.length === 0) return;
			const feature = e.features[0];
			const { name, line } = feature.properties || {};

			import('maplibre-gl').then(({ Popup }) => {
				new Popup()
					.setLngLat(e.lngLat)
					.setHTML(
						`<div class="text-sm">
							<div class="font-semibold">${name || 'Metro Station'}</div>
							<div class="text-text-secondary capitalize">${line || 'purple'} line</div>
						</div>`
					)
					.addTo(mapInstance);
			});
		});

		// Change cursor on hover
		mapInstance.on('mouseenter', 'bus-stops', () => {
			mapInstance.getCanvas().style.cursor = 'pointer';
		});
		mapInstance.on('mouseleave', 'bus-stops', () => {
			mapInstance.getCanvas().style.cursor = '';
		});
		mapInstance.on('mouseenter', 'metro-stations', () => {
			mapInstance.getCanvas().style.cursor = 'pointer';
		});
		mapInstance.on('mouseleave', 'metro-stations', () => {
			mapInstance.getCanvas().style.cursor = '';
		});
		mapInstance.on('mouseenter', 'companies', () => {
			mapInstance.getCanvas().style.cursor = 'pointer';
		});
		mapInstance.on('mouseleave', 'companies', () => {
			mapInstance.getCanvas().style.cursor = '';
		});
		mapInstance.on('mouseenter', 'rail-stations', () => {
			mapInstance.getCanvas().style.cursor = 'pointer';
		});
		mapInstance.on('mouseleave', 'rail-stations', () => {
			mapInstance.getCanvas().style.cursor = '';
		});
		mapInstance.on('mouseenter', 'transit-points', () => {
			mapInstance.getCanvas().style.cursor = 'pointer';
		});
		mapInstance.on('mouseleave', 'transit-points', () => {
			mapInstance.getCanvas().style.cursor = '';
		});

		layersAdded = true;

		} catch (err) {
			console.error('[access-map] Failed to add map layers:', err);
		}
	}

	// Generate catchment rings when toggled
	function generateCatchmentRings(radius: number): GeoJSON.FeatureCollection {
		const stations = data.metroStationsGeoJSON.features;
		const features = stations.map((station) => {
			const [lng, lat] = (station.geometry as GeoJSON.Point).coordinates;
			return circlePolygon(lng, lat, radius);
		});

		return {
			type: 'FeatureCollection',
			features
		};
	}

	// Update layer visibility when toggles change
	$effect(() => {
		if (!map) return;
		map.setLayoutProperty('bus-stops', 'visibility', showBusStops ? 'visible' : 'none');
	});

	$effect(() => {
		if (!map) return;
		map.setLayoutProperty('metro-stations', 'visibility', showMetroStations ? 'visible' : 'none');
	});

	$effect(() => {
		if (!map) return;
		map.setLayoutProperty('metro-lines', 'visibility', showMetroLines ? 'visible' : 'none');
	});

	$effect(() => {
		if (!map) return;
		map.setLayoutProperty('companies', 'visibility', showCompanies ? 'visible' : 'none');
	});

	$effect(() => {
		if (!map) return;
		map.setLayoutProperty('rail-stations', 'visibility', showRailStations ? 'visible' : 'none');
	});

	$effect(() => {
		if (!map) return;
		map.setLayoutProperty('rail-lines', 'visibility', showRailLines ? 'visible' : 'none');
	});

	$effect(() => {
		if (!map) return;
		map.setLayoutProperty('transit-points', 'visibility', showTransitPoints ? 'visible' : 'none');
	});

	$effect(() => {
		if (!map) return;

		if (showCatchmentWalk400) {
			const rings = generateCatchmentRings(CATCHMENT.WALK_NEAR);
			(map.getSource('catchment-walk-400') as maplibregl.GeoJSONSource).setData(rings);
		}

		map.setLayoutProperty(
			'catchment-walk-400-fill',
			'visibility',
			showCatchmentWalk400 ? 'visible' : 'none'
		);
		map.setLayoutProperty(
			'catchment-walk-400-border',
			'visibility',
			showCatchmentWalk400 ? 'visible' : 'none'
		);
	});

	$effect(() => {
		if (!map) return;

		if (showCatchmentWalk800) {
			const rings = generateCatchmentRings(CATCHMENT.WALK_FAR);
			(map.getSource('catchment-walk-800') as maplibregl.GeoJSONSource).setData(rings);
		}

		map.setLayoutProperty(
			'catchment-walk-800-fill',
			'visibility',
			showCatchmentWalk800 ? 'visible' : 'none'
		);
		map.setLayoutProperty(
			'catchment-walk-800-border',
			'visibility',
			showCatchmentWalk800 ? 'visible' : 'none'
		);
	});

	$effect(() => {
		if (!map) return;

		if (showCatchmentCycle) {
			const rings = generateCatchmentRings(CATCHMENT.CYCLE);
			(map.getSource('catchment-cycle') as maplibregl.GeoJSONSource).setData(rings);
		}

		map.setLayoutProperty(
			'catchment-cycle-fill',
			'visibility',
			showCatchmentCycle ? 'visible' : 'none'
		);
		map.setLayoutProperty(
			'catchment-cycle-border',
			'visibility',
			showCatchmentCycle ? 'visible' : 'none'
		);
	});
</script>

<svelte:head>
	<title>Access — Altmo Intelligence</title>
	<link rel="stylesheet" href="https://unpkg.com/maplibre-gl/dist/maplibre-gl.css" />
</svelte:head>

<div class="flex h-[calc(100vh-4rem)] flex-col lg:flex-row">
	<aside
		class="w-full border-b border-border bg-surface-card p-4 lg:w-80 lg:overflow-y-auto lg:border-b-0 lg:border-r"
	>
		<h1 class="text-lg font-bold text-text-primary">Access</h1>
		<p class="mt-1 text-sm text-text-secondary">
			First/last mile walking and cycling access to transit.
		</p>

		<div class="mt-6 space-y-4">
			<div>
				<h3 class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Transit</h3>
				<div class="mt-2 space-y-1">
					<MapLayerToggle
						label="Bus stops"
						color={TRANSIT_COLORS.bus}
						count={data.busStopCount}
						bind:checked={showBusStops}
					/>
					{#if data.metroStationCount > 0}
					<MapLayerToggle
						label="Metro stations"
						color={TRANSIT_COLORS.metro}
						count={data.metroStationCount}
						bind:checked={showMetroStations}
					/>
					<MapLayerToggle
						label="Metro lines"
						color={TRANSIT_COLORS.metro}
						bind:checked={showMetroLines}
					/>
					{/if}
					{#if data.railStationCount > 0}
					<MapLayerToggle
						label="Suburban rail stations"
						color={TRANSIT_COLORS.railSuburban}
						count={data.railStationCount}
						bind:checked={showRailStations}
					/>
					<MapLayerToggle
						label="Suburban rail lines"
						color={TRANSIT_COLORS.railSuburban}
						bind:checked={showRailLines}
					/>
					{/if}
				</div>
			</div>

			{#if data.companyCount > 0 || data.transitPointCount > 0}
			<div>
				<h3 class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Demand Indicators</h3>
				<div class="mt-2 space-y-1">
					{#if data.companyCount > 0}
					<MapLayerToggle
						label="Commuter Destinations"
						color="#FF7B27"
						count={data.companyCount}
						bind:checked={showCompanies}
					/>
					{/if}
					{#if data.transitPointCount > 0}
					<MapLayerToggle
						label="Transit Points (Altmo)"
						color="#059669"
						count={data.transitPointCount}
						bind:checked={showTransitPoints}
					/>
					{/if}
				</div>
			</div>
			{/if}

			<div>
				<h3 class="text-xs font-semibold uppercase tracking-wide text-text-secondary">
					Catchment Analysis
				</h3>
				<div class="mt-2 space-y-1">
					<MapLayerToggle
						label="Walking (400m)"
						color={TRANSIT_COLORS.catchmentWalk}
						bind:checked={showCatchmentWalk400}
					/>
					<MapLayerToggle
						label="Walking (800m)"
						color={TRANSIT_COLORS.catchmentWalk}
						bind:checked={showCatchmentWalk800}
					/>
					<MapLayerToggle
						label="Cycling (2km)"
						color={TRANSIT_COLORS.catchmentCycle}
						bind:checked={showCatchmentCycle}
					/>
				</div>
				{#if showCatchmentWalk400 || showCatchmentWalk800 || showCatchmentCycle}
					<div class="mt-2 rounded border border-border bg-surface-elevated p-2">
						<CatchmentRingLegend />
					</div>
				{/if}
			</div>
		</div>

		<div class="mt-4 space-y-4">
			<CityQoLSummary cityId={data.cityId} overrides={data.qolOverrides} />
			<CityDataLayers cityId={data.cityId} />
		</div>

		<div class="mt-6 border-t border-border pt-4">
			<h3 class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Data Sources</h3>
			<div class="mt-2 space-y-1 text-xs text-text-secondary">
				<p>
					<a href="https://github.com/Vonter/transitrouter" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline">TransitRouter</a>
					(MIT) — Bus stops &amp; routes
				</p>
				{#if data.cityId === 'bengaluru'}
				<p>
					<a href="https://github.com/geohacker/namma-metro" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline">Namma Metro</a>
					— Station locations &amp; lines
				</p>
				{:else if data.metroStationCount > 0}
				<p>
					<a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline">OpenStreetMap</a>
					— Metro stations &amp; lines
				</p>
				{/if}
				{#if data.railStationCount > 0}
				<p>
					<a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline">OpenStreetMap</a>
					— Suburban rail stations &amp; lines
				</p>
				{/if}
			</div>
		</div>
	</aside>

	<div class="flex-1">
		{#if !data.hasTransitSources}
			<div class="flex h-full items-center justify-center bg-surface-elevated">
				<div class="text-center">
					<p class="text-lg font-semibold text-text-primary">No transit data available for {data.cityName}</p>
					<p class="mt-2 text-sm text-text-secondary">Transit data sources have not been configured for this city yet.</p>
				</div>
			</div>
		{:else}
			{#await import('$lib/components/Map.svelte')}
				<div class="flex h-full items-center justify-center bg-surface-elevated">
					<div class="text-center">
						<i class="fa-solid fa-spinner fa-spin text-3xl text-text-secondary"></i>
						<p class="mt-3 text-sm text-text-secondary">Loading map for {data.cityName}...</p>
					</div>
				</div>
			{:then { default: Map }}
				<Map center={data.cityCenter} zoom={data.cityZoom} onReady={onMapReady} />
			{/await}
		{/if}
	</div>
</div>
