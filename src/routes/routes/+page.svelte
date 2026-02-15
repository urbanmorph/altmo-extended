<script lang="ts">
	import type maplibregl from 'maplibre-gl';
	import MetricCard from '$lib/components/MetricCard.svelte';
	import Chart from '$lib/components/Chart.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import type { PageData } from './$types';
	import { selectedCity } from '$lib/stores/city';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let map = $state<maplibregl.Map | null>(null);
	let layersAdded = $state(false);

	let currentCityId = $derived(data.cityId);

	$effect(() => {
		if (data.cityId && data.cityName) {
			const city = $selectedCity;
			if (!city || city.id !== data.cityId) {
				selectedCity.set({ id: data.cityId, name: data.cityName, lat: 0, lng: 0, zoom: 12 });
			}
		}
	});

	$effect(() => {
		const city = $selectedCity;
		if (city && city.id !== currentCityId) {
			goto(`/routes?city=${city.id}`);
		}
	});

	// Update map data when city changes
	$effect(() => {
		if (!map || !layersAdded) return;
		const density = data.densityGeoJSON;
		const center = data.cityCenter;
		const zoom = data.cityZoom;

		try {
			const source = map.getSource('route-density') as maplibregl.GeoJSONSource | undefined;
			if (source) source.setData(density as GeoJSON.FeatureCollection);
			map.flyTo({ center: center as [number, number], zoom });
		} catch (err) {
			console.error('[routes-map] Failed to update map sources:', err);
		}
	});

	function onMapReady(mapInstance: maplibregl.Map) {
		map = mapInstance;

		try {
			// Compute max total for circle scaling
			const maxTotal = Math.max(
				1,
				...data.densityGeoJSON.features.map(
					(f: GeoJSON.Feature) => (f.properties?.total as number) ?? 0
				)
			);
			// Log-scale max for weight normalization — prevents extreme values
			// from making all other cells invisible
			const logMax = Math.log10(maxTotal + 1);

			mapInstance.addSource('route-density', {
				type: 'geojson',
				data: data.densityGeoJSON as GeoJSON.FeatureCollection
			});

			// Heatmap layer: blue (low) → amber (medium) → red (high)
			// Weight uses log10 scale so low-density cells remain visible
			mapInstance.addLayer({
				id: 'density-heatmap',
				type: 'heatmap',
				source: 'route-density',
				paint: {
					// Weight: log10(total+1) / log10(max+1) — maps 1→~0.08, 10→~0.26, 100→~0.53, 1000→~0.79
					'heatmap-weight': [
						'interpolate', ['linear'],
						['/', ['log10', ['+', ['get', 'total'], 1]], logMax],
						0, 0,
						1, 1
					],
					// Increase intensity at lower zoom
					'heatmap-intensity': [
						'interpolate', ['linear'], ['zoom'],
						8, 0.6,
						11, 1,
						13, 1.2,
						16, 1.5
					],
					// Color ramp: blue → cyan → green → amber → red
					'heatmap-color': [
						'interpolate', ['linear'], ['heatmap-density'],
						0, 'rgba(0, 0, 0, 0)',
						0.1, 'rgba(33, 102, 172, 0.4)',
						0.3, 'rgba(103, 169, 207, 0.6)',
						0.5, 'rgba(1, 170, 20, 0.7)',
						0.7, 'rgba(255, 179, 28, 0.8)',
						0.9, 'rgba(240, 59, 32, 0.9)',
						1.0, 'rgba(189, 0, 38, 1)'
					],
					// Radius increases at higher zoom for tighter road-following
					'heatmap-radius': [
						'interpolate', ['linear'], ['zoom'],
						8, 6,
						11, 12,
						13, 20,
						15, 35,
						17, 50
					],
					// Fade out heatmap at very high zoom, show circles instead
					'heatmap-opacity': [
						'interpolate', ['linear'], ['zoom'],
						15, 1,
						17, 0.6
					]
				}
			});

			// Circle layer: visible at high zoom for precise locations
			mapInstance.addLayer({
				id: 'density-circles',
				type: 'circle',
				source: 'route-density',
				minzoom: 14,
				paint: {
					'circle-radius': [
						'interpolate', ['linear'], ['get', 'total'],
						1, 3,
						maxTotal, 10
					],
					'circle-color': [
						'interpolate', ['linear'], ['get', 'total'],
						1, '#2166ac',
						Math.ceil(maxTotal * 0.3), '#01aa14',
						Math.ceil(maxTotal * 0.6), '#ffb31c',
						maxTotal, '#bd0026'
					],
					'circle-opacity': [
						'interpolate', ['linear'], ['zoom'],
						14, 0,
						15, 0.6,
						17, 0.9
					],
					'circle-stroke-width': 0.5,
					'circle-stroke-color': 'rgba(255,255,255,0.5)'
				}
			});

			// Click popup on circles
			mapInstance.on('click', 'density-circles', (e) => {
				if (!e.features || e.features.length === 0) return;
				const f = e.features[0];
				const total = f.properties?.total ?? 0;
				const rides = f.properties?.rides ?? 0;
				const walks = f.properties?.walks ?? 0;

				import('maplibre-gl').then(({ Popup }) => {
					new Popup()
						.setLngLat(e.lngLat)
						.setHTML(
							`<div class="text-sm">
								<div class="font-semibold">${total.toLocaleString()} activities</div>
								<div class="text-text-secondary">${rides.toLocaleString()} rides, ${walks.toLocaleString()} walks</div>
							</div>`
						)
						.addTo(mapInstance);
				});
			});

			mapInstance.on('mouseenter', 'density-circles', () => {
				mapInstance.getCanvas().style.cursor = 'pointer';
			});
			mapInstance.on('mouseleave', 'density-circles', () => {
				mapInstance.getCanvas().style.cursor = '';
			});

			layersAdded = true;
		} catch (err) {
			console.error('[routes-map] Failed to add map layers:', err);
		}
	}

	const hasData = $derived(data.summary.totalTrips > 0);
	const hasDensity = $derived(data.densityCellCount > 0);

	// Mode split doughnut chart
	const modeColors: Record<string, string> = {
		Ride: '#000080',
		Walk: '#df7e37',
		Run: '#1d531f'
	};

	const modeChartData = $derived(
		hasData
			? {
					labels: data.summary.modeBreakdown.map((m) => m.mode),
					datasets: [
						{
							data: data.summary.modeBreakdown.map((m) => m.count),
							backgroundColor: data.summary.modeBreakdown.map(
								(m) => modeColors[m.mode] ?? '#94a3b8'
							)
						}
					]
				}
			: null
	);

	const modeChartOptions = {
		plugins: {
			legend: { position: 'bottom' as const }
		}
	};

	// Corridors table
	const corridorColumns = [
		{ key: 'rank', label: '#', align: 'center' as const },
		{ key: 'startArea', label: 'Origin' },
		{ key: 'endArea', label: 'Destination' },
		{ key: 'count', label: 'Trips', align: 'right' as const },
		{ key: 'avgDistanceKm', label: 'Avg Dist (km)', align: 'right' as const },
		{ key: 'primaryMode', label: 'Mode' }
	];

	const corridorRows = $derived(
		data.corridors.map((c, i) => ({
			rank: i + 1,
			startArea: c.startArea,
			endArea: c.endArea,
			count: c.count.toLocaleString(),
			avgDistanceKm: c.avgDistanceKm.toFixed(1),
			primaryMode: c.primaryMode
		}))
	);
