<script lang="ts">
  import { INTERVENTIONS, getCityMetroKm, type InterventionValues } from '$lib/config/scenarios';
  import type { QoLOverrides } from '$lib/config/city-qol-data';

  interface Props {
    interventions: InterventionValues;
    cityId: string;
    baselineOverrides?: QoLOverrides;
    onchange?: () => void;
  }

  let { interventions = $bindable(), cityId, baselineOverrides, onchange }: Props = $props();

  const cityMetroKm = $derived(getCityMetroKm(cityId, baselineOverrides));

  function resolveMin(min: number | 'city_metro'): number {
    return min === 'city_metro' ? cityMetroKm : min;
  }

  function getValue(key: string): number {
    return interventions[key as keyof InterventionValues] as number;
  }

  function setValue(key: string, val: number) {
    interventions = { ...interventions, [key]: val };
    onchange?.();
  }

  function formatValue(value: number, unit: string): string {
    if (unit === 'x') return `${value.toFixed(1)}x`;
    if (unit === '%') return `${value}%`;
    if (unit === 'km') return `${value} km`;
    return `${value}`;
  }
</script>

<div class="space-y-4">
  {#each INTERVENTIONS as intv (intv.key)}
    {@const val = getValue(intv.key)}
    {@const min = resolveMin(intv.min)}
    {@const isDefault = intv.key === 'metro_km' ? val === cityMetroKm : val === intv.defaultValue}
    <div class="rounded-lg border border-border bg-surface-card p-3">
      <div class="mb-2 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <i class="{intv.icon} w-5 text-center text-sm text-primary"></i>
          <span class="text-sm font-medium text-text-primary">{intv.label}</span>
        </div>
        <span class="rounded-md px-2 py-0.5 text-sm font-semibold {isDefault ? 'text-text-secondary' : 'bg-altmo-50 text-primary'}">
          {formatValue(val, intv.unit)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={intv.max}
        step={intv.step}
        value={val}
        oninput={(e) => setValue(intv.key, parseFloat((e.target as HTMLInputElement).value))}
        class="slider w-full"
      />
      <div class="mt-1 flex justify-between text-xs text-text-secondary">
        <span>{formatValue(min, intv.unit)}</span>
        <span>{formatValue(intv.max, intv.unit)}</span>
      </div>
    </div>
  {/each}
</div>

<style>
  .slider {
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    border-radius: 3px;
    background: var(--color-neutral-200);
    outline: none;
    cursor: pointer;
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-altmo-700);
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-altmo-700);
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
</style>
