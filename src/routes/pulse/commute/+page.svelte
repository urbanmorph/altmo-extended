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
			goto(`/pulse/commute?city=${city.id}`);
		}
	});

	const hasData = $derived(data.summary.totalTrips > 0);

	// Ride vs Walk split
	const rides = $derived(data.summary.modeBreakdown.find((m) => m.mode === 'Ride'));
	const walks = $derived(data.summary.modeBreakdown.find((m) => m.mode === 'Walk'));

	// Commute under 5km insight
	const under5kmPct = $derived(() => {
		// This would need distance distribution data; approximate from avg
		if (data.summary.avgDistanceKm <= 5) return 'majority';
		return null;
	});

	// Peak hours bar chart — highlight morning (6-10) and evening (17-20)
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
							label: 'Commute Trips',
							data: data.hourly.map((h) => h.count),
							backgroundColor: data.hourly.map((h) =>
								(h.hour >= 6 && h.hour <= 10) || (h.hour >= 17 && h.hour <= 20)
									? '#008409'
									: '#C2ED61'
							),
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
	<title>Commute Patterns — Altmo Intelligence</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-text-primary">Commute Patterns</h1>
		<p class="mt-1 text-text-secondary">
			Peak hours, common corridors, and commute mode analysis for {data.cityName}.
		</p>
	</div>

	{#if !hasData}
		<div class="flex items-center justify-center rounded-xl border border-border bg-surface-card p-12">
			<div class="text-center">
				<i class="fa-solid fa-building text-4xl text-text-secondary mb-4"></i>
				<p class="text-lg font-semibold text-text-primary">No commute data available for {data.cityName}</p>
				<p class="mt-2 text-sm text-text-secondary">
					Activity route data has not been synced yet. Run the ETL sync-routes job to populate this page.
				</p>
			</div>
		</div>
	{:else}
		<!-- Metric cards -->
		<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
			<MetricCard
				label="Total Commute Trips"
				value={data.summary.totalTrips.toLocaleString()}
				icon="fa-solid fa-building"
			/>
			<MetricCard
				label="Avg Commute Distance"
				value="{data.summary.avgDistanceKm} km"
				icon="fa-solid fa-ruler"
			/>
			<MetricCard
				label="Ride vs Walk"
				value="{(rides?.pct ?? 0).toFixed(0)}% / {(walks?.pct ?? 0).toFixed(0)}%"
				icon="fa-solid fa-scale-balanced"
			/>
		</div>

		<!-- Insight banner -->
		{#if data.summary.avgDistanceKm <= 5}
			<div class="rounded-lg border border-altmo-200 bg-altmo-50 p-4">
				<div class="flex items-center gap-2">
					<i class="fa-solid fa-lightbulb text-altmo-700"></i>
					<p class="text-sm font-medium text-text-primary">
						Average commute distance is {data.summary.avgDistanceKm} km — well within comfortable cycling range.
						Infrastructure investment in protected cycle lanes along top corridors could drive significant mode shift.
					</p>
				</div>
			</div>
		{/if}

		<!-- Peak hours chart -->
		<div class="grid grid-cols-1 gap-6">
			{#if hourlyChartData}
				<div class="rounded-xl border border-border bg-surface-card p-6">
					<h2 class="text-lg font-semibold text-text-primary mb-1">Commute Peak Hours</h2>
					<p class="text-sm text-text-secondary mb-4">
						Morning (6-10am) and evening (5-8pm) peaks highlighted
					</p>
					<Chart type="bar" data={hourlyChartData} options={hourlyChartOptions} class="h-64" />
				</div>
			{/if}
		</div>

		<!-- Top commute corridors -->
		{#if corridorRows.length > 0}
			<div class="rounded-xl border border-border bg-surface-card p-6">
				<h2 class="text-lg font-semibold text-text-primary mb-1">Top Commute Corridors</h2>
				<p class="text-sm text-text-secondary mb-4">
					Most-used commute routes (to/from work)
				</p>
				<div class="max-h-96 overflow-y-auto">
					<DataTable columns={corridorColumns} rows={corridorRows} />
				</div>
			</div>
		{/if}
	{/if}
</div>
