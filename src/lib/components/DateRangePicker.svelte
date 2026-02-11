<script lang="ts">
  import { dateRange } from '$lib/stores/dateRange';

  let start = $state('');
  let end = $state('');

  dateRange.subscribe(range => {
    start = range.start.toISOString().split('T')[0];
    end = range.end.toISOString().split('T')[0];
  });

  function handleStartChange(event: Event) {
    const target = event.target as HTMLInputElement;
    dateRange.update(r => ({ ...r, start: new Date(target.value) }));
  }

  function handleEndChange(event: Event) {
    const target = event.target as HTMLInputElement;
    dateRange.update(r => ({ ...r, end: new Date(target.value) }));
  }
</script>

<div class="flex items-center gap-2 text-sm">
  <input
    type="date"
    value={start}
    onchange={handleStartChange}
    class="rounded-md border border-border bg-surface-card px-2 py-1 text-text-primary"
  />
  <span class="text-text-secondary">to</span>
  <input
    type="date"
    value={end}
    onchange={handleEndChange}
    class="rounded-md border border-border bg-surface-card px-2 py-1 text-text-primary"
  />
</div>
