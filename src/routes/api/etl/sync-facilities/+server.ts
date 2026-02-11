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
    const [companies, facilities] = await Promise.all([
      railsApi<{ companies: unknown[] }>('/api/v1/companies'),
      railsApi<{ facilities: unknown[] }>('/api/v1/facilities')
    ]);

    const results = { companies: 0, facilities: 0 };

    if (companies.companies?.length) {
      const { error } = await supabaseAdmin
        .from('companies')
        .upsert(companies.companies, { onConflict: 'external_id' });
      if (error) throw error;
      results.companies = companies.companies.length;
    }

    if (facilities.facilities?.length) {
      const { error } = await supabaseAdmin
        .from('facilities')
        .upsert(facilities.facilities, { onConflict: 'external_id' });
      if (error) throw error;
      results.facilities = facilities.facilities.length;
    }

    return json({ success: true, synced: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json({ error: message }, { status: 500 });
  }
};
