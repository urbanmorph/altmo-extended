import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { railsApi } from '$lib/rails-api';
import { createClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = createClient(publicEnv.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const [leaderboards, cityStats] = await Promise.all([
      railsApi<{ leaderboards: unknown[] }>('/api/v1/leaderboards'),
      railsApi<{ stats: unknown[] }>('/api/v1/city_stats')
    ]);

    const results = { leaderboards: 0, cityStats: 0 };

    if (leaderboards.leaderboards?.length) {
      const { error } = await supabaseAdmin
        .from('leaderboards')
        .upsert(leaderboards.leaderboards, { onConflict: 'external_id' });
      if (error) throw error;
      results.leaderboards = leaderboards.leaderboards.length;
    }

    if (cityStats.stats?.length) {
      const { error } = await supabaseAdmin
        .from('city_stats')
        .upsert(cityStats.stats, { onConflict: 'city_id,period' });
      if (error) throw error;
      results.cityStats = cityStats.stats.length;
    }

    return json({ success: true, synced: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json({ error: message }, { status: 500 });
  }
};
