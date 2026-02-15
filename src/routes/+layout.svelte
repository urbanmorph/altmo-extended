<script lang="ts">
  import '../app.css';
  import Nav from '$lib/components/Nav.svelte';
  import ExternalAppLink from '$lib/components/ExternalAppLink.svelte';
  import { navigating } from '$app/stores';

  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

{#if $navigating}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm">
    <div class="flex flex-col items-center gap-3">
      <i class="fa-solid fa-spinner fa-spin text-3xl text-altmo-700"></i>
      <p class="text-sm font-medium text-text-secondary">Loading...</p>
    </div>
  </div>
{/if}

<div class="flex min-h-screen flex-col">
  <Nav />

  <main class="flex-1">
    {@render children()}
  </main>

  <footer class="border-t border-border bg-surface-card">
    <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
      <p class="text-sm text-text-secondary">&copy; {new Date().getFullYear()} Altmo Intelligence</p>
      <div class="flex items-center gap-2">
        <span class="text-xs text-text-secondary">External:</span>
        <ExternalAppLink href="https://rentals.altmo.app" label="Rentals" description="CBS" />
        <ExternalAppLink href="https://tracker.altmo.app" label="Tracker" />
        <ExternalAppLink href="https://rewards.altmo.app" label="Rewards" />
      </div>
    </div>
  </footer>
</div>
