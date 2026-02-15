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
			goto(`/pulse/trends?city=${city.id}`);
		}
	});

	const hasData = $derived(data.summary.totalTrips > 0);

	// Monthly activity line chart
	const monthlyLineData = $derived(
		data.trends.length > 0
			? {
					labels: data.trends.map((t) => t.month),
					datasets: [
						{
							label: 'Rides',
							data: data.trends.map((t) => t.rides),
							borderColor: '#000080',
							backgroundColor: 'rgba(0, 0, 128, 0.1)',
							fill: false,
							tension: 0.3
						},
						{
							label: 'Walks',
							data: data.trends.map((t) => t.walks),
							borderColor: '#df7e37',
							backgroundColor: 'rgba(223, 126, 55, 0.1)',
							fill: false,
							tension: 0.3
						},
						{
							label: 'Runs',
							data: data.trends.map((t) => t.runs),
							borderColor: '#1d531f',
							backgroundColor: 'rgba(29, 83, 31, 0.1)',
							fill: false,
							tension: 0.3
						}
					]
				}
			: null
	);

	const monthlyLineOptions = {
		plugins: { legend: { position: 'bottom' as const } },
		scales: {
			y: { beginAtZero: true },
			x: { ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 12 } }
		}
	};

	// Monthly distance stacked bar chart
	const monthlyDistData = $derived(
		data.trends.length > 0
			? {
					labels: data.trends.map((t) => t.month),
					datasets: [
						{
							label: 'Rides (km)',
							data: data.trends.map((t) => {
								const total = t.rides + t.walks + t.runs;
								return total > 0 ? Math.round(t.distanceKm * (t.rides / total)) : 0;
							}),
							backgroundColor: '#000080'
						},
						{
							label: 'Walks (km)',
							data: data.trends.map((t) => {
								const total = t.rides + t.walks + t.runs;
								return total > 0 ? Math.round(t.distanceKm * (t.walks / total)) : 0;
							}),
							backgroundColor: '#df7e37'
						},
						{
							label: 'Runs (km)',
							data: data.trends.map((t) => {
								const total = t.rides + t.walks + t.runs;
								return total > 0 ? Math.round(t.distanceKm * (t.runs / total)) : 0;
							}),
							backgroundColor: '#1d531f'
						}
					]
				}
			: null
	);

	const monthlyDistOptions = {
		plugins: { legend: { position: 'bottom' as const } },
		scales: {
			y: { beginAtZero: true, stacked: true },
			x: { stacked: true, ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 12 } }
		}
	};

	// Growth table
	const growthColumns = [
		{ key: 'month', label: 'Month' },
		{ key: 'total', label: 'Total Trips', align: 'right' as const },
		{ key: 'distanceKm', label: 'Distance (km)', align: 'right' as const },
		{ key: 'growth', label: 'vs Previous', align: 'right' as const }
	];

	const growthRows = $derived(
		data.trends.map((t, i) => {
			const total = t.rides + t.walks + t.runs;
			let growth = '—';
			if (i > 0) {
				const prevTotal = data.trends[i - 1].rides + data.trends[i - 1].walks + data.trends[i - 1].runs;
				if (prevTotal > 0) {
					const pct = ((total - prevTotal) / prevTotal) * 100;
					growth = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
				}
			}
			return {
				month: t.month,
				total: total.toLocaleString(),
				distanceKm: t.distanceKm.toLocaleString(),
				growth
			};
		}).reverse()
	);
</script>

<svelte:head>
	<title>Activity Trends — Altmo Intelligence</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-text-primary">Activity Trends</h1>
		<p class="mt-1 text-text-secondary">
			Time-series analysis of active mobility growth in {data.cityName}.
		</p>
	</div>

	{#if !hasData}
		<div class="flex items-center justify-center rounded-xl border border-border bg-surface-card p-12">
			<div class="text-center">
				<i class="fa-solid fa-chart-line text-4xl text-text-secondary mb-4"></i>
				<p class="text-lg font-semibold text-text-primary">No activity data available for {data.cityName}</p>
				<p class="mt-2 text-sm text-text-secondary">
					Activity route data has not been synced yet. Run the ETL sync-routes job to populate this page.
				</p>
			</div>
		</div>
	{:else}
		<!-- Metric cards -->
		<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
			<MetricCard
				label="Total Activities (All Time)"
				value={data.summary.totalTrips.toLocaleString()}
				icon="fa-solid fa-chart-line"
			/>
			<MetricCard
				label="This Month"
				value={data.latestMonthTotal.toLocaleString()}
				icon="fa-solid fa-calendar-day"
			/>
			<MetricCard
				label="MoM Growth"
				value={data.momGrowth !== null ? `${data.momGrowth >= 0 ? '+' : ''}${data.momGrowth}%` : 'N/A'}
				trend={data.momGrowth ?? undefined}
				icon="fa-solid fa-arrow-trend-up"
			/>
		</div>

		<!-- Monthly activity line chart -->
		{#if monthlyLineData}
			<div class="rounded-xl border border-border bg-surface-card p-6">
				<h2 class="text-lg font-semibold text-text-primary mb-1">Monthly Activity Count</h2>
				<p class="text-sm text-text-secondary mb-4">Rides, walks, and runs over time</p>
				<Chart type="line" data={monthlyLineData} options={monthlyLineOptions} class="h-72" />
			</div>
		{/if}

		<!-- Monthly distance stacked bar -->
		{#if monthlyDistData}
			<div class="rounded-xl border border-border bg-surface-card p-6">
				<h2 class="text-lg font-semibold text-text-primary mb-1">Monthly Distance</h2>
				<p class="text-sm text-text-secondary mb-4">Distance covered (km) by mode, stacked</p>
				<Chart type="bar" data={monthlyDistData} options={monthlyDistOptions} class="h-72" />
			</div>
		{/if}

		<!-- Growth table -->
		{#if growthRows.length > 0}
			<div class="rounded-xl border border-border bg-surface-card p-6">
				<h2 class="text-lg font-semibold text-text-primary mb-1">Monthly Growth</h2>
				<p class="text-sm text-text-secondary mb-4">Month-over-month comparison (latest first)</p>
				<div class="max-h-96 overflow-y-auto">
					<DataTable columns={growthColumns} rows={growthRows} />
				</div>
			</div>
		{/if}
	{/if}
</div>
