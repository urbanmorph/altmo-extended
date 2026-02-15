<script lang="ts">
  import { CITIES } from '$lib/config/cities';
  import { CITY_READINESS } from '$lib/config/data-readiness';
  import { CITY_QOL_DATA } from '$lib/config/city-qol-data';
  import { formatCompact } from '$lib/utils/format';

  interface Props {
    globalActivities?: number;
    globalUsers?: number;
    globalDistanceKm?: number;
    globalCo2Kg?: number;
    routesAnalyzed?: number;
  }

  let {
    globalActivities = 0,
    globalUsers = 0,
    globalDistanceKm = 0,
    globalCo2Kg = 0,
    routesAnalyzed = 0
  }: Props = $props();

  const citiesWithBus = CITY_READINESS.filter((r) => r.layers.bus_stops === 'available').length;
  const totalRailKm = CITY_QOL_DATA.reduce((sum, c) => sum + (c.values.rail_transit_km ?? 0), 0);

  interface Module {
    href: string;
    icon: string;
    title: string;
    teaser: string;
    preview?: boolean;
  }

  const modules: Module[] = $derived([
    {
      href: '/access',
      icon: 'fa-solid fa-map-location-dot',
      title: 'Access',
      teaser: `Bus stop mapping for ${citiesWithBus} cities, ${Math.round(totalRailKm)} km rail transit covered`
    },
    {
      href: '/pulse',
      icon: 'fa-solid fa-wave-square',
      title: 'Pulse',
      teaser: globalActivities > 0
        ? `${formatCompact(globalActivities)}+ activities from ${formatCompact(globalUsers)} users across ${CITIES.length} cities`
        : `Activity analytics across ${CITIES.length} cities`
    },
    {
      href: '/impact',
      icon: 'fa-solid fa-leaf',
      title: 'Impact',
      teaser: globalCo2Kg > 0
        ? `${formatCompact(globalCo2Kg)} kg CO2 offset, ${formatCompact(globalDistanceKm)} km active mobility tracked`
        : 'City-level air quality, road safety, and congestion data'
    },
    {
      href: '/routes',
      icon: 'fa-solid fa-route',
      title: 'Routes',
      teaser: routesAnalyzed > 0
        ? `${routesAnalyzed.toLocaleString()} GPS-traced routes with density heatmap and corridor analysis`
        : 'Route density heatmap and corridor analysis'
    },
    {
      href: '/forecast',
      icon: 'fa-solid fa-sliders',
      title: 'Forecast',
      teaser: 'What-if scenario modelling for transport QoL interventions'
    },
    {
      href: '/data-sources',
      icon: 'fa-solid fa-database',
      title: 'Data Provenance',
      teaser: `References and provenance for all ${CITIES.length} cities`
    }
  ]);
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {#each modules as mod (mod.href)}
    <a
      href={mod.href}
      class="group relative rounded-xl border border-border bg-surface-card p-5 transition-shadow hover:shadow-md"
    >
      {#if mod.preview}
        <span class="absolute right-3 top-3 rounded-full bg-earth-100 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-text-secondary">
          Preview
        </span>
      {/if}
      <div class="flex items-start gap-3">
        <i class="{mod.icon} mt-0.5 text-lg text-primary"></i>
        <div>
          <h3 class="font-semibold text-text-primary group-hover:text-primary">{mod.title}</h3>
          <p class="mt-1 text-sm text-text-secondary">{mod.teaser}</p>
        </div>
      </div>
    </a>
  {/each}
</div>