</script>

<svelte:head>
	<title>Route Explorer — Altmo Intelligence</title>
	<link rel="stylesheet" href="https://unpkg.com/maplibre-gl/dist/maplibre-gl.css" />
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	<h1 class="text-2xl font-bold text-text-primary">Route Explorer</h1>
	<p class="mt-1 text-text-secondary">
		Route analysis and corridor insights for {data.cityName}.
	</p>

	{#if !hasData}
		<div class="mt-6 flex items-center justify-center rounded-xl border border-border bg-surface-card p-12">
			<div class="text-center">
				<i class="fa-solid fa-route text-4xl text-text-secondary mb-4"></i>
				<p class="text-lg font-semibold text-text-primary">No activity data available for {data.cityName}</p>
				<p class="mt-2 text-sm text-text-secondary">
					Activity route data has not been synced yet. Run the ETL sync-routes job to populate this page.
				</p>
			</div>
		</div>
	{:else}
		<!-- Metric cards -->
		<div class="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
			<MetricCard
				label="Total Routes Analyzed"
				value={data.summary.totalTrips.toLocaleString()}
				icon="fa-solid fa-route"
			/>
			<MetricCard
				label="Total Distance Covered"
				value="{data.summary.totalDistanceKm.toLocaleString()} km"
				icon="fa-solid fa-road"
			/>
			<MetricCard
				label="Avg Trip Distance"
				value="{data.summary.avgDistanceKm} km"
				icon="fa-solid fa-ruler"
			/>
		</div>

		<!-- H3 Density Heatmap -->
		{#if hasDensity}
			<div class="mt-6 rounded-xl border border-border bg-surface-card p-6">
				<div class="mb-4 flex items-center justify-between">
					<div>
						<h2 class="text-lg font-semibold text-text-primary">Activity Density</h2>
						<p class="text-sm text-text-secondary">
							Route density heatmap showing activity concentration ({data.densityCellCount.toLocaleString()} data points)
						</p>
					</div>
					<!-- Legend -->
					<div class="flex items-center gap-2 text-xs text-text-secondary">
						<span>Low</span>
						<div class="flex h-3 w-28 rounded overflow-hidden">
							<div class="flex-1" style="background: rgba(33, 102, 172, 0.6)"></div>
							<div class="flex-1" style="background: rgba(103, 169, 207, 0.7)"></div>
							<div class="flex-1" style="background: rgba(1, 170, 20, 0.8)"></div>
							<div class="flex-1" style="background: rgba(255, 179, 28, 0.9)"></div>
							<div class="flex-1" style="background: rgba(240, 59, 32, 0.95)"></div>
							<div class="flex-1" style="background: rgba(189, 0, 38, 1)"></div>
						</div>
						<span>High</span>
					</div>
				</div>
				<div class="h-96 rounded-lg overflow-hidden">
					{#await import('$lib/components/Map.svelte')}
						<div class="flex h-full items-center justify-center bg-surface-elevated">
							<div class="text-center">
								<i class="fa-solid fa-spinner fa-spin text-3xl text-text-secondary"></i>
								<p class="mt-3 text-sm text-text-secondary">Loading map...</p>
							</div>
						</div>
					{:then { default: Map }}
						<Map center={data.cityCenter} zoom={data.cityZoom} onReady={onMapReady} />
					{/await}
				</div>
			</div>
		{/if}

		<!-- Mode split + Corridors -->
		<div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
			{#if modeChartData}
				<div class="rounded-xl border border-border bg-surface-card p-6">
					<h2 class="text-lg font-semibold text-text-primary mb-1">Mode Split</h2>
					<p class="text-sm text-text-secondary mb-4">Activity type distribution</p>
					<Chart type="doughnut" data={modeChartData} options={modeChartOptions} class="h-64" />
				</div>
			{/if}

			<div class="lg:col-span-2 rounded-xl border border-border bg-surface-card p-6">
				<h2 class="text-lg font-semibold text-text-primary mb-1">Top Corridors</h2>
				<p class="text-sm text-text-secondary mb-4">
					Most-used origin-destination pairs (bucketed to ~1km grid)
				</p>
				{#if corridorRows.length > 0}
					<div class="max-h-96 overflow-y-auto">
						<DataTable columns={corridorColumns} rows={corridorRows} />
					</div>
				{:else}
					<p class="text-sm text-text-secondary">No corridor data available.</p>
				{/if}
			</div>
		</div>

		<!-- Direction breakdown -->
		<div class="mt-6 rounded-xl border border-border bg-surface-card p-6">
			<h2 class="text-lg font-semibold text-text-primary mb-4">Trip Direction Breakdown</h2>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
				{#each data.summary.directionBreakdown as dir}
					<div class="rounded-lg bg-earth-50 p-4">
						<p class="text-sm font-medium text-text-secondary capitalize">
							{dir.direction === 'to_work' ? 'To Work' : dir.direction === 'from_work' ? 'From Work' : 'Leisure'}
						</p>
						<p class="mt-1 text-2xl font-bold text-text-primary">{dir.count.toLocaleString()}</p>
						<p class="text-xs text-text-secondary">{dir.pct.toFixed(1)}% of all trips</p>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
