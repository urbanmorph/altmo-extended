<script lang="ts">
  interface Props {
    label: string;
    value: string;
    trend?: number;
    icon?: string;
    tooltip?: string;
  }

  let { label, value, trend, icon, tooltip }: Props = $props();
</script>

<div class="rounded-xl border border-border bg-surface-card p-6 shadow-sm">
  <div class="flex items-center justify-between">
    <p class="text-sm font-medium text-text-secondary">{label}</p>
    {#if icon}
      <i class="{icon} text-lg text-text-secondary"></i>
    {/if}
  </div>
  <p class="mt-2 text-3xl font-bold text-text-primary">{value}</p>
  {#if trend !== undefined}
    <p class="mt-1 text-sm {trend >= 0 ? 'text-success' : 'text-accent'}">
      {trend >= 0 ? '+' : ''}{trend.toFixed(1)}% vs prev period
    </p>
  {/if}
  {#if tooltip}
    <p class="mt-1.5 text-xs text-text-secondary leading-snug">{tooltip}</p>
  {/if}
</div>
