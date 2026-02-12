import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';

interface SafetyCity {
	city_id: string;
	fatalities_per_lakh: number;
	total_fatalities?: number;
	population_lakhs?: number;
	pedestrian_fatalities?: number;
	cyclist_fatalities?: number;
	source?: string;
}

interface SafetyPayload {
	year: number;
	cities: SafetyCity[];
}

export const POST: RequestHandler = async ({ request }) => {
	const authHeader = request.headers.get('authorization');
	if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const supabaseAdmin = createClient(publicEnv.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

	try {
		const body = (await request.json()) as SafetyPayload;

		if (!body.year || !Array.isArray(body.cities) || body.cities.length === 0) {
			return json({ error: 'Invalid payload: need year and cities array' }, { status: 400 });
		}

		const rows = body.cities.map((c) => ({
			city_id: c.city_id,
			year: body.year,
			fatalities_per_lakh: c.fatalities_per_lakh,
			total_fatalities: c.total_fatalities ?? null,
			population_lakhs: c.population_lakhs ?? null,
			pedestrian_fatalities: c.pedestrian_fatalities ?? null,
			cyclist_fatalities: c.cyclist_fatalities ?? null,
			source: c.source ?? null
		}));

		const { error } = await supabaseAdmin
			.from('city_safety_annual')
			.upsert(rows, { onConflict: 'city_id,year' });

		if (error) {
			return json({ error: error.message }, { status: 500 });
		}

		return json({ success: true, upserted: rows.length, year: body.year });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};
