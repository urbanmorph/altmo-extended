<script lang="ts">
  import { page } from '$app/state';

  let mobileMenuOpen = $state(false);

  const navItems = [
    { href: '/', label: 'Home', exact: true },
    { href: '/benchmark', label: 'Compare', exact: false },
    { href: '/data-sources', label: 'Provenance', exact: false }
  ];
</script>

<nav class="bg-altmo-700 text-white">
  <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <div class="flex h-16 items-center justify-between">
      <div class="flex items-center gap-8">
        <a href="/" class="flex flex-col items-center">
          <img src="/altmo-logo-white.png" alt="Altmo" class="h-6" />
          <span class="w-full text-center text-[0.55rem] font-light tracking-[0.45em] uppercase text-white/70">Intelligence</span>
        </a>
        <div class="hidden md:flex items-center gap-1">
          {#each navItems as item}
            <a
              href={item.href}
              class="rounded-md px-3 py-2 text-sm font-medium transition-colors
                {(item.exact ? page.url.pathname === item.href : page.url.pathname.startsWith(item.href))
                  ? 'bg-white/20 text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'}"
            >
              {item.label}
            </a>
          {/each}
        </div>
      </div>
      <div class="flex items-center gap-4">
        <button
          class="md:hidden rounded-md p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          onclick={() => mobileMenuOpen = !mobileMenuOpen}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          {#if mobileMenuOpen}
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          {:else}
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          {/if}
        </button>
      </div>
    </div>
  </div>

  {#if mobileMenuOpen}
    <div class="md:hidden border-t border-white/10">
      <div class="px-4 py-3 space-y-1">
        {#each navItems as item}
          <a
            href={item.href}
            class="block rounded-md px-3 py-2 text-sm font-medium transition-colors
              {(item.exact ? page.url.pathname === item.href : page.url.pathname.startsWith(item.href))
                ? 'bg-white/20 text-white'
                : 'text-white/80 hover:bg-white/10 hover:text-white'}"
            onclick={() => mobileMenuOpen = false}
          >
            {item.label}
          </a>
        {/each}
      </div>
    </div>
  {/if}
</nav>
