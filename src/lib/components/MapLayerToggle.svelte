<script lang="ts">
  interface Props {
    label: string;
    color: string;
    count?: number;
    checked?: boolean;
    onchange?: (checked: boolean) => void;
  }

  let { label, color, count, checked = $bindable(false), onchange }: Props = $props();

  function handleChange(e: Event) {
    checked = (e.target as HTMLInputElement).checked;
    onchange?.(checked);
  }
</script>

<label class="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
  <input
    type="checkbox"
    bind:checked
    class="rounded border-border text-primary"
    onchange={handleChange}
  />
  <span class="inline-block h-2.5 w-2.5 rounded-full" style="background-color: {color}"></span>
  <span>{label}</span>
  {#if count !== undefined}
    <span class="ml-auto text-xs text-text-secondary">({count.toLocaleString()})</span>
  {/if}
</label>
