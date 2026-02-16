<script lang="ts">
  import '../app.css';
  import Nav from '$lib/components/Nav.svelte';
  import { navigating } from '$app/stores';
  import { CITIES } from '$lib/config/cities';

  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  // ── Loading spinner messages ──

  const CITY_VERBS = [
    'Mapping metro lines in',
    'Counting bus stops across',
    'Measuring cycle lanes in',
    'Analysing commute patterns for',
    'Checking air quality in',
    'Scanning traffic congestion in',
    'Computing walkability scores for',
    'Tracing ride corridors through',
    'Grading transport quality in',
    'Surveying rail networks in',
    'Tallying active commuters in',
    'Benchmarking infrastructure for'
  ];

  const GENERIC_VERBS = [
    'Crunching the numbers...',
    'Fetching transport data...',
    'Assembling the scorecard...',
    'Ranking cities...',
    'Loading intelligence...'
  ];

  // Extract city name from destination URL if navigating to /city/{id}
  const loadingMessage = $derived.by(() => {
    const nav = $navigating;
    if (!nav?.to?.url) return GENERIC_VERBS[Math.floor(Math.random() * GENERIC_VERBS.length)];

    const match = nav.to.url.pathname.match(/^\/city\/([^/]+)/);
    if (match) {
      const city = CITIES.find(c => c.id === match[1]);
      if (city) {
        const verb = CITY_VERBS[Math.floor(Math.random() * CITY_VERBS.length)];
        return `${verb} ${city.name}...`;
      }
    }

    if (nav.to.url.pathname === '/benchmark') return 'Preparing city comparison...';
    if (nav.to.url.pathname === '/data-sources') return 'Loading data provenance...';
    if (nav.to.url.pathname === '/') return 'Ranking cities...';

    return GENERIC_VERBS[Math.floor(Math.random() * GENERIC_VERBS.length)];
  });
</script>

{#if $navigating}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm">
    <div class="flex flex-col items-center gap-3">
      <i class="fa-solid fa-spinner fa-spin text-3xl text-altmo-700"></i>
      <p class="text-sm font-medium text-text-secondary">{loadingMessage}</p>
    </div>
  </div>
{/if}

<div class="flex min-h-screen flex-col">
  <Nav />

  <main class="flex-1">
    {@render children()}
  </main>

  <footer class="bg-altmo-900 text-white/80">
    <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 gap-8 sm:grid-cols-3">
        <!-- Brand column -->
        <div>
          <a href="/" class="inline-flex flex-col items-start">
            <img src="/altmo-logo-white.png" alt="Altmo" class="h-7" />
            <span class="mt-0.5 w-full text-center text-[0.55rem] font-light tracking-[0.45em] uppercase text-white/50">Intelligence</span>
          </a>
          <p class="mt-3 text-sm text-white/60 leading-relaxed">
            Open data and public accountability for active mobility in Indian cities.
          </p>
        </div>

        <!-- Altmo ecosystem -->
        <div>
          <h4 class="text-xs font-semibold uppercase tracking-wider text-altmo-200">Altmo Ecosystem</h4>
          <ul class="mt-3 space-y-2">
            <li>
              <a href="https://altmo.app" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-sm text-white/60 hover:text-altmo-200 transition-colors">
                <i class="fa-solid fa-mobile-screen-button w-4 text-center text-xs"></i> Altmo App
                <span class="text-[0.6rem] text-white/40">Track rides & walks</span>
              </a>
            </li>
            <li>
              <a href="https://cbs-two.vercel.app" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-sm text-white/60 hover:text-altmo-200 transition-colors">
                <i class="fa-solid fa-bicycle w-4 text-center text-xs"></i> Altmo Rentals
                <span class="text-[0.6rem] text-white/40">Owners marketplace</span>
              </a>
            </li>
            <li>
              <a href="https://altmo.app/corporates" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-sm text-white/60 hover:text-altmo-200 transition-colors">
                <i class="fa-solid fa-building w-4 text-center text-xs"></i> Altmo Enterprise
                <span class="text-[0.6rem] text-white/40">Corporate programmes</span>
              </a>
            </li>
            <li>
              <a href="https://rewards.altmo.app" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-sm text-white/60 hover:text-altmo-200 transition-colors">
                <i class="fa-solid fa-gift w-4 text-center text-xs"></i> Altmo Rewards
                <span class="text-[0.6rem] text-white/40">Coming soon</span>
              </a>
            </li>
          </ul>
        </div>

        <!-- Social -->
        <div>
          <h4 class="text-xs font-semibold uppercase tracking-wider text-altmo-200">Follow Altmo</h4>
          <div class="mt-3 flex items-center gap-3">
            <a href="https://instagram.com/altmo.app" target="_blank" rel="noopener noreferrer" class="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-altmo-700 hover:text-white transition-colors" aria-label="Instagram">
              <i class="fa-brands fa-instagram text-lg"></i>
            </a>
            <a href="https://x.com/AltMoApp" target="_blank" rel="noopener noreferrer" class="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-altmo-700 hover:text-white transition-colors" aria-label="X (Twitter)">
              <i class="fa-brands fa-x-twitter text-lg"></i>
            </a>
            <a href="https://linkedin.com/company/altmo" target="_blank" rel="noopener noreferrer" class="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-altmo-700 hover:text-white transition-colors" aria-label="LinkedIn">
              <i class="fa-brands fa-linkedin-in text-lg"></i>
            </a>
            <a href="https://www.facebook.com/profile.php?id=61563989945238" target="_blank" rel="noopener noreferrer" class="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-altmo-700 hover:text-white transition-colors" aria-label="Facebook">
              <i class="fa-brands fa-facebook-f text-lg"></i>
            </a>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <a href="https://play.google.com/store/apps/details?id=app.altmo.altmo" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white/70 hover:bg-altmo-700 hover:text-white transition-colors">
              <i class="fa-brands fa-google-play"></i> Google Play
            </a>
            <a href="https://apps.apple.com/app/altmo/id1588575321" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white/70 hover:bg-altmo-700 hover:text-white transition-colors">
              <i class="fa-brands fa-apple"></i> App Store
            </a>
          </div>
        </div>
      </div>

      <!-- Bottom bar -->
      <div class="mt-8 border-t border-white/10 pt-6 flex flex-col items-center gap-3">
        <p class="text-xs text-white/40">
          &copy; {new Date().getFullYear()} Altmo. Platform, analytics engine, and data integrations are proprietary.
        </p>
        <p class="text-xs text-white/30 text-center leading-relaxed max-w-2xl">
          ETQOLI scoring framework based on Allirani &amp; Verma (IISc, 2025).
          Data sourced under open licenses: OpenStreetMap (ODbL), OpenAQ (CC BY 4.0), TransitRouter (MIT), CPCB/NCRB/Census (Government of India Open Data).
          Source data retains its original license. <a href="/data-sources" class="underline hover:text-white/50">View all sources</a>.
        </p>
      </div>
    </div>
  </footer>
</div>
