/**
 * Shared QoL formatting helpers.
 * Avoids duplication across QoLScorecard, QoLRankedList, etc.
 */

import { CITIES } from '$lib/config/cities';

export function cityName(cityId: string): string {
	return CITIES.find((c) => c.id === cityId)?.name ?? cityId;
}

export function fmtIndicatorValue(value: number | null, unit: string): string {
	if (value === null) return '—';
	if (Number.isInteger(value)) return `${value} ${unit}`;
	return `${value.toFixed(1)} ${unit}`;
}

export function barPercent(score: number, max: number = 1): number {
	if (max <= 0) return 0;
	return Math.max(0, Math.min(100, (score / max) * 100));
}

export function dimensionColor(score: number): string {
	if (score >= 0.60) return 'var(--color-altmo-500)';
	if (score >= 0.30) return 'var(--color-tangerine-300)';
	return 'var(--color-tangerine-500)';
}

export function readinessScoreColor(total: number): string {
	if (total >= 70) return 'var(--color-status-available)';
	if (total >= 40) return 'var(--color-status-partial)';
	return 'var(--color-status-unavailable)';
}
