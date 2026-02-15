<script lang="ts">
	import MetricCard from '$lib/components/MetricCard.svelte';
	import Chart from '$lib/components/Chart.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import type { PageData } from './$types';
	import { selectedCity } from '$lib/stores/city';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

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
			goto(`/pulse/trips?city=${city.id}`);
		}
	});

	const hasData = $derived(data.summary.totalTrips > 0);

	// Mode breakdown for metric cards
	const rides = $derived(data.summary.modeBreakdown.find((m) => m.mode === 'Ride'));
	const walks = $derived(data.summary.modeBreakdown.find((m) => m.mode === 'Walk'));
	const runs = $derived(data.summary.modeBreakdown.find((m) => m.mode === 'Run'));

	// Time-of-day bar chart
	const hourlyChartData = $derived(
		data.hourly.length > 0
			? {
					labels: data.hourly.map((h) => {
						if (h.hour === 0) return '12am';
						if (h.hour < 12) return `${h.hour}am`;
						if (h.hour === 12) return '12pm';
						return `${h.hour - 12}pm`;
					}),
					datasets: [
						{
							label: 'Trips',
							data: data.hourly.map((h) => h.count),
							backgroundColor: '#008409',
							borderRadius: 2
						}
					]
				}
			: null
	);

	const hourlyChartOptions = {
		plugins: { legend: { display: false } },
		scales: {
			y: { beginAtZero: true },
			x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } }
		}
	};

	// Direction doughnut
	const directionColors: Record<string, string> = {
		to_work: '#008409',
		from_work: '#01AA14',
		leisure: '#FF7B27'
	};

	const directionChartData = $derived(
		hasData
			? {
					labels: data.summary.directionBreakdown.map((d) =>
						d.direction === 'to_work' ? 'To Work' : d.direction === 'from_work' ? 'From Work' : 'Leisure'
					),
					datasets: [
						{
							data: data.summary.directionBreakdown.map((d) => d.count),
							backgroundColor: data.summary.directionBreakdown.map(
								(d) => directionColors[d.direction] ?? '#94a3b8'
							)
						}
					]
				}
			: null
	);

	const directionChartOptions = {
		plugins: { legend: { position: 'bottom' as const } }
	};

	// Distance distribution table
	const distColumns = [
		{ key: 'bucket', label: 'Distance Range' },
		{ key: 'count', label: 'Trips', align: 'right' as const },
		{ key: 'pct', label: '% of Total', align: 'right' as const }
	];

	const distRows = $derived(
		data.distanceDistribution.map((d) => ({
			bucket: d.bucket,
			count: d.count.toLocaleString(),
			pct: `${d.pct}%`
		}))
	);
</script>

<svelte:head>
	<title>Trip Analysis — Altmo Intelligence</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-text-primary">Trip Analysis</h1>
		<p class="mt-1 text-text-secondary">
			Detailed breakdown of activity trips in {data.cityName}.
		</p>
	</div>

	{#if !hasData}
		<div class="flex items-center justify-center rounded-xl border border-border bg-surface-card p-12">
			<div class="text-center">
				<i class="fa-solid fa-chart-pie text-4xl text-text-secondary mb-4"></i>
				<p class="text-lg font-semibold text-text-primary">No activity data available for {data.cityName}</p>
				<p class="mt-2 text-sm text-text-secondary">
					Activity route data has not been synced yet. Run the ETL sync-routes job to populate this page.
				</p>
			</div>
		</div>
	{:else}
		<!-- Metric cards -->
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
			<MetricCard
				label="Total Trips"
				value={data.summary.totalTrips.toLocaleString()}
				icon="fa-solid fa-person-biking"
			/>
			<MetricCard
				label="Rides"
				value="{(rides?.count ?? 0).toLocaleString()} ({(rides?.pct ?? 0).toFixed(0)}%)"
				icon="fa-solid fa-bicycle"
			/>
			<MetricCard
				label="Walks"
				value="{(walks?.count ?? 0).toLocaleString()} ({(walks?.pct ?? 0).toFixed(0)}%)"
				icon="fa-solid fa-person-walking"
			/>
			<MetricCard
				label="Runs"
				value="{(runs?.count ?? 0).toLocaleString()} ({(runs?.pct ?? 0).toFixed(0)}%)"
				icon="fa-solid fa-person-running"
			/>
		</div>

		<!-- Time of day chart + Direction doughnut -->
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
			{#if hourlyChartData}
				<div class="lg:col-span-2 rounded-xl border border-border bg-surface-card p-6">
					<h2 class="text-lg font-semibold text-text-primary mb-1">Trips by Time of Day</h2>
					<p class="text-sm text-text-secondary mb-4">Activity distribution across 24 hours</p>
					<Chart type="bar" data={hourlyChartData} options={hourlyChartOptions} class="h-64" />
				</div>
			{/if}

			{#if directionChartData}
				<div class="rounded-xl border border-border bg-surface-card p-6">
					<h2 class="text-lg font-semibold text-text-primary mb-1">Direction Breakdown</h2>
					<p class="text-sm text-text-secondary mb-4">To work, from work, or leisure</p>
					<Chart type="doughnut" data={directionChartData} options={directionChartOptions} class="h-64" />
				</div>
			{/if}
		</div>

		<!-- Distance distribution -->
		{#if distRows.length > 0}
			<div class="rounded-xl border border-border bg-surface-card p-6">
				<h2 class="text-lg font-semibold text-text-primary mb-1">Distance Distribution</h2>
				<p class="text-sm text-text-secondary mb-4">Trip count by distance range</p>
				<DataTable columns={distColumns} rows={distRows} />
			</div>
		{/if}
	{/if}
</div>
