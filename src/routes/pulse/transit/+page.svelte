<script lang="ts">
	import MetricCard from '$lib/components/MetricCard.svelte';
	import Chart from '$lib/components/Chart.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import CityQoLSummary from '$lib/components/CityQoLSummary.svelte';
	import type { PageData } from './$types';
	import { selectedCity } from '$lib/stores/city';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	// Track current city from server data
	let currentCityId = $derived(data.cityId);

	// Sync city store on load
	$effect(() => {
		if (data.cityId && data.cityName) {
			const city = $selectedCity;
			if (!city || city.id !== data.cityId) {
				selectedCity.set({
					id: data.cityId,
					name: data.cityName,
					lat: 0, lng: 0, zoom: 12
				});
			}
		}
	});

	// Watch city store for changes
	$effect(() => {
		const city = $selectedCity;
		if (city && city.id !== currentCityId) {
			goto(`/pulse/transit?city=${city.id}`);
		}
	});

	// --- Metro line colors ---
	const lineColors: Record<string, string> = {
		purple: '#9333ea',
		green: '#16a34a',
		yellow: '#eab308',
		pink: '#ec4899',
		blue: '#2563eb'
	};

	// --- Ridership data ---
	const hasRidership = $derived(!!data.ridership);

	// Peak hours bar chart
	const peakHoursChartData = $derived(
		data.ridership?.peakHours
			? {
					labels: data.ridership.peakHours.map((h: { hour: number }) => {
						const hr = h.hour;
						if (hr === 0) return '12am';
						if (hr < 12) return `${hr}am`;
						if (hr === 12) return '12pm';
						return `${hr - 12}pm`;
					}),
					datasets: [
						{
							label: 'Avg Boardings',
							data: data.ridership.peakHours.map((h: { ridership: number }) => h.ridership),
							backgroundColor: data.ridership.peakHours.map((h: { hour: number }) =>
								(h.hour >= 8 && h.hour <= 10) || (h.hour >= 17 && h.hour <= 20)
									? '#9333ea'
									: '#c4b5fd'
							),
							borderRadius: 2
						}
					]
				}
			: null
	);

	const peakHoursChartOptions = {
		plugins: {
			legend: { display: false }
		},
		scales: {
			y: {
				beginAtZero: true,
				ticks: {
					callback: (value: number) =>
						value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)
				}
			},
			x: {
				ticks: {
					maxRotation: 0,
					autoSkip: true,
					maxTicksLimit: 12
				}
			}
		}
	};

	// Ridership by line doughnut
	const ridershipByLineChartData = $derived(
		data.ridership?.ridershipByLine
			? (() => {
					const entries = Object.entries(data.ridership.ridershipByLine as Record<string, number>)
						.filter(([line]) => line !== 'other')
						.sort((a, b) => b[1] - a[1]);
					return {
						labels: entries.map(([line]) => `${line.charAt(0).toUpperCase()}${line.slice(1)} Line`),
						datasets: [
							{
								data: entries.map(([, count]) => count),
								backgroundColor: entries.map(([line]) => lineColors[line] ?? '#94a3b8')
							}
						]
					};
				})()
			: null
	);

	const ridershipByLineChartOptions = {
		plugins: {
			legend: { position: 'bottom' as const }
		}
	};

	// Busiest metro stations table
	const busiestMetroRows = $derived(
		(data.ridership?.busiestStations ?? []).map(
			(s: { name: string; ridership: number }, i: number) => ({
				rank: i + 1,
				name: s.name,
				ridership: s.ridership.toLocaleString()
			})
		)
	);

	const busiestMetroColumns = [
		{ key: 'rank', label: '#', align: 'center' as const },
		{ key: 'name', label: 'Station' },
		{ key: 'ridership', label: 'Avg Daily', align: 'right' as const }
	];

	// Busiest bus hubs table
	const busiestBusRows = $derived(
		data.topHubs.map((hub: { name: string; routeCount: number }, i: number) => ({
			rank: i + 1,
			name: hub.name,
			routeCount: hub.routeCount
		}))
	);

	const busiestBusColumns = [
		{ key: 'rank', label: '#', align: 'center' as const },
		{ key: 'name', label: 'Bus Stop' },
		{ key: 'routeCount', label: 'Routes', align: 'right' as const }
	];
</script>

