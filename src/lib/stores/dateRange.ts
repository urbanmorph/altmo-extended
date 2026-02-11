import { writable } from 'svelte/store';

export interface DateRange {
  start: Date;
  end: Date;
}

function getDefaultRange(): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { start, end };
}

export const dateRange = writable<DateRange>(getDefaultRange());
