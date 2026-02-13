import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { railsApi } from '$lib/rails-api';
import { createClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';

interface CompanyEntry {
	id: number;
	name: string;
	activities: number;
	distance: number;
	emp_count: number;
	facilities: number[];
}

interface FacilityEntry {
	id: number;
	name: string;
	approved: boolean;
	activities: number;
	distance: number;
	emp_count: number;
	city: string;
	city_id: number;
	latlngs: [number, number];
}

export const GET: RequestHandler = async ({ request }) => {
	const authHeader = request.headers.get('authorization');
	if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const supabaseAdmin = createClient(publicEnv.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

	try {
		// New Rails app returns bare arrays (not wrapped in { companies: [...] })
		const [companiesArr, facilitiesArr] = await Promise.all([
			railsApi<CompanyEntry[]>('/api/v1/companies'),
			railsApi<FacilityEntry[]>('/api/v1/facilities')
		]);

		const results = { companies: 0, facilities: 0 };

		if (companiesArr?.length) {
			const rows = companiesArr.map((c) => ({
				id: c.id,
				name: c.name,
				activities: c.activities,
				distance: c.distance,
				emp_count: c.emp_count,
				facilities: c.facilities,
				synced_at: new Date().toISOString()
			}));
			const { error } = await supabaseAdmin
				.from('companies')
				.upsert(rows, { onConflict: 'id' });
			if (error) throw error;
			results.companies = companiesArr.length;
		}

		if (facilitiesArr?.length) {
			const rows = facilitiesArr.map((f) => ({
				id: f.id,
				name: f.name,
				approved: f.approved,
				activities: f.activities,
				distance: f.distance,
				emp_count: f.emp_count,
				city: f.city,
				city_id: f.city_id,
				latlngs: f.latlngs,
				synced_at: new Date().toISOString()
			}));
			const { error } = await supabaseAdmin
				.from('facilities')
				.upsert(rows, { onConflict: 'id' });
			if (error) throw error;
			results.facilities = facilitiesArr.length;
		}

		return json({ success: true, synced: results });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};
