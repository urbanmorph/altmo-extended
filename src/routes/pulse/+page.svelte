<script lang="ts">
	import MetricCard from '$lib/components/MetricCard.svelte';
	import Chart from '$lib/components/Chart.svelte';
	import { formatCompact } from '$lib/utils/format';
	import { selectedCity } from '$lib/stores/city';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

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
			goto(`/pulse?city=${city.id}`);
		}
	});

	// Global stats
	const totalTrips = $derived(data.stats ? formatCompact(data.stats.activitiesCount) : '—');
	const activeUsers = $derived(data.stats ? formatCompact(data.stats.people) : '—');
	const co2Offset = $derived(data.stats ? formatCompact(data.stats.co2Offset) + ' kg' : '—');
	const fuelSaved = $derived(data.stats ? formatCompact(data.stats.fuelSaved) + ' L' : '—');
	const moneySaved = $derived(
		data.stats ? '\u20B9' + formatCompact(data.stats.moneySaved) : '—'
	);
	const totalDistKm = $derived(
		data.stats ? formatCompact(data.stats.distanceKm) + ' km' : '—'
	);

	// City-level stats
	const hasActivity = $derived(data.summary.totalTrips > 0);
	const cityTrips = $derived(data.summary.totalTrips.toLocaleString());
	const cityAvgDist = $derived(data.summary.avgDistanceKm + ' km');
	const ridesPct = $derived(
		data.summary.modeBreakdown.find((m) => m.mode === 'Ride')?.pct.toFixed(0) ?? '0'
	);
	const walksPct = $derived(
		data.summary.modeBreakdown.find((m) => m.mode === 'Walk')?.pct.toFixed(0) ?? '0'
	);

	// Mini trends chart
	const trendChartData = $derived(
		data.trends.length > 0
			? {
					labels: data.trends.map((t) => {
						const [y, m] = t.month.split('-');
						const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
						return months[parseInt(m) - 1] + " '" + y.slice(2);
					}),
					datasets: [
						{
							label: 'Activities',
							data: data.trends.map((t) => t.total),
							borderColor: '#008409',
							backgroundColor: 'rgba(0, 132, 9, 0.1)',
							fill: true,
							tension: 0.3,
							pointRadius: 3,
							pointBackgroundColor: '#008409'
						}
					]
				}
			: null
	);

	const trendChartOptions = {
		plugins: { legend: { display: false } },
		scales: {
			y: { beginAtZero: true, ticks: { maxTicksLimit: 4 } },
			x: { ticks: { maxRotation: 0 } }
		}
	};

	// Tab cards data
	const tabCards = $derived([
		{
			href: `/pulse/trips?city=${data.cityId}`,
			icon: 'fa-solid fa-route',
			title: 'Trips',
			description: 'Time-of-day patterns, mode split, and distance distribution',
			stat: hasActivity ? `${cityTrips} trips analyzed` : 'No data yet',
			color: 'bg-altmo-50 border-altmo-200'
		},
		{
			href: `/pulse/commute?city=${data.cityId}`,
			icon: 'fa-solid fa-building',
			title: 'Commute',
			description: 'Peak hours, top corridors, and commute mode analysis',
			stat: hasActivity ? `${data.commuteShare}% of trips are commutes` : 'No data yet',
			color: 'bg-earth-50 border-earth-200'
		},
		{
			href: `/pulse/recreation?city=${data.cityId}`,
			icon: 'fa-solid fa-person-walking',
			title: 'Recreation',
			description: 'Leisure activity patterns, weekend trends, and popular areas',
			stat: hasActivity
				? `${data.summary.directionBreakdown.find((d) => d.direction === 'leisure')?.count.toLocaleString() ?? 0} leisure trips`
				: 'No data yet',
			color: 'bg-moss-50 border-moss-200'
		},
		{
			href: `/pulse/trends?city=${data.cityId}`,
			icon: 'fa-solid fa-chart-line',
			title: 'Trends',
			description: 'Monthly growth, seasonal patterns, and mode shift over time',
			stat:
				data.momGrowth !== null
					? `${data.momGrowth > 0 ? '+' : ''}${data.momGrowth}% month-over-month`
					: 'View trends',
			color: 'bg-sage-50 border-sage-200'
		}
	]);
</script>

<!-- Global impact banner -->
<div class="rounded-xl border border-altmo-200 bg-altmo-50 p-5">
	<div class="flex items-center gap-2 mb-3">
		<i class="fa-solid fa-globe text-altmo-700"></i>
		<h2 class="text-sm font-semibold text-altmo-900 uppercase tracking-wide">
			Altmo Global Impact
		</h2>
	</div>
	<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
		<div>
			<p class="text-2xl font-bold text-altmo-900">{totalTrips}</p>
			<p class="text-xs text-altmo-700">Total Activities</p>
		</div>
		<div>
			<p class="text-2xl font-bold text-altmo-900">{activeUsers}</p>
			<p class="text-xs text-altmo-700">Active Users</p>
		</div>
		<div>
			<p class="text-2xl font-bold text-altmo-900">{totalDistKm}</p>
			<p class="text-xs text-altmo-700">Distance Covered</p>
		</div>
		<div>
			<p class="text-2xl font-bold text-altmo-900">{co2Offset}</p>
			<p class="text-xs text-altmo-700">CO2 Offset</p>
		</div>
		<div>
			<p class="text-2xl font-bold text-altmo-900">{fuelSaved}</p>
			<p class="text-xs text-altmo-700">Petrol Saved</p>
		</div>
		<div>
			<p class="text-2xl font-bold text-altmo-900">{moneySaved}</p>
			<p class="text-xs text-altmo-700">Money Saved</p>
		</div>
	</div>
