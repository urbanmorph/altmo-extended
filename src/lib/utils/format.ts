export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/** Format Indian Rupees in compact form (Cr/L) */
export function formatINR(value: number): string {
  if (value >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(1)} Cr`;
  if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(1)} L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(1)}K`;
  return `₹${Math.round(value)}`;
}

/** Format weight in kg or tonnes (auto-scales) */
export function formatWeight(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  if (kg >= 10) return `${Math.round(kg)} kg`;
  return `${kg.toFixed(1)} kg`;
}

/** Format large numbers in Indian notation (L/Cr) */
export function formatIndianCompact(value: number): string {
  if (value >= 1_00_00_000) return `${(value / 1_00_00_000).toFixed(1)} Cr`;
  if (value >= 1_00_000) return `${(value / 1_00_000).toFixed(1)} L`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${Math.round(value)}`;
}

/** Format hours — auto-scales to days when >= 24 */
export function formatHours(hours: number): string {
  if (hours >= 24) {
    const days = hours / 24;
    return days >= 10 ? `${formatIndianCompact(Math.round(days))} days` : `${days.toFixed(1)} days`;
  }
  return `${hours.toFixed(1)} hrs`;
}
