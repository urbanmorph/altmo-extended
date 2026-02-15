<script lang="ts">
  import {
    QOL_DIMENSIONS,
    INDICATOR_BENCHMARKS,
    GRADE_BOUNDARIES,
    type ConfidenceTier
  } from '$lib/config/city-qol-data';

  const confidenceTiers: { tier: ConfidenceTier; label: string; threshold: string; icon: string; color: string }[] = [
    { tier: 'gold', label: 'Gold', threshold: 'Score \u2265 70 \u2014 rich live data + comprehensive coverage', icon: 'fa-solid fa-certificate', color: '#D4AF37' },
    { tier: 'silver', label: 'Silver', threshold: 'Score \u2265 45 \u2014 moderate live data + partial coverage', icon: 'fa-solid fa-certificate', color: '#9CA3AF' },
    { tier: 'bronze', label: 'Bronze', threshold: 'Score < 45 \u2014 mostly static data + gaps in coverage', icon: 'fa-solid fa-circle-half-stroke', color: '#CD7F32' }
  ];
</script>

<div class="space-y-4">
  <!-- Section A: ETQOLI Approach -->
  <div class="rounded-xl border border-border bg-surface-card p-5">
    <div class="flex items-start gap-3">
      <i class="fa-solid fa-book-open mt-0.5 text-lg text-primary"></i>
      <div>
        <h3 class="font-semibold text-text-primary">Enhanced TQOLI</h3>
        <p class="mt-1 text-sm text-text-secondary">
          Scoring uses the TQOLI framework (Transport Quality of Life Index) by Allirani &amp; Verma (2025), IISc Bangalore, enhanced with benchmark-anchored normalization. Scores are fixed against policy targets, so adding cities or indicators does not shift existing scores.
        </p>
        <a
          href="https://doi.org/10.1080/21650020.2025.2466582"
          target="_blank"
          rel="noopener"
          class="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-dark"
        >
          Read the paper
          <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
        </a>
      </div>
    </div>
  </div>

  <!-- Section B: Benchmark Reference Table -->
  <div class="rounded-xl border border-border bg-surface-card p-5">
    <div class="flex items-start gap-3">
      <i class="fa-solid fa-bullseye mt-0.5 text-lg text-primary"></i>
      <div class="min-w-0 flex-1">
        <h3 class="font-semibold text-text-primary">Benchmark References</h3>
        <p class="mt-1 text-sm text-text-secondary">
          Each indicator is scored from 0 (worst reference) to 1 (target). Values beyond the target score 1; below the worst score 0.
        </p>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-border text-left text-text-secondary">
                <th class="pb-1.5 pr-3 font-medium">Indicator</th>
                <th class="pb-1.5 pr-3 font-medium">Worst Ref</th>
                <th class="pb-1.5 pr-3 font-medium">Target</th>
                <th class="pb-1.5 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {#each QOL_DIMENSIONS as dim}
                {#each dim.indicators as ind (ind.key)}
                  {@const bench = INDICATOR_BENCHMARKS[ind.key]}
                  {#if bench}
                    <tr class="border-b border-border/50">
                      <td class="py-1.5 pr-3 font-medium text-text-primary">{ind.label} <span class="font-normal text-text-secondary">({ind.unit})</span></td>
                      <td class="py-1.5 pr-3 text-text-secondary">{bench.worstRef}</td>
                      <td class="py-1.5 pr-3 text-text-primary">{bench.target}</td>
                      <td class="py-1.5 text-text-secondary">{bench.source}</td>
                    </tr>
                  {/if}
                {/each}
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- Section C: Grade Scale + Confidence Tiers -->
  <div class="rounded-xl border border-border bg-surface-card p-5">
    <div class="flex items-start gap-3">
      <i class="fa-solid fa-ranking-star mt-0.5 text-lg text-primary"></i>
      <div class="min-w-0 flex-1">
        <h3 class="font-semibold text-text-primary">Grade Scale &amp; Confidence</h3>

        <!-- Grade badges -->
        <div class="mt-3 flex flex-wrap gap-2">
          {#each GRADE_BOUNDARIES as b (b.grade)}
            <div class="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5">
              <span class="text-sm font-bold text-text-primary">{b.grade}</span>
              <span class="text-xs text-text-secondary">&ge;{Math.round(b.min * 100)} &mdash; {b.label}</span>
            </div>
          {/each}
        </div>

        <!-- Confidence tiers -->
        <p class="mt-3 text-sm font-medium text-text-primary">Data Confidence</p>
        <p class="mt-0.5 text-xs text-text-secondary">
          Multi-factor score (0-100) combining indicator coverage, live data freshness, sensor coverage, transit data quality, data readiness, and Altmo trace availability.
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          {#each confidenceTiers as ct (ct.tier)}
            <div class="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5">
              <i class="{ct.icon} text-sm" style="color: {ct.color}"></i>
              <span class="text-xs text-text-primary font-medium">{ct.label}</span>
              <span class="text-xs text-text-secondary">{ct.threshold}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <!-- Section D: Data Sources + Dimension Weights -->
  <div class="rounded-xl border border-border bg-surface-card p-5">
    <div class="flex items-start gap-3">
      <i class="fa-solid fa-database mt-0.5 text-lg text-primary"></i>
      <div class="min-w-0 flex-1">
        <h3 class="font-semibold text-text-primary">Dimensions &amp; Weights</h3>
        <p class="mt-1 text-sm text-text-secondary">
          Weights derived via Fuzzy-AHP expert survey of 40 Indian transport planners.
        </p>
        <div class="mt-3 space-y-2">
          {#each QOL_DIMENSIONS as dim (dim.key)}
            <div>
              <div class="flex items-center justify-between text-xs">
                <span class="font-medium text-text-primary">{dim.label}</span>
                <span class="text-text-secondary">{Math.round(dim.weight * 100)}%</span>
              </div>
              <div class="mt-0.5 h-1.5 w-full rounded-full bg-earth-100">
                <div class="h-1.5 rounded-full bg-primary" style="width: {dim.weight * 100}%"></div>
              </div>
              <div class="mt-1 flex flex-wrap gap-x-3 text-[0.65rem] text-text-secondary">
                {#each dim.indicators as ind (ind.key)}
                  <span>{ind.label} <span class="text-text-secondary/70">({ind.source})</span></span>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>
