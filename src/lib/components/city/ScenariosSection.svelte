<script lang="ts">
  interface ScenarioItem {
    id: string;
    name: string;
    description: string;
    score: number;
  }

  interface Props {
    currentScore: number | null;
    currentGrade: string | null;
    scenarios: ScenarioItem[];
  }

  let { currentScore, currentGrade, scenarios }: Props = $props();

  const currentPercent = $derived(currentScore !== null ? Math.round(currentScore * 100) : 0);

  const GRADE_COLORS: Record<string, string> = {
    A: '#16a34a',
    B: '#2563eb',
    C: '#eab308',
    D: '#FF7B27',
    E: '#dc2626'
  };

  function gradeFromScore(score: number): string {
    if (score >= 0.75) return 'A';
    if (score >= 0.60) return 'B';
    if (score >= 0.45) return 'C';
    if (score >= 0.30) return 'D';
    return 'E';
  }

  function barColor(score: number): string {
    const grade = gradeFromScore(score);
    return GRADE_COLORS[grade] ?? '#999999';
  }

  // Max score for bar scaling
  const maxScore = $derived.by(() => {
    const scores = scenarios.map((s) => s.score);
    if (currentScore !== null) scores.push(currentScore);
    return Math.max(...scores, 0.5);
  });
</script>

<section id="scenarios" class="scroll-mt-16">
  <h2 class="mb-6 text-xl font-bold text-text-primary">
    <i class="fa-solid fa-wand-magic-sparkles mr-2 text-altmo-700"></i>
    What Could Be (Scenarios)
  </h2>

  {#if scenarios.length > 0 && currentScore !== null}
    <div class="rounded-xl border border-border bg-surface-card p-6 shadow-sm">
      <!-- Current score bar -->
      <div class="mb-6">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm font-semibold text-text-primary">Current Score</span>
          <span class="text-sm font-bold" style="color: {barColor(currentScore)};">
            {currentPercent} ({currentGrade})
          </span>
        </div>
        <div class="h-4 w-full rounded-full bg-earth-100">
          <div
            class="h-4 rounded-full transition-all duration-500"
            style="width: {(currentScore / maxScore) * 100}%; background-color: {barColor(currentScore)};"
          ></div>
        </div>
      </div>

      <!-- Scenario bars -->
      <div class="space-y-5">
        {#each scenarios as scenario}
          {@const scenarioPercent = Math.round(scenario.score * 100)}
          {@const scenarioGrade = gradeFromScore(scenario.score)}
          {@const delta = scenarioPercent - currentPercent}
          <div>
            <div class="mb-1 flex items-center justify-between">
              <span class="text-sm font-medium text-text-primary">{scenario.name}</span>
              <span class="text-sm font-bold" style="color: {barColor(scenario.score)};">
                {scenarioPercent} ({scenarioGrade})
                {#if delta > 0}
                  <span class="ml-1 text-xs text-altmo-500">+{delta}</span>
                {/if}
              </span>
            </div>
            <div class="h-4 w-full rounded-full bg-earth-100">
              <div
                class="h-4 rounded-full transition-all duration-500"
                style="width: {(scenario.score / maxScore) * 100}%; background-color: {barColor(scenario.score)};"
              ></div>
            </div>
            <p class="mt-1 text-xs text-text-secondary">{scenario.description}</p>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <div class="rounded-xl border border-border bg-surface-card p-8 text-center">
      <i class="fa-solid fa-flask text-3xl text-text-secondary"></i>
      <p class="mt-2 text-text-secondary">Scenario modelling is not available for this city.</p>
    </div>
  {/if}
</section>
