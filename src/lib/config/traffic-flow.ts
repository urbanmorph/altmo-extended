/**
 * TomTom Traffic Flow configuration: sample arterial points per city.
 * Each city has 5-8 major road/junction coordinates for representative congestion sampling.
 * Shared between server and client code.
 */

export interface TrafficSamplePoint {
	lat: number;
	lng: number;
	label: string;
}

export interface CityTrafficConfig {
	name: string;
	samplePoints: TrafficSamplePoint[];
}

export const CITY_TRAFFIC_POINTS: Record<string, CityTrafficConfig> = {
	ahmedabad: {
		name: 'Ahmedabad',
		samplePoints: [
			{ lat: 23.0225, lng: 72.5714, label: 'Lal Darwaja / Old City' },
			{ lat: 23.0276, lng: 72.5071, label: 'SG Highway / Bodakdev' },
			{ lat: 23.0469, lng: 72.5313, label: 'Ashram Road / Nehru Bridge' },
			{ lat: 22.9973, lng: 72.6003, label: 'Naroda' },
			{ lat: 23.0733, lng: 72.5170, label: 'Sabarmati / Gandhinagar Highway' },
			{ lat: 23.0120, lng: 72.5136, label: 'Satellite / Jodhpur' }
		]
	},
	bengaluru: {
		name: 'Bengaluru',
		samplePoints: [
			{ lat: 12.9716, lng: 77.5946, label: 'Majestic / City Centre' },
			{ lat: 12.9352, lng: 77.6245, label: 'Silk Board Junction' },
			{ lat: 12.9975, lng: 77.5968, label: 'Hebbal Flyover' },
			{ lat: 12.9344, lng: 77.5802, label: 'Banashankari' },
			{ lat: 12.9563, lng: 77.7006, label: 'Marathahalli' },
			{ lat: 13.0358, lng: 77.5970, label: 'Yelahanka' }
		]
	},
	chennai: {
		name: 'Chennai',
		samplePoints: [
			{ lat: 13.0604, lng: 80.2496, label: 'Anna Salai / Mount Road' },
			{ lat: 12.9387, lng: 80.2290, label: 'OMR Thoraipakkam' },
			{ lat: 13.0127, lng: 80.1973, label: 'Kathipara Junction' },
			{ lat: 13.0418, lng: 80.2341, label: 'T Nagar' },
			{ lat: 13.0067, lng: 80.2206, label: 'Guindy' },
			{ lat: 13.0012, lng: 80.2565, label: 'Adyar' }
		]
	},
	delhi: {
		name: 'Delhi',
		samplePoints: [
			{ lat: 28.6289, lng: 77.2413, label: 'ITO' },
			{ lat: 28.5672, lng: 77.2100, label: 'AIIMS' },
			{ lat: 28.5921, lng: 77.1663, label: 'Dhaula Kuan' },
			{ lat: 28.6679, lng: 77.2273, label: 'Kashmere Gate' },
			{ lat: 28.5800, lng: 77.2688, label: 'Ashram Chowk' },
			{ lat: 28.6328, lng: 77.2197, label: 'Rajiv Chowk' }
		]
	},
	hyderabad: {
		name: 'Hyderabad',
		samplePoints: [
			{ lat: 17.3950, lng: 78.4422, label: 'Mehdipatnam' },
			{ lat: 17.4435, lng: 78.3772, label: 'HITEC City' },
			{ lat: 17.3457, lng: 78.5522, label: 'LB Nagar' },
			{ lat: 17.4399, lng: 78.4983, label: 'Secunderabad' },
			{ lat: 17.4375, lng: 78.4482, label: 'Ameerpet' },
			{ lat: 17.4849, lng: 78.3827, label: 'Kukatpally' }
		]
	},
	indore: {
		name: 'Indore',
		samplePoints: [
			{ lat: 22.7196, lng: 75.8577, label: 'Rajwada' },
			{ lat: 22.7533, lng: 75.8937, label: 'Vijay Nagar' },
			{ lat: 22.7236, lng: 75.8817, label: 'Palasia' },
			{ lat: 22.7440, lng: 75.8298, label: 'MR 10' },
			{ lat: 22.7197, lng: 75.8654, label: 'AB Road / Geeta Bhawan' }
		]
	},
	kochi: {
		name: 'Kochi',
		samplePoints: [
			{ lat: 9.9816, lng: 76.2999, label: 'MG Road' },
			{ lat: 10.0261, lng: 76.3125, label: 'Edappally' },
			{ lat: 9.9674, lng: 76.3204, label: 'Vytilla' },
			{ lat: 9.9943, lng: 76.2913, label: 'Kaloor' },
			{ lat: 10.1004, lng: 76.3570, label: 'Aluva' }
		]
	},
	mumbai: {
		name: 'Mumbai',
		samplePoints: [
			{ lat: 19.076, lng: 72.8777, label: 'CST / Fort (City Centre)' },
			{ lat: 19.1136, lng: 72.8697, label: 'Dadar (Central Junction)' },
			{ lat: 19.0633, lng: 72.8502, label: 'Haji Ali / Worli Sea Link' },
			{ lat: 19.1197, lng: 72.8464, label: 'Sion Junction' },
			{ lat: 19.1368, lng: 72.837, label: 'Andheri (Western Express Highway)' },
			{ lat: 19.2183, lng: 72.8459, label: 'Borivali (Western Suburb)' },
			{ lat: 19.0427, lng: 73.0286, label: 'Vashi / Sion-Panvel Highway' },
			{ lat: 19.1867, lng: 72.9511, label: 'Mulund (Eastern Express Highway)' }
		]
	},
	pune: {
		name: 'Pune',
		samplePoints: [
			{ lat: 18.5018, lng: 73.8636, label: 'Swargate' },
			{ lat: 18.5912, lng: 73.7390, label: 'Hinjewadi' },
			{ lat: 18.5308, lng: 73.8475, label: 'Shivajinagar' },
			{ lat: 18.5074, lng: 73.8077, label: 'Kothrud' },
			{ lat: 18.5089, lng: 73.9260, label: 'Hadapsar' },
			{ lat: 18.5989, lng: 73.7604, label: 'Wakad' }
		]
	}
};

export interface CongestionData {
	congestionPct: number;    // % extra travel time (matches congestion_level indicator)
	avgCurrentSpeed: number;  // km/h
	avgFreeFlowSpeed: number; // km/h
	pointsReporting: number;  // how many sample points returned data
}
