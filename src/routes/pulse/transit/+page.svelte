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

	// --- Transit Proximity (First/Last Mile) ---
	const hasTransitProximity = $derived(!!data.transitProximity && data.transitProximity.connected > 0);

	// Transit type badges
	const transitTypeBadgeColor: Record<string, string> = {
		metro: '#9333ea',
		rail: '#dc2626',
		bus: '#2563eb'
	};

	// Top stations table for first/last mile
	const proximityStationRows = $derived(
		(data.transitProximity?.topStations ?? []).map(
			(s: { name: string; type: string; line: string; count: number; avgDistM: number }, i: number) => ({
				rank: i + 1,
				name: s.name,
				type: s.type,
				line: s.line,
				count: s.count,
				avgDist: s.avgDistM < 1000 ? `${s.avgDistM}m` : `${(s.avgDistM / 1000).toFixed(1)}km`
			})
		)
	);

	const proximityStationColumns = [
		{ key: 'rank', label: '#', align: 'center' as const },
		{ key: 'name', label: 'Station' },
		{ key: 'type', label: 'Type', align: 'center' as const },
		{ key: 'count', label: 'Connections', align: 'right' as const },
		{ key: 'avgDist', label: 'Avg Distance', align: 'right' as const }
	];

	// Mode split doughnut for transit-connected trips
	const transitModeSplitData = $derived(
		data.transitProximity?.byMode
			? (() => {
					const entries = Object.entries(data.transitProximity.byMode as Record<string, number>)
						.sort((a, b) => b[1] - a[1]);
					if (entries.length === 0) return null;
					const modeColors: Record<string, string> = {
						Ride: '#000080',
						Walk: '#df7e37',
						Run: '#1d531f'
					};
					return {
						labels: entries.map(([mode]) => mode),
						datasets: [{
							data: entries.map(([, count]) => count),
							backgroundColor: entries.map(([mode]) => modeColors[mode] ?? '#94a3b8')
						}]
					};
				})()
			: null
	);

	// Transit type bar chart
	const transitTypeBarData = $derived(
		data.transitProximity?.byTransitType
			? (() => {
					const entries = Object.entries(data.transitProximity.byTransitType as Record<string, number>)
						.sort((a, b) => b[1] - a[1]);
					if (entries.length === 0) return null;
					return {
						labels: entries.map(([type]) => type.charAt(0).toUpperCase() + type.slice(1)),
						datasets: [{
							label: 'Connections',
							data: entries.map(([, count]) => count),
							backgroundColor: entries.map(([type]) => transitTypeBadgeColor[type] ?? '#94a3b8'),
							borderRadius: 4
						}]
					};
				})()
			: null
	);

	const transitTypeBarOptions = {
		indexAxis: 'y' as const,
		plugins: { legend: { display: false } },
		scales: {
			x: { beginAtZero: true },
			y: { ticks: { font: { size: 13 } } }
		}
	};
</script>

