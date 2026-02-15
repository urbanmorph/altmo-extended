<script lang="ts">
  import { GRADE_BOUNDARIES, gradeColor } from '$lib/config/city-qol-data';

  interface Props {
    indicatorCount: number;
    cityCount: number;
  }

  let { indicatorCount, cityCount }: Props = $props();

  function thresholdLabel(b: typeof GRADE_BOUNDARIES[0], i: number): string {
    if (i === GRADE_BOUNDARIES.length - 1) return `<${Math.round(GRADE_BOUNDARIES[i - 1].min * 100)}`;
    return `${Math.round(b.min * 100)}+`;
  }
</script>

<div class="rounded-xl border border-border bg-surface-card p-5">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <!-- Left: citation -->
    <div class="flex items-start gap-3">
      <i class="fa-solid fa-book-open mt-0.5 text-lg text-primary"></i>
      <div>
        <p class="text-sm font-semibold text-text-primary">Enhanced TQOLI</p>
        <p class="text-xs text-text-secondary">Allirani &amp; Verma (2025), IISc Bangalore</p>
        <p class="mt-1 text-xs text-text-secondary">
          4 dimensions &middot; {indicatorCount} indicators &middot; {cityCount} cities
        </p>
      </div>
    </div>

    <!-- Center: grade scale -->
    <div class="flex flex-wrap gap-2">
      {#each GRADE_BOUNDARIES as b, i (b.grade)}
        <div class="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5">
          <span
            class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
            style="background-color: {gradeColor(b.grade)}"
          >
            {b.grade}
          </span>
          <div class="flex flex-col">
            <span class="text-[0.65rem] font-semibold leading-tight text-text-primary">{thresholdLabel(b, i)}</span>
            <span class="text-[0.55rem] leading-tight text-text-secondary">{b.label}</span>
          </div>
        </div>
      {/each}
    </div>

    <!-- Right: links -->
    <div class="flex items-center gap-4 text-sm">
      <a
        href="https://doi.org/10.1080/21650020.2025.2466582"
        target="_blank"
        rel="noopener"
        class="inline-flex items-center gap-1 font-medium text-primary hover:text-primary-dark"
      >
        Read the paper
        <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
      </a>
      <a
        href="/benchmark"
        class="inline-flex items-center gap-1 font-medium text-primary hover:text-primary-dark"
      >
        Full methodology
        <i class="fa-solid fa-arrow-right text-xs"></i>
      </a>
    </div>
  </div>
</div>
