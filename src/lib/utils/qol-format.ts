/**
 * Shared QoL formatting helpers.
 * Avoids duplication across QoLScorecard, QoLRankedList, BenchmarkTable, etc.
 */

import { CITIES } from '$lib/config/cities';
import { GRADE_BOUNDARIES, type ConfidenceTier, type ConfidenceBreakdown } from '$lib/config/city-qol-data';

export function cityName(cityId: string): string {
	return CITIES.find((c) => c.id === cityId)?.name ?? cityId;
}

/** Returns the member cities subtitle for a region, or null for standalone cities. */
export function cityRegionSubtitle(cityId: string): string | null {
	return CITIES.find((c) => c.id === cityId)?.regionCities ?? null;
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

/**
 * Compute how many points (on a 0-100 scale) a city needs to reach the next grade.
 * Returns null if already at grade A.
 */
export function gapToNextGrade(composite: number): { grade: string; pointsNeeded: number } | null {
	// GRADE_BOUNDARIES are sorted descending: A, B, C, D, E
	for (const b of GRADE_BOUNDARIES) {
		if (composite >= b.min) {
			// Find the boundary above this one
			const idx = GRADE_BOUNDARIES.indexOf(b);
			if (idx === 0) return null; // Already A
			const nextBoundary = GRADE_BOUNDARIES[idx - 1];
			const pointsNeeded = Math.ceil(nextBoundary.min * 100 - composite * 100);
			return { grade: nextBoundary.grade, pointsNeeded: Math.max(1, pointsNeeded) };
		}
	}
	// Below E — need to reach D
	return { grade: 'D', pointsNeeded: Math.ceil(0.30 * 100 - composite * 100) };
}

export function dimensionRankLabel(rank: number, total: number): string {
	if (rank === 1) return 'Best';
	if (rank === total) return 'Worst';
	const suffix = rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
	return `${rank}${suffix}`;
}

// ---- Confidence badge helpers ----

export function confidenceIcon(tier: ConfidenceTier): string {
	if (tier === 'gold') return 'fa-solid fa-certificate';
	if (tier === 'silver') return 'fa-solid fa-certificate';
	return 'fa-solid fa-circle-half-stroke';
}

export function confidenceColor(tier: ConfidenceTier): string {
	if (tier === 'gold') return '#D4AF37';
	if (tier === 'silver') return '#9CA3AF';
	return '#CD7F32';
}

export function confidenceLabel(tier: ConfidenceTier): string {
	if (tier === 'gold') return 'Gold';
	if (tier === 'silver') return 'Silver';
	return 'Bronze';
}

export function confidenceTooltipLines(breakdown: ConfidenceBreakdown): { label: string; score: number }[] {
	return [
		{ label: 'Indicator coverage', score: breakdown.factors.indicatorCoverage },
		{ label: 'Live data freshness', score: breakdown.factors.liveDataFreshness },
		{ label: 'Sensor coverage', score: breakdown.factors.sensorCoverage },
		{ label: 'Transit data quality', score: breakdown.factors.transitDataQuality },
		{ label: 'Data readiness', score: breakdown.factors.dataReadiness },
		{ label: 'Altmo traces', score: breakdown.factors.altmoTraces }
	];
}
