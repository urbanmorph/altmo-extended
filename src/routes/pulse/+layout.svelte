<script lang="ts">
  import { page } from '$app/state';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  const tabs = [
    { href: '/pulse', label: 'Overview', exact: true },
    { href: '/pulse/trips', label: 'Trips' },
    { href: '/pulse/commute', label: 'Commute' },
    { href: '/pulse/transit', label: 'Transit' },
    { href: '/pulse/recreation', label: 'Recreation' },
    { href: '/pulse/trends', label: 'Trends' }
  ];

  function isActive(href: string, exact: boolean | undefined): boolean {
    if (exact) return page.url.pathname === href;
    return page.url.pathname.startsWith(href);
  }
</script>

<svelte:head>
  <title>Pulse — Altmo Intelligence</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <h1 class="text-2xl font-bold text-text-primary">Pulse</h1>
  <p class="mt-1 text-text-secondary">Active mobility patterns and trend analysis.</p>

  <div class="mt-6 border-b border-border">
    <nav class="-mb-px flex gap-4 overflow-x-auto">
      {#each tabs as tab}
        <a
          href={tab.href}
          class="whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors
            {isActive(tab.href, tab.exact)
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:border-earth-300 hover:text-text-primary'}"
        >
          {tab.label}
        </a>
      {/each}
    </nav>
  </div>

  <div class="mt-6">
    {@render children()}
  </div>
</div>
