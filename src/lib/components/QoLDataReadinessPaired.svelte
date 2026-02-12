<script lang="ts">
  import { computeAllQoL, gradeColor } from '$lib/config/city-qol-data';
  import { computeAllScores, CITY_READINESS, type DataStatus } from '$lib/config/data-readiness';
  import { computeAllGaps } from '$lib/config/city-qol-gaps';
  import { cityName, barPercent, dimensionColor, readinessScoreColor } from '$lib/utils/qol-format';

  const allQoL = computeAllQoL();
  const allReadiness = computeAllScores();
  const allGaps = computeAllGaps();

  function getReadiness(cityId: string) {
    return allReadiness.find((r) => r.cityId === cityId);
  }

  function getGap(cityId: string) {
    return allGaps.find((g) => g.cityId === cityId);
  }

  function countLayers(cityId: string, status: DataStatus): number {
    const city = CITY_READINESS.find((r) => r.cityId === cityId);
    if (!city) return 0;
    return Object.values(city.layers).filter((s) => s === status).length;
  }
</script>

<div class="space-y-4">
  {#each allQoL as qol (qol.cityId)}
    {@const readiness = getReadiness(qol.cityId)}
    {@const gap = getGap(qol.cityId)}
    {@const qolColor = gradeColor(qol.grade)}
    {@const readColor = readiness ? readinessScoreColor(readiness.total) : 'var(--color-text-secondary)'}
    {@const unavailCount = countLayers(qol.cityId, 'unavailable')}
    {@const partialCount = countLayers(qol.cityId, 'partial')}

    <div class="rounded-xl border border-border bg-surface-card p-5">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <!-- Left: QoL summary -->
        <div>
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-semibold text-text-primary">{cityName(qol.cityId)}</h3>
              <p class="text-xs text-text-secondary">Transport Quality of Life</p>
            </div>
            <div class="text-right">
              <span class="text-2xl font-bold" style="color: {qolColor}">{qol.grade}</span>
              <p class="text-xs text-text-secondary">{Math.round(qol.composite * 100)}/100</p>
            </div>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
            {#each qol.dimensions as dim (dim.key)}
              <div>
                <div class="flex items-center justify-between text-[0.65rem] text-text-secondary">
                  <span>{dim.label}</span>
                  <span>{Math.round(dim.score * 100)}</span>
                </div>
                <div class="mt-0.5 h-1 w-full rounded-full bg-earth-100">
                  <div
                    class="h-1 rounded-full"
                    style="width: {barPercent(dim.score)}%; background-color: {dimensionColor(dim.score)}"
                  ></div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Right: Data readiness -->
        {#if readiness}
          <div>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-text-primary">Data Readiness</p>
                <p class="text-xs text-text-secondary">
                  {unavailCount > 0 ? `${unavailCount} missing` : ''}
                  {unavailCount > 0 && partialCount > 0 ? ', ' : ''}
                  {partialCount > 0 ? `${partialCount} partial` : ''}
                  {unavailCount === 0 && partialCount === 0 ? 'All layers available' : ''}
                </p>
              </div>
              <span class="text-2xl font-bold" style="color: {readColor}">{Math.round(readiness.total)}</span>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {#each readiness.categories as cat (cat.key)}
                <div>
                  <div class="flex items-center justify-between text-[0.65rem] text-text-secondary">
                    <span>{cat.label}</span>
                    <span>{Math.round(cat.score)}/{cat.max}</span>
                  </div>
                  <div class="mt-0.5 h-1 w-full rounded-full bg-earth-100">
                    <div
                      class="h-1 rounded-full"
                      style="width: {barPercent(cat.score, cat.max)}%; background-color: {readinessScoreColor(cat.max > 0 ? (cat.score / cat.max) * 100 : 0)}"
                    ></div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Bottom: data unlock narrative -->
      {#if gap}
        <p class="mt-3 border-t border-border pt-3 text-xs text-text-secondary">
          <i class="fa-solid fa-unlock mr-1 text-primary"></i>
          {gap.dataUnlockSentence}
        </p>
      {/if}
    </div>
  {/each}
</div>
