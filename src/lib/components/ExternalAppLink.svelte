<script lang="ts">
  interface Props {
    href: string;
    label: string;
    description?: string;
  }

  let { href, label, description }: Props = $props();
</script>

<a
  {href}
  target="_blank"
  rel="noopener noreferrer"
  class="group flex items-center gap-2 rounded-lg px-3 py-2 text-sm
    text-text-secondary transition-colors hover:bg-earth-100 hover:text-text-primary"
>
  <span class="font-medium">{label}</span>
  {#if description}
    <span class="hidden text-text-secondary/70 sm:inline">· {description}</span>
  {/if}
  <svg class="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
</a>
