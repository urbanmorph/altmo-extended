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
			goto(`/pulse/recreation?city=${city.id}`);
		}
	});

	const hasData = $derived(data.summary.totalTrips > 0);

	// Mode split doughnut
	const modeColors: Record<string, string> = {
		Run: '#1d531f',
		Walk: '#df7e37',
		Ride: '#000080'
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
		plugins: { legend: { position: 'bottom' as const } }
	};

	// Weekday vs Weekend bar chart
	const weekdayChartData = $derived(
		data.weekday.length > 0
			? {
					labels: data.weekday.map((d) => d.day),
					datasets: [
						{
							label: 'Activities',
							data: data.weekday.map((d) => d.count),
							backgroundColor: data.weekday.map((d) =>
								d.day === 'Sat' || d.day === 'Sun' ? '#FF7B27' : '#008409'
							),
							borderRadius: 2
						}
					]
				}
			: null
	);

	const weekdayChartOptions = {
		plugins: { legend: { display: false } },
		scales: { y: { beginAtZero: true } }
	};

	// Top recreation areas table
	const areaColumns = [
		{ key: 'rank', label: '#', align: 'center' as const },
		{ key: 'startArea', label: 'Area' },
		{ key: 'count', label: 'Trips', align: 'right' as const },
		{ key: 'avgDistanceKm', label: 'Avg Dist (km)', align: 'right' as const }
	];

	const areaRows = $derived(
		data.topAreas.map((a, i) => ({
			rank: i + 1,
			startArea: a.startArea,
			count: a.count.toLocaleString(),
			avgDistanceKm: a.avgDistanceKm.toFixed(1)
		}))
	);
</script>

<svelte:head>
	<title>Recreational Activity — Altmo Intelligence</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-text-primary">Recreational Activity</h1>
		<p class="mt-1 text-text-secondary">
			Weekend and leisure activity patterns in {data.cityName}.
		</p>
	</div>

	{#if !hasData}
		<div class="flex items-center justify-center rounded-xl border border-border bg-surface-card p-12">
			<div class="text-center">
				<i class="fa-solid fa-person-running text-4xl text-text-secondary mb-4"></i>
				<p class="text-lg font-semibold text-text-primary">No recreational data available for {data.cityName}</p>
				<p class="mt-2 text-sm text-text-secondary">
					Activity route data has not been synced yet. Run the ETL sync-routes job to populate this page.
				</p>
			</div>
		</div>
	{:else}
		<!-- Metric cards -->
		<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
			<MetricCard
				label="Recreational Trips"
				value={data.summary.totalTrips.toLocaleString()}
				icon="fa-solid fa-person-running"
			/>
			<MetricCard
				label="Avg Distance"
				value="{data.summary.avgDistanceKm} km"
				icon="fa-solid fa-ruler"
			/>
			<MetricCard
				label="Weekend Share"
				value="{data.weekendShare}%"
				icon="fa-solid fa-calendar-week"
			/>
		</div>

		<!-- Charts row -->
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
			{#if weekdayChartData}
				<div class="lg:col-span-2 rounded-xl border border-border bg-surface-card p-6">
					<h2 class="text-lg font-semibold text-text-primary mb-1">Activity by Day of Week</h2>
					<p class="text-sm text-text-secondary mb-4">Weekend days highlighted in orange</p>
					<Chart type="bar" data={weekdayChartData} options={weekdayChartOptions} class="h-72" />
				</div>
			{/if}

			{#if modeChartData}
				<div class="rounded-xl border border-border bg-surface-card p-6">
					<h2 class="text-lg font-semibold text-text-primary mb-1">Mode Split</h2>
					<p class="text-sm text-text-secondary mb-4">Recreational activity types</p>
					<Chart type="doughnut" data={modeChartData} options={modeChartOptions} class="h-64" />
				</div>
			{/if}
		</div>

		<!-- Top recreation areas -->
		{#if areaRows.length > 0}
			<div class="rounded-xl border border-border bg-surface-card p-6">
				<h2 class="text-lg font-semibold text-text-primary mb-1">Top Recreation Areas</h2>
				<p class="text-sm text-text-secondary mb-4">Most popular areas for recreational activities</p>
				<div class="max-h-96 overflow-y-auto">
					<DataTable columns={areaColumns} rows={areaRows} />
				</div>
			</div>
		{/if}
	{/if}
</div>
