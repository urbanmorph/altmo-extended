<script lang="ts">
  import MetricCard from '$lib/components/MetricCard.svelte';
  import { formatCompact, formatNumber, formatPercent } from '$lib/utils/format';
  import { getPM25Category } from '$lib/config/air-quality';

  interface TripChainingData {
    chainedJourneys: number;
    uniqueChainedUsers: number;
    repeatedCommuteUsers: number;
    repeatedCommuteTrips: number;
    weekendTransitTrips: number;
    topChainedStations: { name: string; type: string; line: string; asOrigin: number; asDestination: number }[];
    topMultimodalCorridors: { fromStation: string; toStation: string; line: string; count: number }[];
  }

  interface ActivityData {
    totalRides: number;
    totalWalks: number;
    totalDistance: number;
    co2Offset: number;
    transitProximityPct: number;
    tripChaining: TripChainingData | null;
  }

  interface PM25Data {
    pm25Avg: number;
    pm25Max: number;
    stationsReporting: number;
    isFallback?: boolean;
  }

  interface SafetyData {
    fatalitiesPerLakh: number;
    vruFatalityShare: number | null;
    year: number;
  }

  interface CongestionData {
    congestionPct: number;
    avgCurrentSpeed: number;
    avgFreeFlowSpeed: number;
  }

  interface CompanyData {
    count: number;
    top: Array<{ name: string; totalActivities: number; activeUsers: number; totalKm: number }>;
  }

  interface Props {
    activity: ActivityData | null;
    pm25: PM25Data | null;
    safety: SafetyData | null;
    congestion: CongestionData | null;
    companies: CompanyData | null;
    cityName: string;
  }

  let { activity, pm25, safety, congestion, companies, cityName }: Props = $props();

  // PM2.5 category
  const pm25Category = $derived(pm25 ? getPM25Category(pm25.pm25Avg) : null);

  const pm25CategoryColor = $derived(pm25Category?.color ?? '#999999');

  // Safety rating
  const safetyRating = $derived.by(() => {
    if (!safety) return null;
    if (safety.fatalitiesPerLakh <= 5) return { label: 'Lower risk', color: '#16a34a' };
    if (safety.fatalitiesPerLakh <= 10) return { label: 'Moderate risk', color: '#eab308' };
    if (safety.fatalitiesPerLakh <= 15) return { label: 'High risk', color: '#FF7B27' };
    return { label: 'Very high risk', color: '#dc2626' };
  });

  // Congestion rating
  const congestionColor = $derived.by(() => {
    if (!congestion) return '#999999';
    if (congestion.congestionPct > 50) return '#dc2626';
    if (congestion.congestionPct > 30) return '#FF7B27';
    if (congestion.congestionPct > 15) return '#eab308';
    return '#16a34a';
  });
</script>

