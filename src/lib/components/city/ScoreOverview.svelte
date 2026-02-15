<script lang="ts">
  import type { CityQoLScore } from '$lib/config/city-qol-data';
  import { gradeLabel } from '$lib/config/city-qol-data';
  import type { CityGapAnalysis } from '$lib/config/city-qol-gaps';

  interface Props {
    cityId: string;
    cityName: string;
    qolScore: CityQoLScore | null;
    gap: CityGapAnalysis | null;
    readinessScore: number | null;
  }

  let { cityId, cityName, qolScore, gap, readinessScore }: Props = $props();

  let shareStatus = $state<'idle' | 'copied'>('idle');

  async function shareScorecard() {
    const url = `https://intelligence.altmo.app/city/${cityId}`;
    const score = qolScore ? Math.round(qolScore.composite * 100) : null;
    const grade = qolScore?.grade ?? null;
    const text = score !== null && grade
      ? `${cityName} scores ${score}/100 (Grade ${grade}) on the Altmo ETQOLI index`
      : `${cityName} active mobility scorecard on Altmo Intelligence`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `${cityName} — Altmo Intelligence`, text, url });
      } catch {
        // User cancelled share — ignore
      }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      shareStatus = 'copied';
      setTimeout(() => { shareStatus = 'idle'; }, 2000);
    }
  }

  const GRADE_COLORS: Record<string, string> = {
    A: '#16a34a',
    B: '#2563eb',
    C: '#eab308',
    D: '#FF7B27',
    E: '#dc2626'
  };

  const compositePercent = $derived(qolScore ? Math.round(qolScore.composite * 100) : 0);
  const gradeColor = $derived(qolScore ? GRADE_COLORS[qolScore.grade] ?? '#999999' : '#999999');

  const confidenceLabel = $derived.by(() => {
    if (!qolScore) return '—';
    const labels: Record<string, string> = {
      gold: 'Gold (>80% indicators)',
      silver: 'Silver (>60% indicators)',
      bronze: 'Bronze (<60% indicators)'
    };
    return labels[qolScore.confidence] ?? qolScore.confidence;
  });

  const confidenceIcon = $derived.by(() => {
    if (!qolScore) return 'fa-solid fa-circle-question';
    const icons: Record<string, string> = {
      gold: 'fa-solid fa-medal',
      silver: 'fa-solid fa-medal',
      bronze: 'fa-solid fa-medal'
    };
    return icons[qolScore.confidence] ?? 'fa-solid fa-circle-question';
  });

  const confidenceColor = $derived.by(() => {
    if (!qolScore) return '#999999';
    const colors: Record<string, string> = {
      gold: '#eab308',
      silver: '#9ca3af',
      bronze: '#b45309'
    };
    return colors[qolScore.confidence] ?? '#999999';
  });
</script>

<section id="score" class="scroll-mt-16">
  <h2 class="mb-6 text-xl font-bold text-text-primary">
    <i class="fa-solid fa-gauge-high mr-2 text-altmo-700"></i>
    Score Overview
  </h2>

  {#if qolScore}
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Grade badge + composite -->
      <div class="flex flex-col items-center rounded-xl border border-border bg-surface-card p-6 shadow-sm">
        <div
          class="flex h-24 w-24 items-center justify-center rounded-full text-4xl font-black text-white"
          style="background-color: {gradeColor};"
        >
          {qolScore.grade}
        </div>
        <p class="mt-3 text-sm font-medium text-text-secondary">{gradeLabel(qolScore.grade)}</p>
        <p class="mt-4 text-3xl font-bold text-text-primary">{compositePercent}<span class="text-lg text-text-secondary">/100</span></p>
        <div class="mt-2 h-2 w-full rounded-full bg-earth-100">
          <div
            class="h-2 rounded-full transition-all duration-500"
            style="width: {compositePercent}%; background-color: {gradeColor};"
          ></div>
        </div>
        <!-- Confidence badge -->
        <div class="mt-4 flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium" style="background-color: {confidenceColor}20; color: {confidenceColor};">
          <i class="{confidenceIcon}"></i>
          {confidenceLabel}
        </div>
        {#if readinessScore !== null}
          <p class="mt-2 text-xs text-text-secondary">
            Data readiness: {Math.round(readinessScore)}%
          </p>
        {/if}
        <button
          onclick={shareScorecard}
          class="mt-4 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-earth-50 hover:text-primary"
          title="Share scorecard"
        >
          <i class="fa-solid fa-share-nodes"></i>
          {#if shareStatus === 'copied'}
            Copied!
          {:else}
            Share
          {/if}
        </button>
      </div>

      <!-- Dimension bars -->
      <div class="rounded-xl border border-border bg-surface-card p-6 shadow-sm lg:col-span-2">
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-text-secondary">Dimensions</h3>
        <div class="space-y-4">
          {#each qolScore.dimensions as dim}
            {@const dimPercent = Math.round(dim.score * 100)}
            {@const dimColor = dimPercent >= 60 ? '#16a34a' : dimPercent >= 40 ? '#eab308' : '#dc2626'}
            <div>
              <div class="mb-1 flex items-center justify-between">
                <span class="text-sm font-medium text-text-primary">{dim.label}</span>
                <span class="text-sm font-semibold" style="color: {dimColor};">{dimPercent}/100</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="h-3 flex-1 rounded-full bg-earth-100">
                  <div
                    class="h-3 rounded-full transition-all duration-500"
                    style="width: {dimPercent}%; background-color: {dimColor};"
                  ></div>
                </div>
                <span class="w-12 text-right text-xs text-text-secondary">{Math.round(dim.weight * 100)}%</span>
              </div>
              <p class="mt-1 text-xs text-text-secondary">
                {dim.availableCount}/{dim.totalCount} indicators measured
              </p>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Upgrade path -->
    {#if gap}
      <div class="mt-6 rounded-xl border border-border bg-surface-card p-6 shadow-sm">
        <div class="flex items-start gap-3">
          <i class="fa-solid fa-arrow-trend-up mt-1 text-lg text-tangerine-500"></i>
          <div>
            <p class="font-medium text-text-primary">{gap.upgradeSentence}</p>
            <p class="mt-2 text-sm text-text-secondary">
              <i class="fa-solid fa-triangle-exclamation mr-1"></i>
              Biggest gap: {gap.worstDimension} — {gap.gapSentence}
            </p>
            <p class="mt-1 text-sm text-text-secondary">
              <i class="fa-solid fa-lightbulb mr-1 text-tangerine-300"></i>
              {gap.recommendation}
            </p>
          </div>
        </div>
      </div>
    {/if}
  {:else}
    <div class="rounded-xl border border-border bg-surface-card p-8 text-center">
      <i class="fa-solid fa-chart-simple text-3xl text-text-secondary"></i>
      <p class="mt-2 text-text-secondary">QoL score data is not available for this city.</p>
    </div>
  {/if}
</section>
