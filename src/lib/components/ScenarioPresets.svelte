<script lang="ts">
  import { SCENARIO_PRESETS, type ScenarioPreset } from '$lib/config/scenarios';

  interface Props {
    activePresetKey: string | null;
    onselect: (preset: ScenarioPreset) => void;
  }

  let { activePresetKey, onselect }: Props = $props();

  const metroLed = SCENARIO_PRESETS.filter((p) => p.group === 'metro-led' && p.key !== 'reset');
  const busNmt = SCENARIO_PRESETS.filter((p) => p.group === 'bus-nmt');
  const resetPreset = SCENARIO_PRESETS.find((p) => p.key === 'reset')!;
</script>

<div class="space-y-3">
  <div>
    <div class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
      Metro-Led (ST1)
    </div>
    <div class="flex flex-wrap gap-1.5">
      {#each metroLed as preset (preset.key)}
        <button
          onclick={() => onselect(preset)}
          class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors
            {activePresetKey === preset.key
              ? 'border-primary bg-altmo-50 text-primary'
              : 'border-border bg-surface-card text-text-primary hover:border-primary/40'}"
          title={preset.description}
        >
          {preset.label}
        </button>
      {/each}
    </div>
  </div>

  <div>
    <div class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
      Bus + NMT (ST2)
    </div>
    <div class="flex flex-wrap gap-1.5">
      {#each busNmt as preset (preset.key)}
        <button
          onclick={() => onselect(preset)}
          class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors
            {activePresetKey === preset.key
              ? 'border-primary bg-altmo-50 text-primary'
              : 'border-border bg-surface-card text-text-primary hover:border-primary/40'}"
          title={preset.description}
        >
          {preset.label}
        </button>
      {/each}
    </div>
  </div>

  <button
    onclick={() => onselect(resetPreset)}
    class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors
      {activePresetKey === 'reset'
        ? 'border-primary bg-altmo-50 text-primary'
        : 'border-border bg-surface-card text-text-secondary hover:border-primary/40 hover:text-text-primary'}"
  >
    <i class="fa-solid fa-rotate-left text-xs"></i>
    Reset
  </button>
</div>
