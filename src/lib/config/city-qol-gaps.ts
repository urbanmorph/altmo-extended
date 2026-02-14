/**
 * Gap analysis engine: identifies worst QoL dimension/indicator per city
 * and pairs it with actionable recommendations.
 */

import { computeCityQoL, computeAllQoL, type CityQoLScore, type QoLOverrides } from './city-qol-data';
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
	ahmedabad: {
		gapSentence: 'PM2.5 at 55 \u00B5g/m\u00B3 is 3.7x the WHO guideline \u2014 industrial pollution dominates (63%) and bus fleet at 23 per lakh limits transit access',
		recommendation: 'Completing Metro Phase 2 to 68 km + scaling AMTS fleet to 40 per lakh would lift accessibility from D to C',
		dataUnlockSentence: 'Publishing AMTS GTFS feeds and walking infrastructure data enables corridor-level access analysis'
	},
	delhi: {
		gapSentence: 'PM2.5 at 99 \u00B5g/m\u00B3 is 6.6x the WHO guideline',
		recommendation: 'Fleet electrification + congestion pricing could cut transport PM2.5 by 30%',
		dataUnlockSentence: 'Publishing walking/cycling infrastructure data enables corridor-level air quality impact analysis'
	},
	bengaluru: {
		gapSentence: 'Only 15 km of cycle tracks and 37% footpath coverage \u2014 active mobility infrastructure lags behind transit investment',
		recommendation: 'Dedicating 5% of arterial road width to protected cycle lanes would triple cycle infra and lift accessibility from D to C',
		dataUnlockSentence: 'Publishing walking/cycling infrastructure GIS data enables corridor-level gap analysis'
	},
	pune: {
		gapSentence: 'Bus fleet of 25 per lakh \u2014 less than half of Bengaluru\u2019s 53',
		recommendation: 'Doubling PMPML fleet with electric buses would lift accessibility from D to B',
		dataUnlockSentence: 'Publishing ridership, safety, and NMT infrastructure data enables full multi-modal analysis'
	},
	kochi: {
		gapSentence: 'Only 5 km of cycle infrastructure and metro at 29 km \u2014 compact city held back by NMT infrastructure gaps',
		recommendation: 'Building 50 km of protected cycle lanes + metro Phase 2 to 40 km would lift accessibility from D to C',
		dataUnlockSentence: 'Publishing safety and NMT infrastructure data unlocks health dimension scoring'
	},
	chennai: {
		gapSentence: 'Cycling share at just 4% and VRU fatality share at 43% — active mobility is unsafe and underused',
		recommendation: 'Protected cycle lanes on 15 arterials + pedestrian-priority zones could halve VRU fatalities',
		dataUnlockSentence: 'Publishing walking/cycling infrastructure data enables corridor-level safety analysis'
	},
	hyderabad: {
		gapSentence: 'Only 8 km of cycle infrastructure and bus fleet of 30 per lakh \u2014 strong rail transit (159 km) undermined by last-mile access gaps',
		recommendation: 'Building 100 km of protected cycle lanes + expanding TSRTC city fleet to 50 per lakh would lift accessibility from D to C',
		dataUnlockSentence: 'Publishing walking/cycling infrastructure data would enable complete active mobility assessment'
	},
	mumbai: {
		gapSentence: 'Bus fleet at just 22 per lakh and only 5 km of cycle infrastructure \u2014 accessibility undermined despite world-class suburban rail',
		recommendation: 'Expanding BEST fleet to 40 per lakh with electric buses and building 100 km of protected cycle lanes would lift accessibility from E to C',
		dataUnlockSentence: 'Publishing BEST GTFS feeds and walking infrastructure data enables corridor-level gap analysis'
	},
	indore: {
		gapSentence: 'Metro just 6 km and bus fleet of just 11 per lakh \u2014 lowest transit coverage',
		recommendation: 'Scaling AICTSL fleet to 30 per lakh and completing metro Phase 1 would triple transit accessibility',
		dataUnlockSentence: 'Publishing bus frequency and walking infrastructure data enables transit coverage gap analysis'
	}
};

/**
 * Compute gap analysis for a single city.
 * Finds the worst-scoring dimension and indicator programmatically,
 * then attaches the hand-crafted narrative.
 */
export function computeCityGap(cityId: string, overrides?: QoLOverrides): CityGapAnalysis | undefined {
	const qol = computeCityQoL(cityId, overrides);
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
export function computeAllGaps(overrides?: QoLOverrides): CityGapAnalysis[] {
	const allQoL = computeAllQoL(overrides);
	return allQoL
		.map((q) => computeCityGap(q.cityId, overrides))
		.filter((g): g is CityGapAnalysis => g !== undefined);
}
