<script lang="ts">
  import { page } from '$app/state';
  import type { Snippet } from 'svelte';

  interface Props {
    city_selector?: Snippet;
  }

  let { city_selector }: Props = $props();

  const navItems = [
    { href: '/access', label: 'Access' },
    { href: '/pulse', label: 'Pulse' },
    { href: '/impact', label: 'Impact' },
    { href: '/routes', label: 'Routes' },
    { href: '/forecast', label: 'Forecast' }
  ];
</script>

<nav class="bg-altmo-green-100 text-white">
  <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <div class="flex h-16 items-center justify-between">
      <div class="flex items-center gap-8">
        <a href="/" class="text-xl font-bold tracking-tight">
          Altmo <span class="font-normal text-white/70">Intelligence</span>
        </a>
        <div class="hidden md:flex items-center gap-1">
          {#each navItems as item}
            <a
              href={item.href}
              class="rounded-md px-3 py-2 text-sm font-medium transition-colors
                {page.url.pathname.startsWith(item.href)
                  ? 'bg-white/20 text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'}"
            >
              {item.label}
            </a>
          {/each}
        </div>
      </div>
      <div class="flex items-center gap-4">
        {#if city_selector}
          {@render city_selector()}
        {/if}
      </div>
    </div>
  </div>
</nav>
