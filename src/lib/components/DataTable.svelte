<script lang="ts">
  interface Props {
    columns: { key: string; label: string; align?: 'left' | 'right' | 'center' }[];
    rows: Record<string, unknown>[];
  }

  let { columns, rows }: Props = $props();
</script>

<div class="overflow-x-auto rounded-xl border border-border">
  <table class="w-full text-sm">
    <thead>
      <tr class="border-b border-border bg-earth-50">
        {#each columns as col}
          <th class="px-4 py-3 text-{col.align ?? 'left'} font-medium text-text-secondary">
            {col.label}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row, i}
        <tr class="border-b border-border last:border-0 {i % 2 === 0 ? 'bg-surface-card' : 'bg-earth-50/50'}">
          {#each columns as col}
            <td class="px-4 py-3 text-{col.align ?? 'left'} text-text-primary">
              {row[col.key] ?? '—'}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
