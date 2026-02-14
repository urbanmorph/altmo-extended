<script lang="ts">
  interface Props {
    headline: string;
    subtitle: string;
    citiesTracked: string;
    avgQoL: string;
    topCity: string;
    biggestGap: string;
    platformScale?: string;
  }

  let {
    headline,
    subtitle,
    citiesTracked,
    avgQoL,
    topCity,
    biggestGap,
    platformScale
  }: Props = $props();
</script>

<div class="rounded-2xl bg-altmo-900 p-6 text-white sm:p-8">
  <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
    <!-- Left: cross-city insight -->
    <div class="min-w-0 flex-[3]">
      <p class="text-xs font-semibold uppercase tracking-widest text-altmo-200">
        Altmo Intelligence
      </p>
      <h1 class="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
        {headline}
      </h1>
      <p class="mt-3 text-sm text-tangerine-300">
        <i class="fa-solid fa-chart-line mr-1"></i>
        {subtitle}
      </p>
      {#if platformScale}
        <p class="mt-2 text-xs text-altmo-200">
          <i class="fa-solid fa-database mr-1"></i>
          {platformScale}
        </p>
      {/if}
    </div>

    <!-- Right: 2x2 stat grid -->
    <div class="grid flex-[2] grid-cols-2 gap-3">
      <div class="rounded-lg bg-white/10 px-3 py-2.5">
        <p class="text-[0.65rem] uppercase tracking-wide text-altmo-200">Cities Tracked</p>
        <p class="mt-0.5 text-xl font-bold">{citiesTracked}</p>
      </div>
      <div class="rounded-lg bg-white/10 px-3 py-2.5">
        <p class="text-[0.65rem] uppercase tracking-wide text-altmo-200">Avg QoL</p>
        <p class="mt-0.5 text-xl font-bold">{avgQoL}</p>
      </div>
      <div class="rounded-lg bg-white/10 px-3 py-2.5">
        <p class="text-[0.65rem] uppercase tracking-wide text-altmo-200">Top City</p>
        <p class="mt-0.5 text-xl font-bold">{topCity}</p>
      </div>
      <div class="rounded-lg bg-white/10 px-3 py-2.5">
        <p class="text-[0.65rem] uppercase tracking-wide text-altmo-200">Weakest Area</p>
        <p class="mt-0.5 text-xl font-bold">{biggestGap}</p>
      </div>
    </div>
  </div>
</div>
