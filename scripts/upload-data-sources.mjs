/**
 * Upload data-sources.json to Supabase Storage bucket.
 *
 * Prerequisites:
 *   1. Create a 'data-sources' bucket in Supabase Dashboard (Storage → New bucket, public)
 *   2. Ensure SUPABASE_SERVICE_ROLE_KEY in .env is the JWT-format key
 *      (starts with 'eyJ...', ~170 chars), not the newer sb_secret_ format.
 *      You can find the JWT key in: Supabase Dashboard → Settings → API → service_role key
 *
 * Usage:
 *   export PUBLIC_SUPABASE_URL=https://zztiiovryhdsdzmhkcjk.supabase.co
 *   export SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *   node scripts/upload-data-sources.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
	console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
	process.exit(1);
}

if (key.startsWith('sb_secret_')) {
	console.error(
		'SUPABASE_SERVICE_ROLE_KEY is in the newer sb_secret_ format.\n' +
			'The Storage API requires the JWT-format key (starts with "eyJ...").\n' +
			'Find it in: Supabase Dashboard → Settings → API → service_role key (JWT)'
	);
	process.exit(1);
}

const supabase = createClient(url, key);

const fileContent = readFileSync('static/data/data-sources.json', 'utf-8');

const { data, error } = await supabase.storage.from('data-sources').upload('data-sources.json', fileContent, {
	contentType: 'application/json',
	upsert: true
});

if (error) {
	console.error('Upload error:', error.message);
	process.exit(1);
}

console.log('Uploaded:', data);

const { data: urlData } = supabase.storage.from('data-sources').getPublicUrl('data-sources.json');

console.log('Public URL:', urlData.publicUrl);