<div class="space-y-6">
	<!-- City QoL Summary -->
	<CityQoLSummary cityId={data.cityId} />

	{#if !data.hasTransitSources}
		<div class="flex items-center justify-center rounded-xl border border-border bg-surface-card p-12">
			<div class="text-center">
				<p class="text-lg font-semibold text-text-primary">No transit data available for {data.cityName}</p>
				<p class="mt-2 text-sm text-text-secondary">Transit data sources have not been configured for this city yet.</p>
			</div>
		</div>
	{:else}

	<!-- Section 1: Ridership Headlines -->
	{#if hasRidership}
		{@const r = data.ridership!}
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
			<MetricCard
				label="Metro Ridership (daily avg)"
				value={r.totalDailyRidership.toLocaleString()}
				icon="fa-solid fa-train-subway"
			/>
			<MetricCard
				label="Bus Ridership (daily est.)"
				value="49.1 lakh"
				icon="fa-solid fa-bus"
			/>
			<MetricCard
				label="Bus Fleet"
				value="6,340"
				icon="fa-solid fa-bus-simple"
			/>
			<MetricCard
				label="Bus Routes"
				value={data.metrics.totalBusRoutes.toLocaleString()}
				icon="fa-solid fa-route"
			/>
		</div>
		<p class="text-xs text-text-secondary -mt-4">
			Metro ridership: BMRCL RTI data ({r.dateRange.from} to {r.dateRange.to}). Bus ridership: BMTC official estimate (stop-level data not publicly available).
		</p>
	{:else}
		<!-- No ridership: show network stats as hero -->
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
			<MetricCard
				label="Bus Stops"
				value={data.metrics.totalBusStops.toLocaleString()}
				icon="fa-solid fa-bus"
			/>
			<MetricCard
				label="Metro Stations"
				value={data.metrics.totalMetroStations.toLocaleString()}
				icon="fa-solid fa-train-subway"
			/>
			<MetricCard
				label="Bus Routes"
				value={data.metrics.totalBusRoutes.toLocaleString()}
				icon="fa-solid fa-route"
			/>
			<MetricCard
				label="Avg Routes/Stop"
				value={data.metrics.avgRoutesPerStop.toFixed(1)}
				icon="fa-solid fa-chart-simple"
			/>
		</div>
	{/if}

	<!-- Section 2: Peak Hours + Ridership by Line (most impactful visuals) -->
	{#if hasRidership}
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
			{#if peakHoursChartData}
				<div class="lg:col-span-2 rounded-xl border border-border bg-surface-card p-6">
					<h3 class="text-lg font-semibold text-text-primary mb-1">Metro Ridership by Time of Day</h3>
					<p class="text-sm text-text-secondary mb-4">Avg daily boardings per hour — peak hours highlighted</p>
					<Chart
						type="bar"
						data={peakHoursChartData}
						options={peakHoursChartOptions}
						class="h-72"
					/>
				</div>
			{/if}

			{#if ridershipByLineChartData}
				<div class="rounded-xl border border-border bg-surface-card p-6">
					<h3 class="text-lg font-semibold text-text-primary mb-1">Ridership by Line</h3>
					<p class="text-sm text-text-secondary mb-4">Avg daily boardings</p>
					<Chart
						type="doughnut"
						data={ridershipByLineChartData}
						options={ridershipByLineChartOptions}
						class="h-64"
					/>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Section 3: Busiest Hubs (metro + bus side by side) -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		{#if hasRidership && busiestMetroRows.length > 0}
			<div class="rounded-xl border border-border bg-surface-card p-6">
				<div class="flex items-center gap-2 mb-1">
					<i class="fa-solid fa-train-subway text-transit-metro"></i>
					<h3 class="text-lg font-semibold text-text-primary">Busiest Metro Stations</h3>
				</div>
				<p class="text-sm text-text-secondary mb-4">By avg daily boardings (BMRCL RTI data)</p>
				<div class="max-h-96 overflow-y-auto">
					<DataTable columns={busiestMetroColumns} rows={busiestMetroRows} />
				</div>
			</div>
		{/if}

		<div class="rounded-xl border border-border bg-surface-card p-6">
			<div class="flex items-center gap-2 mb-1">
				<i class="fa-solid fa-bus text-transit-bus"></i>
				<h3 class="text-lg font-semibold text-text-primary">Busiest Bus Stops</h3>
			</div>
			<p class="text-sm text-text-secondary mb-4">By route count (proxy for passenger volume)</p>
			<div class="max-h-96 overflow-y-auto">
				<DataTable columns={busiestBusColumns} rows={busiestBusRows} />
			</div>
		</div>
	</div>

	<!-- Section 4: Network Overview + First/Last Mile -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Network Summary (compact, not station-by-station) -->
		<div class="rounded-xl border border-border bg-surface-card p-6">
			<h3 class="text-lg font-semibold text-text-primary mb-4">Network Summary</h3>

			<!-- Metro lines as compact pills -->
			{#if Object.keys(data.metroByLine).length > 0}
				<div class="mb-4">
					<h4 class="text-sm font-medium text-text-secondary mb-2">Metro Lines</h4>
					<div class="flex flex-wrap gap-2">
						{#each Object.entries(data.metroByLine) as [lineName, stations]}
							<span
								class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-white"
								style="background-color: {lineColors[lineName] || '#9333ea'}"
							>
								{lineName.charAt(0).toUpperCase()}{lineName.slice(1)}
								<span class="rounded-full bg-white/20 px-1.5 text-xs">{stations.length}</span>
							</span>
						{/each}
					</div>
					<p class="mt-2 text-sm text-text-secondary">
						{data.metrics.totalMetroStations} stations across {Object.keys(data.metroByLine).length} lines
					</p>
				</div>
			{/if}

			<!-- Bus network stats -->
			<div>
				<h4 class="text-sm font-medium text-text-secondary mb-2">Bus Network</h4>
				<div class="grid grid-cols-2 gap-3">
					<div class="rounded-lg bg-earth-50 p-3">
						<p class="text-2xl font-bold text-text-primary">{data.metrics.totalBusStops.toLocaleString()}</p>
						<p class="text-xs text-text-secondary">Stops mapped</p>
					</div>
					<div class="rounded-lg bg-earth-50 p-3">
						<p class="text-2xl font-bold text-text-primary">{data.metrics.totalBusRoutes.toLocaleString()}</p>
						<p class="text-xs text-text-secondary">Routes</p>
					</div>
					<div class="rounded-lg bg-earth-50 p-3">
						<p class="text-2xl font-bold text-text-primary">{data.metrics.avgRoutesPerStop.toFixed(1)}</p>
						<p class="text-xs text-text-secondary">Avg routes/stop</p>
					</div>
					<div class="rounded-lg bg-earth-50 p-3">
						<p class="text-2xl font-bold text-text-primary">{data.topHubs[0]?.routeCount ?? '—'}</p>
						<p class="text-xs text-text-secondary">Max routes (top hub)</p>
					</div>
				</div>
			</div>
		</div>

		<!-- First/Last Mile Context -->
		<div class="rounded-xl border border-border bg-surface-card p-6">
			<h3 class="text-lg font-semibold text-text-primary mb-4">First/Last Mile Access</h3>
			<div class="space-y-3 text-sm">
				<div class="rounded-lg bg-earth-50 p-4">
					<div class="flex items-center gap-2 mb-2">
						<i class="fa-solid fa-person-walking text-mode-walk"></i>
						<h4 class="font-semibold text-text-primary">Walking Catchment</h4>
					</div>
					<div class="grid grid-cols-2 gap-2 text-text-secondary">
						<div>
							<span class="text-lg font-bold text-text-primary">400m</span>
							<p class="text-xs">Comfortable walk</p>
						</div>
						<div>
							<span class="text-lg font-bold text-text-primary">800m</span>
							<p class="text-xs">Maximum walk</p>
						</div>
					</div>
				</div>

				<div class="rounded-lg bg-earth-50 p-4">
					<div class="flex items-center gap-2 mb-2">
						<i class="fa-solid fa-bicycle text-mode-ride"></i>
						<h4 class="font-semibold text-text-primary">Cycling Catchment</h4>
					</div>
					<div class="text-text-secondary">
						<span class="text-lg font-bold text-text-primary">2 km</span>
						<p class="text-xs">Effective cycling radius to transit</p>
					</div>
				</div>

				{#if data.cityId === 'bengaluru'}
				<div class="rounded-lg border border-clay-200 bg-clay-50 p-4">
					<div class="flex items-center gap-2 mb-2">
						<i class="fa-solid fa-triangle-exclamation text-clay-600"></i>
						<h4 class="font-semibold text-text-primary">Bengaluru Infrastructure</h4>
					</div>
					<div class="grid grid-cols-2 gap-2 text-text-secondary text-xs mb-2">
						<div><span class="text-sm font-bold text-text-primary">100 km</span> walkable footpath</div>
						<div><span class="text-sm font-bold text-text-primary">8 km</span> cycle lanes</div>
						<div><span class="text-sm font-bold text-text-primary">45</span> cycle stands</div>
						<div><span class="text-sm font-bold text-text-primary">83</span> metro stations</div>
					</div>
					<ul class="space-y-1 text-text-secondary text-xs">
						<li>65% of metro users walk to stations</li>
						<li>292 pedestrian deaths in 2023 — highest in 13 years</li>
					</ul>
					<p class="mt-2 text-xs text-text-secondary">
						Source: <a href="https://hejjegala.in" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline">Hejje Gala</a>
						— GBA active mobility challenge using Altmo
					</p>
				</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Section 5: Data Sources -->
	<div class="rounded-xl border border-border bg-surface-card p-6">
		<h3 class="text-lg font-semibold text-text-primary mb-4">Data Sources</h3>
		<div class="grid grid-cols-1 gap-2 text-sm text-text-secondary sm:grid-cols-2">
			<p>
				<a href="https://github.com/Vonter/transitrouter" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline">TransitRouter (MIT)</a>
				— Bus stop and route topology
			</p>
			{#if data.cityId === 'bengaluru'}
			<p>
				<a href="https://github.com/Vonter/bmrcl-ridership-hourly" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline">BMRCL Ridership (CC BY 4.0)</a>
				— Hourly station-wise metro ridership via RTI
			</p>
			<p>
				<a href="https://mybmtc.karnataka.gov.in/info-1/BMTC+Glance/en" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline">BMTC Official</a>
				— Fleet size, daily ridership estimates
			</p>
			<p>
				<a href="https://github.com/geohacker/namma-metro" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline">Namma Metro</a>
				— Station locations and line geometry
			</p>
			<p>
				<a href="https://hejjegala.in" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline">Hejje Gala</a>
				— GBA active mobility challenge using Altmo
			</p>
			<p>
				<a href="https://opencity.in/road-crashes-in-bengaluru-2023/" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline">OpenCity / NCRB</a>
				— Road safety data
			</p>
			{/if}
		</div>
	</div>

	{/if}
</div>