<section id="activity" class="scroll-mt-16">
  <h2 class="mb-6 text-xl font-bold text-text-primary">
    <i class="fa-solid fa-chart-line mr-2 text-altmo-700"></i>
    Activity & Impact
  </h2>

  <!-- Activity impact metrics -->
  {#if activity}
    {@const healthcareValue = Math.round(activity.totalDistance * 1.75)}
    {@const fatBurnKg = activity.totalDistance * 35 / 7700}
    {@const cityTrafficDelay = congestion && congestion.avgCurrentSpeed > 0 && congestion.avgFreeFlowSpeed > 0
      ? (1 / congestion.avgCurrentSpeed - 1 / congestion.avgFreeFlowSpeed) : null}
    {@const trafficHoursSaved = cityTrafficDelay ? Math.round(activity.totalDistance * cityTrafficDelay) : null}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="CO2 Avoided"
        value="{formatCompact(activity.co2Offset)} kg"
        icon="fa-solid fa-leaf"
        tooltip="Distance (km) x 0.25 kg/km avg car emission factor"
      />
      <MetricCard
        label="Healthcare Value"
        value="₹{formatCompact(healthcareValue)}"
        icon="fa-solid fa-heart-pulse"
        tooltip="WHO HEAT method: distance (km) x ₹1.75/km monetised mortality reduction from active mobility"
      />
      <MetricCard
        label="Fat Burn"
        value="{fatBurnKg >= 10 ? formatCompact(Math.round(fatBurnKg)) : fatBurnKg.toFixed(1)} kg"
        icon="fa-solid fa-fire-flame-curved"
        tooltip="Distance (km) x 35 kcal/km (blended cycling/walking avg) / 7,700 kcal per kg body fat"
      />
      {#if trafficHoursSaved !== null}
        <MetricCard
          label="Traffic Hours Saved"
          value="{formatCompact(trafficHoursSaved)} hrs"
          icon="fa-solid fa-hourglass-half"
          tooltip="Hours not stuck in traffic = distance (km) x (1/{congestion?.avgCurrentSpeed.toFixed(0)} - 1/{congestion?.avgFreeFlowSpeed.toFixed(0)}) using TomTom city speeds"
        />
      {:else}
        <MetricCard
          label="Total Trips"
          value={formatCompact(activity.totalRides + activity.totalWalks)}
          icon="fa-solid fa-route"
          tooltip="Total rides + walks logged in this city"
        />
      {/if}
    </div>

    {#if activity.transitProximityPct > 0}
      <div class="mt-4 rounded-xl border border-border bg-surface-card p-4 shadow-sm">
        <div class="flex items-center gap-3">
          <i class="fa-solid fa-link text-lg text-altmo-700"></i>
          <div>
            <p class="text-sm font-medium text-text-primary">
              {formatPercent(activity.transitProximityPct, 0)} of rides connect to transit
            </p>
            <p class="text-xs text-text-secondary">First/last mile trips that start or end near a transit stop</p>
          </div>
        </div>
      </div>
    {/if}

    <!-- Trip Chaining: Multimodal Journey Detection -->
    {#if activity.tripChaining && activity.tripChaining.chainedJourneys > 0}
      <div class="mt-4 rounded-xl border border-border bg-surface-card p-5 shadow-sm">
        <div class="mb-4 flex items-center gap-3">
          <i class="fa-solid fa-arrows-split-up-and-left text-lg text-altmo-700"></i>
          <div>
            <p class="text-sm font-semibold text-text-primary">Multimodal Journey Detection</p>
            <p class="text-xs text-text-secondary">Users chaining cycling/walking with transit (inferred from sequential trips near stations)</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="rounded-lg bg-altmo-50 p-3 text-center">
            <p class="text-xl font-bold text-altmo-900">{formatNumber(activity.tripChaining.chainedJourneys)}</p>
            <p class="text-xs text-text-secondary">Chained journeys</p>
          </div>
          <div class="rounded-lg bg-altmo-50 p-3 text-center">
            <p class="text-xl font-bold text-altmo-900">{formatNumber(activity.tripChaining.uniqueChainedUsers)}</p>
            <p class="text-xs text-text-secondary">Multimodal users</p>
          </div>
          <div class="rounded-lg bg-altmo-50 p-3 text-center">
            <p class="text-xl font-bold text-altmo-900">{formatNumber(activity.tripChaining.repeatedCommuteUsers)}</p>
            <p class="text-xs text-text-secondary">Repeat commuters</p>
          </div>
          <div class="rounded-lg bg-altmo-50 p-3 text-center">
            <p class="text-xl font-bold text-altmo-900">{formatNumber(activity.tripChaining.weekendTransitTrips)}</p>
            <p class="text-xs text-text-secondary">Weekend transit trips</p>
          </div>
        </div>

        <!-- Top multimodal corridors -->
        {#if activity.tripChaining.topMultimodalCorridors.length > 0}
          <div class="mt-4">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Top Multimodal Corridors</p>
            <div class="space-y-1.5">
              {#each activity.tripChaining.topMultimodalCorridors.slice(0, 5) as corridor}
                <div class="flex items-center justify-between rounded-md bg-surface px-3 py-2 text-sm">
                  <div class="flex items-center gap-2">
                    <i class="fa-solid fa-train text-xs text-purple-600"></i>
                    <span class="text-text-primary">{corridor.fromStation}</span>
                    <i class="fa-solid fa-arrow-right text-xs text-text-secondary"></i>
                    <span class="text-text-primary">{corridor.toStation}</span>
                  </div>
                  <span class="text-xs font-medium text-text-secondary">{corridor.count} trips</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Top chained stations -->
        {#if activity.tripChaining.topChainedStations.length > 0}
          <div class="mt-4">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Most-Used Transit Stations</p>
            <div class="flex flex-wrap gap-2">
              {#each activity.tripChaining.topChainedStations.slice(0, 8) as station}
                <span class="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-primary">
                  <i class="fa-solid {station.type === 'metro' ? 'fa-train-subway' : station.type === 'rail' ? 'fa-train' : 'fa-bus'}" style="font-size: 0.6rem; color: {station.type === 'metro' ? '#9333ea' : station.type === 'rail' ? '#dc2626' : '#2563eb'};"></i>
                  {station.name}
                  <span class="text-text-secondary">({station.asOrigin + station.asDestination})</span>
                </span>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  {:else}
    <div class="rounded-xl border border-border bg-surface-card p-6 text-center">
      <i class="fa-solid fa-chart-bar text-2xl text-text-secondary"></i>
      <p class="mt-2 text-sm text-text-secondary">Activity data is not yet available for this city.</p>
    </div>
  {/if}

  <!-- Environmental & Safety rows -->
  <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
    <!-- Air Quality -->
    <div class="rounded-xl border border-border bg-surface-card p-5 shadow-sm">
      <div class="flex items-center justify-between">
        <p class="text-sm font-medium text-text-secondary">Air Quality (PM2.5)</p>
        <i class="fa-solid fa-wind text-text-secondary"></i>
      </div>
      {#if pm25}
        <p class="mt-2 text-2xl font-bold text-text-primary">{pm25.pm25Avg.toFixed(1)} <span class="text-sm font-normal text-text-secondary">ug/m3</span></p>
        <div class="mt-2 flex items-center gap-2">
          <span
            class="inline-block rounded-full px-2 py-0.5 text-xs font-semibold text-white"
            style="background-color: {pm25CategoryColor};"
          >
            {pm25Category?.label ?? 'Unknown'}
          </span>
          {#if pm25.isFallback}
            <span class="text-xs text-text-secondary">(estimated)</span>
          {/if}
        </div>
        <p class="mt-1 text-xs text-text-secondary">{pm25.stationsReporting} station{pm25.stationsReporting !== 1 ? 's' : ''} reporting</p>
      {:else}
        <p class="mt-2 text-2xl font-bold text-text-secondary">--</p>
        <p class="mt-1 text-xs text-text-secondary">No air quality data available</p>
      {/if}
    </div>

    <!-- Safety -->
    <div class="rounded-xl border border-border bg-surface-card p-5 shadow-sm">
      <div class="flex items-center justify-between">
        <p class="text-sm font-medium text-text-secondary">Road Safety</p>
        <i class="fa-solid fa-shield-halved text-text-secondary"></i>
      </div>
      {#if safety}
        <p class="mt-2 text-2xl font-bold text-text-primary">{safety.fatalitiesPerLakh.toFixed(1)} <span class="text-sm font-normal text-text-secondary">per lakh</span></p>
        {#if safetyRating}
          <div class="mt-2">
            <span
              class="inline-block rounded-full px-2 py-0.5 text-xs font-semibold text-white"
              style="background-color: {safetyRating.color};"
            >
              {safetyRating.label}
            </span>
          </div>
        {/if}
        {#if safety.vruFatalityShare !== null}
          <p class="mt-1 text-xs text-text-secondary">VRU share: {formatPercent(safety.vruFatalityShare, 0)}</p>
        {/if}
        <p class="mt-0.5 text-xs text-text-secondary">Data: {safety.year}</p>
      {:else}
        <p class="mt-2 text-2xl font-bold text-text-secondary">--</p>
        <p class="mt-1 text-xs text-text-secondary">No safety data available</p>
      {/if}
    </div>

    <!-- Congestion -->
    <div class="rounded-xl border border-border bg-surface-card p-5 shadow-sm">
      <div class="flex items-center justify-between">
        <p class="text-sm font-medium text-text-secondary">Congestion</p>
        <i class="fa-solid fa-traffic-light text-text-secondary"></i>
      </div>
      {#if congestion}
        <p class="mt-2 text-2xl font-bold text-text-primary">{formatPercent(congestion.congestionPct, 0)} <span class="text-sm font-normal text-text-secondary">extra time</span></p>
        <div class="mt-2">
          <span
            class="inline-block rounded-full px-2 py-0.5 text-xs font-semibold text-white"
            style="background-color: {congestionColor};"
          >
            {congestion.avgCurrentSpeed.toFixed(0)} km/h avg
          </span>
        </div>
        <p class="mt-1 text-xs text-text-secondary">Free flow: {congestion.avgFreeFlowSpeed.toFixed(0)} km/h</p>
      {:else}
        <p class="mt-2 text-2xl font-bold text-text-secondary">--</p>
        <p class="mt-1 text-xs text-text-secondary">No congestion data available</p>
      {/if}
    </div>
  </div>

  <!-- Companies tracking active mobility -->
  {#if companies && companies.count > 0}
    <div class="mt-6 rounded-xl border border-border bg-surface-card p-5 shadow-sm">
      <div class="flex items-center gap-3 mb-4">
        <i class="fa-solid fa-building text-lg text-altmo-700"></i>
        <div>
          <p class="text-sm font-semibold text-text-primary">
            {formatNumber(companies.count)} {companies.count === 1 ? 'company' : 'companies'} tracking active mobility in {cityName}
          </p>
          <p class="text-xs text-text-secondary">Organisations with employees logging rides and walks on Altmo</p>
        </div>
      </div>
      {#if companies.top.some(c => c.totalActivities > 0)}
        {@const congestionDelay = congestion && congestion.avgCurrentSpeed > 0 && congestion.avgFreeFlowSpeed > 0
          ? (1 / congestion.avgCurrentSpeed - 1 / congestion.avgFreeFlowSpeed)
          : null}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                <th class="pb-2 pr-3 w-8">#</th>
                <th class="pb-2 pr-3">Company</th>
                <th class="pb-2 pr-3 text-right" title="Distinct users who logged at least one ride or walk">Users</th>
                <th class="pb-2 pr-3 text-right" title="CO2 emissions avoided = distance (km) x 0.25 kg/km (avg car emission factor)">
                  <i class="fa-solid fa-leaf mr-1" style="font-size: 0.55rem;"></i>CO2 Avoided
                </th>
                <th class="pb-2 pr-3 text-right" title="Monetised mortality reduction from active mobility (WHO HEAT method) = distance (km) x ₹1.75/km">
                  <i class="fa-solid fa-heart-pulse mr-1" style="font-size: 0.55rem;"></i>Healthcare Value
                </th>
                <th class="pb-2 pr-3 text-right" title="Equivalent body fat burned = distance (km) x 35 kcal/km (blended cycling/walking avg) / 7,700 kcal per kg fat">
                  <i class="fa-solid fa-fire-flame-curved mr-1" style="font-size: 0.55rem;"></i>Fat Burn
                </th>
                {#if congestionDelay}
                  <th class="pb-2 text-right" title="Hours not spent in traffic = distance (km) x (1/congested_speed - 1/free_flow_speed). Uses city avg speeds from TomTom: {congestion?.avgCurrentSpeed.toFixed(0)} km/h congested, {congestion?.avgFreeFlowSpeed.toFixed(0)} km/h free flow.">
                    <i class="fa-solid fa-hourglass-half mr-1" style="font-size: 0.55rem;"></i>Traffic Hours Saved
                  </th>
                {/if}
              </tr>
            </thead>
            <tbody>
              {#each companies.top as company, i}
                {@const co2Kg = Math.round(company.totalKm * 0.25)}
                {@const healthValue = Math.round(company.totalKm * 1.75)}
                {@const fatBurnKg = (company.totalKm * 35 / 7700)}
                {@const trafficHours = congestionDelay ? Math.round(company.totalKm * congestionDelay) : null}
                <tr class="border-b border-border/50 last:border-0">
                  <td class="py-2 pr-3 text-xs text-text-secondary">{i + 1}</td>
                  <td class="py-2 pr-3 font-medium text-text-primary">
                    <i class="fa-solid fa-building-user mr-1.5 text-text-secondary" style="font-size: 0.65rem;"></i>
                    {company.name}
                  </td>
                  <td class="py-2 pr-3 text-right tabular-nums text-text-primary">{formatNumber(company.activeUsers)}</td>
                  <td class="py-2 pr-3 text-right tabular-nums text-text-primary">{formatCompact(co2Kg)} kg</td>
                  <td class="py-2 pr-3 text-right tabular-nums text-text-primary">₹{formatCompact(healthValue)}</td>
                  <td class="py-2 pr-3 text-right tabular-nums text-text-primary">{fatBurnKg >= 10 ? formatCompact(Math.round(fatBurnKg)) : fatBurnKg.toFixed(1)} kg</td>
                  {#if trafficHours !== null}
                    <td class="py-2 text-right tabular-nums text-text-primary">{formatCompact(trafficHours)} hrs</td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if companies.count > companies.top.length}
          <p class="mt-3 text-xs text-text-secondary">+{companies.count - companies.top.length} more companies</p>
        {/if}
      {:else}
        <div class="flex flex-wrap gap-2">
          {#each companies.top as company}
            <span class="inline-flex items-center rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-primary">
              <i class="fa-solid fa-building-user mr-1.5 text-text-secondary" style="font-size: 0.65rem;"></i>
              {company.name}
            </span>
          {/each}
          {#if companies.count > companies.top.length}
            <span class="inline-flex items-center rounded-md border border-border bg-earth-50 px-2.5 py-1 text-xs font-medium text-text-secondary">
              +{companies.count - companies.top.length} more
            </span>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</section>
