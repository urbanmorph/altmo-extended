<script lang="ts">
	import MetricCard from '$lib/components/MetricCard.svelte';
	import Chart from '$lib/components/Chart.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Prepare chart data for mode breakdown
	const chartData = $derived({
		labels: ['Bus Stops', 'Metro Stations'],
		datasets: [{
			data: [data.metrics.totalBusStops, data.metrics.totalMetroStations],
			backgroundColor: ['#2563eb', '#9333ea']
		}]
	});

	const chartOptions = {
		plugins: {
			legend: {
				position: 'bottom' as const
			}
		}
	};

	// Prepare top hubs data with rank
	const topHubsRows = $derived(data.topHubs.map((hub: { name: string; routeCount: number }, index: number) => ({
		rank: index + 1,
		name: hub.name,
		routeCount: hub.routeCount
	})));

	const topHubsColumns = [
		{ key: 'rank', label: '#', align: 'center' as const },
		{ key: 'name', label: 'Stop Name' },
		{ key: 'routeCount', label: 'Routes', align: 'right' as const }
	];

	// Metro line color mapping
	const lineColors: Record<string, string> = {
		purple: '#9333ea',
		green: '#16a34a',
		yellow: '#eab308',
		pink: '#ec4899',
		blue: '#2563eb'
	};
</script>

<div class="space-y-6">
	<!-- Row 1: Metrics Cards -->
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
		<MetricCard
			label="Bus Stops"
			value={data.metrics.totalBusStops.toLocaleString()}
			icon="🚌"
		/>
		<MetricCard
			label="Metro Stations"
			value={data.metrics.totalMetroStations.toLocaleString()}
			icon="🚇"
		/>
		<MetricCard
			label="Bus Routes"
			value={data.metrics.totalBusRoutes.toLocaleString()}
			icon="🛣️"
		/>
		<MetricCard
			label="Avg Routes/Stop"
			value={data.metrics.avgRoutesPerStop.toFixed(1)}
			icon="📊"
		/>
	</div>

	<!-- Row 2: Chart & Top Hubs -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Mode Breakdown Chart -->
		<div class="rounded-xl border border-border bg-surface-card p-6">
			<h3 class="text-lg font-semibold text-text-primary mb-4">Mode Breakdown</h3>
			<Chart
				type="doughnut"
				data={chartData}
				options={chartOptions}
				class="h-64"
			/>
		</div>

		<!-- Top Transit Hubs -->
		<div class="rounded-xl border border-border bg-surface-card p-6">
			<h3 class="text-lg font-semibold text-text-primary mb-4">Top Transit Hubs</h3>
			<div class="max-h-80 overflow-y-auto">
				<DataTable columns={topHubsColumns} rows={topHubsRows} />
			</div>
		</div>
	</div>

	<!-- Row 3: Metro Network & First/Last Mile Context -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Metro Network by Line -->
		<div class="rounded-xl border border-border bg-surface-card p-6">
			<h3 class="text-lg font-semibold text-text-primary mb-4">Metro Network by Line</h3>
			<div class="space-y-4">
				{#each Object.entries(data.metroByLine) as [lineName, stations]}
					<div class="rounded-lg border border-border p-4">
						<div class="flex items-center gap-2 mb-3">
							<div
								class="h-3 w-3 rounded-full"
								style="background-color: {lineColors[lineName] || '#9333ea'}"
							></div>
							<h4 class="font-semibold text-text-primary capitalize">{lineName} Line</h4>
							<span class="text-sm text-text-secondary">({stations.length} stations)</span>
						</div>
						<div class="grid grid-cols-2 gap-2 text-sm text-text-secondary">
							{#each stations as station}
								<div class="truncate">{station.name}</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- First/Last Mile Context -->
		<div class="rounded-xl border border-border bg-surface-card p-6">
			<h3 class="text-lg font-semibold text-text-primary mb-4">First/Last Mile Context</h3>
			<div class="space-y-4 text-sm text-text-secondary">
				<div class="rounded-lg bg-earth-50 p-4">
					<h4 class="font-semibold text-text-primary mb-2">Walking Catchment</h4>
					<ul class="space-y-1">
						<li>• 400m comfortable walking distance to transit</li>
						<li>• 800m maximum walking distance to transit</li>
					</ul>
				</div>

				<div class="rounded-lg bg-earth-50 p-4">
					<h4 class="font-semibold text-text-primary mb-2">Cycling Catchment</h4>
					<ul class="space-y-1">
						<li>• 2km effective cycling radius to transit</li>
					</ul>
				</div>

				<div class="rounded-lg bg-earth-50 p-4">
					<h4 class="font-semibold text-text-primary mb-2">Bengaluru Walking Infrastructure</h4>
					<ul class="space-y-1">
						<li>• ~100 km walkable footpath (TenderSURE + Smart Cities)</li>
						<li>• 103 km TenderSURE roads planned (CMP 2020)</li>
						<li>• 974 km total footpath planned</li>
					</ul>
				</div>
			</div>
		</div>
	</div>

	<!-- Row 4: Data Sources Attribution -->
	<div class="rounded-xl border border-border bg-surface-card p-6">
		<h3 class="text-lg font-semibold text-text-primary mb-4">Data Sources</h3>
		<div class="space-y-2 text-sm text-text-secondary">
			<p>
				<a
					href="https://github.com/Vonter/transitrouter"
					target="_blank"
					rel="noopener noreferrer"
					class="text-accent hover:underline"
				>
					TransitRouter (MIT)
				</a>
				— Bus stop and route data for 9 Indian regions
			</p>
			<p>
				<a
					href="https://github.com/geohacker/namma-metro"
					target="_blank"
					rel="noopener noreferrer"
					class="text-accent hover:underline"
				>
					Namma Metro
				</a>
				— Station locations and line geometry
			</p>
			<p>
				<a
					href="https://dult.karnataka.gov.in/storage/pdf-files/CMP2020/Volume%201-%20Status%20of%20Transport%20and%20Mobility%20in%20Bengaluru.pdf"
					target="_blank"
					rel="noopener noreferrer"
					class="text-accent hover:underline"
				>
					DULT CMP 2020
				</a>
				— Comprehensive Mobility Plan
			</p>
			<p>
				<span class="text-text-primary font-medium">BMRCL</span>
				— Metro ridership data (Bengaluru only)
			</p>
		</div>
	</div>
</div>
