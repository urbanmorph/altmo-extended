<script lang="ts">
  import type { ActionGuide, ActionRole } from '$lib/config/action-guides';
  import { getActionsForRole } from '$lib/config/action-guides';

  interface Props {
    actions: ActionGuide[];
  }

  let { actions }: Props = $props();

  let activeRole: ActionRole = $state('everyone');

  const ROLE_TABS: { role: ActionRole; label: string; icon: string }[] = [
    { role: 'everyone', label: 'Everyone', icon: 'fa-solid fa-users' },
    { role: 'citizen', label: 'Citizen', icon: 'fa-solid fa-user' },
    { role: 'corporate', label: 'Corporate', icon: 'fa-solid fa-building' },
    { role: 'planner', label: 'Planner', icon: 'fa-solid fa-compass-drafting' }
  ];

  const filteredActions = $derived(getActionsForRole(actions, activeRole));
</script>

<section id="action" class="scroll-mt-16">
  <h2 class="mb-6 text-xl font-bold text-text-primary">
    <i class="fa-solid fa-bolt mr-2 text-tangerine-500"></i>
    Take Action
  </h2>

  <!-- Role tabs -->
  <div class="mb-6 flex flex-wrap gap-2">
    {#each ROLE_TABS as tab}
      <button
        class="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors
          {activeRole === tab.role
            ? 'bg-altmo-700 text-white'
            : 'border border-border bg-surface-card text-text-secondary hover:bg-earth-50 hover:text-text-primary'}"
        onclick={() => (activeRole = tab.role)}
      >
        <i class="{tab.icon}"></i>
        {tab.label}
      </button>
    {/each}
  </div>

  <!-- Action cards -->
  {#if filteredActions.length > 0}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each filteredActions as action}
        <div class="flex flex-col rounded-xl border border-border bg-surface-card p-5 shadow-sm">
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-altmo-50 text-altmo-700">
              <i class="{action.icon}"></i>
            </div>
            <div class="flex-1">
              <h3 class="text-sm font-semibold text-text-primary">{action.label}</h3>
              <p class="mt-1 text-xs text-text-secondary leading-relaxed">{action.description}</p>
            </div>
          </div>
          {#if action.url}
            <div class="mt-4 flex justify-end">
              <a
                href={action.url}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 rounded-md bg-altmo-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-altmo-800"
              >
                <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                Learn more
              </a>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="rounded-xl border border-border bg-surface-card p-8 text-center">
      <i class="fa-solid fa-hand-holding-heart text-3xl text-text-secondary"></i>
      <p class="mt-2 text-text-secondary">No actions available for the selected role.</p>
    </div>
  {/if}
</section>
