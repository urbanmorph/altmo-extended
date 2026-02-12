<script lang="ts">
  import { computeAllScores, type ReadinessScore } from '$lib/config/data-readiness';
  import { CITIES } from '$lib/config/cities';

  const scores = computeAllScores();

  function cityName(cityId: string): string {
    return CITIES.find((c) => c.id === cityId)?.name ?? cityId;
  }

  function scoreColor(total: number): string {
    if (total >= 70) return 'var(--color-status-available)';
    if (total >= 40) return 'var(--color-status-partial)';
    return 'var(--color-status-unavailable)';
  }

  function barPercent(score: number, max: number): number {
    return max > 0 ? (score / max) * 100 : 0;
  }
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {#each scores as entry (entry.cityId)}
    {@const color = scoreColor(entry.total)}
    <a
      href="/access?city={entry.cityId}"
      class="group rounded-xl border border-border bg-surface-card p-5 transition-shadow hover:shadow-md"
    >
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-text-primary group-hover:text-primary">{cityName(entry.cityId)}</h3>
        <span class="text-2xl font-bold" style="color: {color}">{Math.round(entry.total)}</span>
      </div>

      <div class="mt-4 space-y-2">
        {#each entry.categories as cat (cat.key)}
          <div>
            <div class="flex items-center justify-between text-xs text-text-secondary">
              <span>{cat.label}</span>
              <span>{Math.round(cat.score)}/{cat.max}</span>
            </div>
            <div class="mt-0.5 h-1.5 w-full rounded-full bg-earth-100">
              <div
                class="h-1.5 rounded-full transition-all"
                style="width: {barPercent(cat.score, cat.max)}%; background-color: {scoreColor(cat.score / cat.max * 100)}"
              ></div>
            </div>
          </div>
        {/each}
      </div>
    </a>
  {/each}
</div>