</div>

{#if hasActivity}
	<!-- City snapshot -->
	<div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Key metrics -->
		<div class="space-y-4">
			<h2 class="text-lg font-semibold text-text-primary">{data.cityName} Snapshot</h2>
			<div class="grid grid-cols-2 gap-4">
				<MetricCard
					label="GPS-Traced Routes"
					value={cityTrips}
					icon="fa-solid fa-route"
				/>
				<MetricCard
					label="Avg Trip Distance"
					value={cityAvgDist}
					icon="fa-solid fa-ruler"
				/>
				<MetricCard
					label="Peak Activity Hour"
					value={data.peakHour}
					icon="fa-solid fa-clock"
				/>
				<MetricCard
					label="Ride / Walk Split"
					value="{ridesPct}% / {walksPct}%"
					icon="fa-solid fa-scale-balanced"
				/>
			</div>
		</div>

		<!-- Mini trend chart -->
		<div class="lg:col-span-2 rounded-xl border border-border bg-surface-card p-5">
			<div class="flex items-center justify-between mb-3">
				<div>
					<h2 class="text-lg font-semibold text-text-primary">Activity Trend</h2>
					<p class="text-sm text-text-secondary">
						Last {data.trends.length} months
						{#if data.momGrowth !== null}
							<span class="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
								{data.momGrowth >= 0 ? 'bg-altmo-50 text-altmo-900' : 'bg-red-50 text-red-700'}">
								<i class="fa-solid {data.momGrowth >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'} mr-1 text-[10px]"></i>
								{data.momGrowth > 0 ? '+' : ''}{data.momGrowth}% MoM
							</span>
						{/if}
					</p>
				</div>
				<a href="/pulse/trends?city={data.cityId}" class="text-sm text-primary hover:underline">
					View details <i class="fa-solid fa-arrow-right ml-1 text-xs"></i>
				</a>
			</div>
			{#if trendChartData}
				<Chart type="line" data={trendChartData} options={trendChartOptions} class="h-48" />
			{:else}
				<div class="flex h-48 items-center justify-center">
					<p class="text-sm text-text-secondary">No trend data available yet.</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Top corridors preview -->
	{#if data.topCorridors.length > 0}
		<div class="mt-6 rounded-xl border border-border bg-surface-card p-5">
			<div class="flex items-center justify-between mb-3">
				<h2 class="text-lg font-semibold text-text-primary">Top Corridors</h2>
				<a href="/routes?city={data.cityId}" class="text-sm text-primary hover:underline">
					View all routes <i class="fa-solid fa-arrow-right ml-1 text-xs"></i>
				</a>
			</div>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
				{#each data.topCorridors.slice(0, 5) as corridor, i}
					<div class="rounded-lg bg-surface-elevated p-3">
						<div class="flex items-center gap-2 mb-1">
							<span class="flex h-5 w-5 items-center justify-center rounded-full bg-altmo-100 text-xs font-bold text-altmo-900">
								{i + 1}
							</span>
							<span class="text-xs font-medium text-text-secondary uppercase">{corridor.primaryMode}</span>
						</div>
						<p class="text-sm font-medium text-text-primary truncate" title="{corridor.startArea}">
							{corridor.startArea}
						</p>
						<p class="text-xs text-text-secondary truncate" title="{corridor.endArea}">
							<i class="fa-solid fa-arrow-right mr-1"></i>{corridor.endArea}
						</p>
						<p class="mt-1 text-xs text-text-secondary">
							{corridor.count} trips &middot; {corridor.avgDistanceKm} km avg
						</p>
					</div>
				{/each}
			</div>
		</div>
	{/if}
{/if}

<!-- Explore tabs -->
<div class="mt-6">
	<h2 class="text-lg font-semibold text-text-primary mb-4">Explore</h2>
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		{#each tabCards as card}
			<a href={card.href}
				class="group rounded-xl border {card.color} p-5 transition-shadow hover:shadow-md">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-white/70">
						<i class="{card.icon} text-lg text-text-primary"></i>
					</div>
					<div class="flex-1 min-w-0">
						<h3 class="text-base font-semibold text-text-primary group-hover:text-primary">
							{card.title}
							<i class="fa-solid fa-arrow-right ml-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"></i>
						</h3>
						<p class="mt-0.5 text-sm text-text-secondary">{card.description}</p>
						<p class="mt-2 text-xs font-medium text-text-primary">{card.stat}</p>
					</div>
				</div>
			</a>
		{/each}

		<!-- Transit card (separate since it's not activity-data based) -->
		<a href="/pulse/transit?city={data.cityId}"
			class="group rounded-xl border bg-clay-50 border-clay-200 p-5 transition-shadow hover:shadow-md sm:col-span-2">
			<div class="flex items-start gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-white/70">
					<i class="fa-solid fa-train-subway text-lg text-text-primary"></i>
				</div>
				<div class="flex-1 min-w-0">
					<h3 class="text-base font-semibold text-text-primary group-hover:text-primary">
						Transit
						<i class="fa-solid fa-arrow-right ml-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"></i>
					</h3>
					<p class="mt-0.5 text-sm text-text-secondary">
						Metro ridership, bus stop coverage, suburban rail networks, and station-level analytics
					</p>
				</div>
			</div>
		</a>
	</div>
</div>
