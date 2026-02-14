<script lang="ts">
  import { GRADE_BOUNDARIES } from '$lib/config/city-qol-data';

  interface Props {
    indicatorCount: number;
    cityCount: number;
  }

  let { indicatorCount, cityCount }: Props = $props();
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
    <div class="flex flex-wrap gap-1.5">
      {#each GRADE_BOUNDARIES as b (b.grade)}
        <span class="rounded bg-earth-100 px-2 py-0.5 text-xs font-bold text-text-primary">
          {b.grade}
        </span>
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
