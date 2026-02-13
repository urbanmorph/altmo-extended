import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { railsApi } from '$lib/rails-api';
import { createClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';

interface BulkRoutesResponse {
	success: boolean;
	page: number;
	per_page: number;
	total_count: number;
	total_pages: number;
	routes: Record<string, unknown>[];
}

export const GET: RequestHandler = async ({ request, url }) => {
	const authHeader = request.headers.get('authorization');
	if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const supabaseAdmin = createClient(publicEnv.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

	try {
		// Default: sync last 90 days, overridable via ?days=N
		const days = parseInt(url.searchParams.get('days') ?? '90', 10);
		const endDate = new Date().toISOString().split('T')[0];
		const startDate = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0];

		const allRoutes: Record<string, unknown>[] = [];
		let page = 1;

		// Paginate through /api/v1/routes/bulk (IntelligenceController)
		while (true) {
			const resp = await railsApi<BulkRoutesResponse>(
				`/api/v1/routes/bulk?start_date=${startDate}&end_date=${endDate}&page=${page}&per_page=500`
			);

			if (resp.routes?.length) {
				allRoutes.push(
					...resp.routes.map((r) => ({ ...r, synced_at: new Date().toISOString() }))
				);
			}

			if (page >= resp.total_pages || !resp.routes?.length) break;
			page++;
		}

		if (allRoutes.length) {
			// Upsert in batches of 500 to avoid payload limits
			for (let i = 0; i < allRoutes.length; i += 500) {
				const batch = allRoutes.slice(i, i + 500);
				const { error } = await supabaseAdmin
					.from('activity_routes')
					.upsert(batch, { onConflict: 'activity_id' });
				if (error) throw error;
			}
		}

		return json({
			success: true,
			synced: allRoutes.length,
			pages_fetched: page,
			date_range: { start: startDate, end: endDate }
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};
