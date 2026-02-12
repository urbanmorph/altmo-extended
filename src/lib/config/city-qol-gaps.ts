/**
 * Gap analysis engine: identifies worst QoL dimension/indicator per city
 * and pairs it with actionable recommendations.
 */

import { computeCityQoL, computeAllQoL, type CityQoLScore } from './city-qol-data';
import { getReadiness, computeReadinessScore, DATA_LAYERS, type DataStatus } from './data-readiness';

export interface CityGapAnalysis {
	cityId: string;
	worstDimension: string;
	worstIndicator: string;
	gapSentence: string;
	recommendation: string;
	dataUnlockSentence: string;
}

/** Hand-crafted gap narratives derived from indicator data + TQOLI plan. */
const GAP_DATA: Record<string, Omit<CityGapAnalysis, 'cityId' | 'worstDimension' | 'worstIndicator'>> = {
	delhi: {
		gapSentence: 'PM2.5 at 99 \u00B5g/m\u00B3 is 6.6x the WHO guideline',
		recommendation: 'Fleet electrification + congestion pricing could cut transport PM2.5 by 30%',
		dataUnlockSentence: 'Publishing walking/cycling infrastructure data enables corridor-level air quality impact analysis'
	},
	bengaluru: {
		gapSentence: 'Congestion adds 51% extra travel time \u2014 worst of 7 cities',
		recommendation: 'Bus priority corridors on 10 arterials would reduce congestion by 15%',
		dataUnlockSentence: 'Complete walking infrastructure data unlocks pedestrian accessibility scoring'
	},
	pune: {
		gapSentence: 'Bus fleet of 25 per lakh \u2014 less than half of Bengaluru\u2019s 53',
		recommendation: 'Doubling PMPML fleet with electric buses would lift accessibility from D to B',
		dataUnlockSentence: 'Publishing ridership, safety, and NMT infrastructure data enables full multi-modal analysis'
	},
	kochi: {
		gapSentence: 'Metro network at 25.6 km \u2014 second smallest of 7 cities',
		recommendation: 'Phase 2 expansion to 40 km improves accessibility score by 35%',
		dataUnlockSentence: 'Publishing safety and NMT infrastructure data unlocks health dimension scoring'
	},
	chennai: {
		gapSentence: 'Metro network at 54.6 km covers only 14% of the target — accessibility bottleneck',
		recommendation: 'Phase 2 expansion to 120 km would lift accessibility from D to C range',
		dataUnlockSentence: 'Publishing metro ridership and NMT data enables full transit performance analysis'
	},
	hyderabad: {
		gapSentence: 'Metro at 69 km but bus fleet of only 30 per lakh limits last-mile access',
		recommendation: 'Expanding TSRTC city fleet to 50 per lakh with feeder routes to metro would lift accessibility from D to C',
		dataUnlockSentence: 'Publishing walking/cycling infrastructure data would enable complete active mobility assessment'
	},
	indore: {
		gapSentence: 'No operational metro and bus fleet of just 11 per lakh \u2014 lowest transit coverage',
		recommendation: 'Scaling AICTSL fleet to 30 per lakh and completing metro Phase 1 would triple transit accessibility',
		dataUnlockSentence: 'Publishing bus frequency and walking infrastructure data enables transit coverage gap analysis'
	}
};

/**
 * Compute gap analysis for a single city.
 * Finds the worst-scoring dimension and indicator programmatically,
 * then attaches the hand-crafted narrative.
 */
export function computeCityGap(cityId: string): CityGapAnalysis | undefined {
	const qol = computeCityQoL(cityId);
	if (!qol) return undefined;

	// Find worst dimension (lowest score)
	const worstDim = qol.dimensions.reduce((a, b) => (a.score < b.score ? a : b));

	// Find worst indicator within that dimension
	const worstInd = worstDim.indicators.reduce((a, b) => {
		const aScore = a.normalized ?? 1;
		const bScore = b.normalized ?? 1;
		return aScore < bScore ? a : b;
	});

	const narrative = GAP_DATA[cityId];
	if (!narrative) return undefined;

	return {
		cityId,
		worstDimension: worstDim.label,
		worstIndicator: worstInd.label,
		...narrative
	};
}

/**
 * Compute gap analysis for all cities, sorted by QoL rank (highest composite first).
 */
export function computeAllGaps(): CityGapAnalysis[] {
	const allQoL = computeAllQoL();
	return allQoL
		.map((q) => computeCityGap(q.cityId))
		.filter((g): g is CityGapAnalysis => g !== undefined);
}
