/**
 * Per-city data layer availability.
 * Shows governments what they gain by publishing open data.
 * Changes only when we add new data sources.
 */

export type DataStatus = 'available' | 'partial' | 'unavailable';

export interface DataLayer {
	key: string;
	label: string;
	description: string;
}

export interface CityDataReadiness {
	cityId: string;
	layers: Record<string, DataStatus>;
}

export const DATA_LAYERS: DataLayer[] = [
	{ key: 'altmo_traces', label: 'Altmo Traces', description: 'Walking and cycling activity data from Altmo platform' },
	{ key: 'bus_stops', label: 'Bus Stops & Routes', description: 'BMTC/city bus stop locations and route network' },
	{ key: 'metro_stations', label: 'Metro Stations', description: 'Metro/rail station locations and line geometry' },
	{ key: 'metro_frequency', label: 'Metro Frequency', description: 'Service frequency and timetable data' },
	{ key: 'metro_ridership', label: 'Metro Ridership', description: 'Station-level entry/exit counts' },
	{ key: 'bus_frequency', label: 'Bus Frequency', description: 'Bus service frequency data' },
	{ key: 'walking_infra', label: 'Walking Infrastructure', description: 'Footpath, TenderSURE, and pedestrian facility data' },
	{ key: 'cycling_infra', label: 'Cycling Infrastructure', description: 'Cycle lanes, bike parking, PBS data' },
	{ key: 'safety_data', label: 'Safety / Accident Data', description: 'Pedestrian and cyclist crash statistics' },
	{ key: 'air_quality', label: 'Air Quality', description: 'CPCB/SAFAR monitoring station data' }
];

export const CITY_READINESS: CityDataReadiness[] = [
	{
		cityId: 'bengaluru',
		layers: {
			altmo_traces: 'available',
			bus_stops: 'available',
			metro_stations: 'available',
			metro_frequency: 'available',
			metro_ridership: 'available',
			bus_frequency: 'available',
			walking_infra: 'partial',
			cycling_infra: 'partial',
			safety_data: 'available',
			air_quality: 'available'
		}
	},
	{
		cityId: 'chennai',
		layers: {
			altmo_traces: 'partial',
			bus_stops: 'available',
			metro_stations: 'partial',
			metro_frequency: 'partial',
			metro_ridership: 'unavailable',
			bus_frequency: 'available',
			walking_infra: 'unavailable',
			cycling_infra: 'unavailable',
			safety_data: 'partial',
			air_quality: 'available'
		}
	},
	{
		cityId: 'delhi',
		layers: {
			altmo_traces: 'partial',
			bus_stops: 'available',
			metro_stations: 'partial',
			metro_frequency: 'partial',
			metro_ridership: 'unavailable',
			bus_frequency: 'available',
			walking_infra: 'unavailable',
			cycling_infra: 'unavailable',
			safety_data: 'partial',
			air_quality: 'available'
		}
	},
	{
		cityId: 'hyderabad',
		layers: {
			altmo_traces: 'partial',
			bus_stops: 'available',
			metro_stations: 'available',
			metro_frequency: 'available',
			metro_ridership: 'unavailable',
			bus_frequency: 'available',
			walking_infra: 'unavailable',
			cycling_infra: 'unavailable',
			safety_data: 'partial',
			air_quality: 'available'
		}
	},
	{
		cityId: 'indore',
		layers: {
			altmo_traces: 'partial',
			bus_stops: 'available',
			metro_stations: 'unavailable',
			metro_frequency: 'unavailable',
			metro_ridership: 'unavailable',
			bus_frequency: 'partial',
			walking_infra: 'unavailable',
			cycling_infra: 'unavailable',
			safety_data: 'unavailable',
			air_quality: 'partial'
		}
	},
	{
		cityId: 'kochi',
		layers: {
			altmo_traces: 'partial',
			bus_stops: 'available',
			metro_stations: 'available',
			metro_frequency: 'available',
			metro_ridership: 'unavailable',
			bus_frequency: 'available',
			walking_infra: 'unavailable',
			cycling_infra: 'unavailable',
			safety_data: 'unavailable',
			air_quality: 'partial'
		}
	},
	{
		cityId: 'pune',
		layers: {
			altmo_traces: 'partial',
			bus_stops: 'available',
			metro_stations: 'unavailable',
			metro_frequency: 'unavailable',
			metro_ridership: 'unavailable',
			bus_frequency: 'available',
			walking_infra: 'unavailable',
			cycling_infra: 'unavailable',
			safety_data: 'unavailable',
			air_quality: 'available'
		}
	}
];

export function getReadiness(cityId: string): CityDataReadiness | undefined {
	return CITY_READINESS.find((r) => r.cityId === cityId);
}

// --- Weighted scoring ---

export interface ScoreCategory {
	key: string;
	label: string;
	layers: string[];
	weightPerLayer: number;
}

export const SCORE_CATEGORIES: ScoreCategory[] = [
	{ key: 'core', label: 'Core Transit', layers: ['altmo_traces', 'bus_stops', 'metro_stations'], weightPerLayer: 15 },
	{ key: 'infra', label: 'Infrastructure', layers: ['walking_infra', 'cycling_infra'], weightPerLayer: 15 },
	{ key: 'freq', label: 'Frequency & Ridership', layers: ['metro_frequency', 'bus_frequency', 'metro_ridership'], weightPerLayer: 5 },
	{ key: 'context', label: 'Contextual', layers: ['safety_data', 'air_quality'], weightPerLayer: 5 }
];

const STATUS_MULTIPLIER: Record<DataStatus, number> = {
	available: 1.0,
	partial: 0.5,
	unavailable: 0.0
};

export interface CategoryScore {
	key: string;
	label: string;
	score: number;
	max: number;
}

export interface ReadinessScore {
	cityId: string;
	total: number;
	maxScore: number;
	categories: CategoryScore[];
}

export function computeReadinessScore(cityId: string): ReadinessScore | undefined {
	const readiness = getReadiness(cityId);
	if (!readiness) return undefined;

	const categories: CategoryScore[] = SCORE_CATEGORIES.map((cat) => {
		const max = cat.layers.length * cat.weightPerLayer;
		const score = cat.layers.reduce((sum, layerKey) => {
			const status = readiness.layers[layerKey] ?? 'unavailable';
			return sum + cat.weightPerLayer * STATUS_MULTIPLIER[status];
		}, 0);
		return { key: cat.key, label: cat.label, score, max };
	});

	const total = categories.reduce((sum, c) => sum + c.score, 0);
	const maxScore = categories.reduce((sum, c) => sum + c.max, 0);

	return { cityId, total, maxScore, categories };
}

export function computeAllScores(): ReadinessScore[] {
	return CITY_READINESS
		.map((r) => computeReadinessScore(r.cityId)!)
		.sort((a, b) => b.total - a.total);
}