<div class="space-y-6">
	<!-- City QoL Summary -->
	<CityQoLSummary cityId={data.cityId} overrides={data.qolOverrides} />

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
			{#if (data.metrics.totalRailStations ?? 0) > 0}
				<MetricCard
					label="Suburban Rail Stations"
					value={(data.metrics.totalRailStations ?? 0).toLocaleString()}
					icon="fa-solid fa-train"
				/>
			{/if}
			<MetricCard
				label="Bus Routes"
				value={data.metrics.totalBusRoutes.toLocaleString()}
				icon="fa-solid fa-route"
			/>
			{#if !(data.metrics.totalRailStations ?? 0)}
				<MetricCard
					label="Avg Routes/Stop"
					value={data.metrics.avgRoutesPerStop.toFixed(1)}
					icon="fa-solid fa-chart-simple"
				/>
			{/if}
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

			<!-- Suburban rail lines as compact pills -->
			{#if data.railByLine && Object.keys(data.railByLine).length > 0}
				<div class="mb-4">
					<h4 class="text-sm font-medium text-text-secondary mb-2">Suburban Rail Lines</h4>
					<div class="flex flex-wrap gap-2">
						{#each Object.entries(data.railByLine) as [lineName, stations]}
							<span
								class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-white"
								style="background-color: #b45309"
							>
								{lineName}
								<span class="rounded-full bg-white/20 px-1.5 text-xs">{stations.length}</span>
							</span>
						{/each}
					</div>
					<p class="mt-2 text-sm text-text-secondary">
						{data.metrics.totalRailStations ?? 0} stations across {Object.keys(data.railByLine).length} corridors
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

		<!-- First/Last Mile Access — data-driven -->
		<div class="rounded-xl border border-border bg-surface-card p-6">
			<h3 class="text-lg font-semibold text-text-primary mb-4">First & Last Mile Access</h3>

			{#if hasTransitProximity}
				{@const tp = data.transitProximity!}
				<!-- Headline metrics -->
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
					<div class="rounded-lg bg-earth-50 p-4 text-center">
						<p class="text-2xl font-bold text-text-primary">{tp.connected.toLocaleString()}</p>
						<p class="text-xs text-text-secondary">Transit-Connected Trips</p>
						<p class="text-sm font-semibold text-primary mt-1">{tp.pctConnected}%</p>
					</div>
					<div class="rounded-lg bg-earth-50 p-4 text-center">
						<p class="text-2xl font-bold text-text-primary">{tp.avgFirstMileM < 1000 ? `${tp.avgFirstMileM}m` : `${(tp.avgFirstMileM / 1000).toFixed(1)}km`}</p>
						<p class="text-xs text-text-secondary">Avg First Mile</p>
						<p class="text-sm text-text-secondary mt-1">{(tp.firstMile + tp.both).toLocaleString()} trips</p>
					</div>
					<div class="rounded-lg bg-earth-50 p-4 text-center">
						<p class="text-2xl font-bold text-text-primary">{tp.avgLastMileM < 1000 ? `${tp.avgLastMileM}m` : `${(tp.avgLastMileM / 1000).toFixed(1)}km`}</p>
						<p class="text-xs text-text-secondary">Avg Last Mile</p>
						<p class="text-sm text-text-secondary mt-1">{(tp.lastMile + tp.both).toLocaleString()} trips</p>
					</div>
				</div>

				<!-- Charts row: Mode split + Transit type -->
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
					{#if transitModeSplitData}
						<div>
							<h4 class="text-sm font-medium text-text-secondary mb-2">Mode Split</h4>
							<Chart
								type="doughnut"
								data={transitModeSplitData}
								options={{ plugins: { legend: { position: 'bottom' as const } } }}
								class="h-48"
							/>
						</div>
					{/if}
					{#if transitTypeBarData}
						<div>
							<h4 class="text-sm font-medium text-text-secondary mb-2">Transit Type</h4>
							<Chart
								type="bar"
								data={transitTypeBarData}
								options={transitTypeBarOptions}
								class="h-48"
							/>
						</div>
					{/if}
				</div>

				<!-- Top stations table -->
				{#if proximityStationRows.length > 0}
					<h4 class="text-sm font-medium text-text-secondary mb-2">Top Transit Stations by First/Last Mile Activity</h4>
					<div class="max-h-80 overflow-y-auto">
						<DataTable columns={proximityStationColumns} rows={proximityStationRows} />
					</div>
				{/if}

				<p class="text-xs text-text-secondary mt-4">
					Transit connections detected using weighted proximity scoring (threshold: 0.60). Factors: proximity to station, trip distance, time of day, commute direction, path convergence, and speed validation.
				</p>
			{:else}
				<!-- Empty state: no ETL data yet -->
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

					<div class="rounded-lg border border-neutral-300 bg-neutral-100 p-4">
						<div class="flex items-center gap-2 mb-1">
							<i class="fa-solid fa-circle-info text-text-secondary"></i>
							<h4 class="font-semibold text-text-primary">No activity data yet</h4>
						</div>
						<p class="text-xs text-text-secondary">
							Run the ETL sync to compute first/last mile transit connections from Altmo activity data.
						</p>
					</div>
				</div>
			{/if}
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
