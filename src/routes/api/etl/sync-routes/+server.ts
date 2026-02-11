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
    const routes = await railsApi<{ routes: unknown[] }>('/api/v1/activity_routes');

    if (routes.routes?.length) {
      const { error } = await supabaseAdmin
        .from('activity_routes')
        .upsert(routes.routes, { onConflict: 'external_id' });

      if (error) throw error;
    }

    return json({ success: true, synced: routes.routes?.length ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json({ error: message }, { status: 500 });
  }
};
