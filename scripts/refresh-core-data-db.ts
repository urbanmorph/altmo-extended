/**
 * Refresh static core data JSON files directly from Rails production DB.
 *
 * Replaces the API-based refresh-core-data.sh for cases where the Rails API
 * is slow or unavailable. Requires SSH tunnel to be active.
 *
 * Prerequisites:
 *   ssh altmo-db-tunnel -N -f
 *
 * Usage:
 *   npx tsx scripts/refresh-core-data-db.ts
 *
 * Output files:
 *   src/lib/data/global-stats.json
 *   src/lib/data/geo-markers.json
 */

import pg from 'pg';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../src/lib/data');

async function main() {
	const pool = new pg.Pool({
		host: process.env.RAILS_DB_HOST || 'localhost',
		port: parseInt(process.env.RAILS_DB_PORT || '5433'),
		database: process.env.RAILS_DB_NAME || 'cycletowork',
		user: process.env.RAILS_DB_USER || 'postgres',
		max: 3,
		connectionTimeoutMillis: 5000,
		options: '-c default_transaction_read_only=on'
	});

	try {
		// Test connection
		const client = await pool.connect();
		console.log('Connected to Rails DB');
		client.release();

		// ── 1. Global Stats ──
		console.log('\nFetching global stats...');
		const statsResult = await pool.query(`
			SELECT
				COUNT(DISTINCT user_id) AS people,
				COUNT(*) AS activities_count,
				COALESCE(SUM(distance), 0) AS total_distance_m
			FROM activities
		`);

		const row = statsResult.rows[0];
		const totalDistanceM = parseFloat(row.total_distance_m);
		const distanceKm = Math.round(totalDistanceM / 1000);
		const co2Offset = Math.round(distanceKm * 0.25);
		const fuelSaved = Math.round(distanceKm * 0.108);
		const moneySaved = Math.round(fuelSaved * 101);

		const globalStats = {
			activeUsers: parseInt(row.people),
			activitiesCount: parseInt(row.activities_count),
			distanceKm,
			co2Offset,
			fuelSaved,
			moneySaved
		};

		const statsPath = resolve(DATA_DIR, 'global-stats.json');
		writeFileSync(statsPath, JSON.stringify(globalStats));
		console.log(`  Wrote ${statsPath}`);
		console.log(`  Active Users: ${globalStats.activeUsers.toLocaleString()}`);
		console.log(`  Activities: ${globalStats.activitiesCount.toLocaleString()}`);
		console.log(`  Distance: ${globalStats.distanceKm.toLocaleString()} km`);

		// ── 2. Geo Markers (with activity stats for companies) ──
		console.log('\nFetching geo markers...');
		const markersResult = await pool.query(`
			SELECT
				gm.id,
				gm.associable_type,
				gm.associable_id,
				gm.lat,
				gm.lon,
				gm.layer_type,
				COALESCE(c.name, camp.name, tp.name) AS associable_name,
				COALESCE(c.updated_city_id, camp.updated_city_id) AS city_id,
				c.total_activities,
				c.emp_count,
				sub.active_users,
				sub.total_km
			FROM geo_markers gm
			LEFT JOIN companies c ON gm.associable_type = 'Company' AND gm.associable_id = c.id
			LEFT JOIN campus camp ON gm.associable_type = 'Campus' AND gm.associable_id = camp.id
			LEFT JOIN transit_points tp ON gm.associable_type = 'TransitPoint' AND gm.associable_id = tp.id
			LEFT JOIN LATERAL (
				SELECT COUNT(DISTINCT a.user_id) AS active_users,
				       ROUND(COALESCE(SUM(a.distance), 0) / 1000) AS total_km
				FROM activities a WHERE a.company_id = gm.associable_id
			) sub ON gm.associable_type = 'Company'
			WHERE gm.lat IS NOT NULL AND gm.lon IS NOT NULL
			  AND (gm.associable_type != 'Company' OR c.approved = true)
			ORDER BY gm.id
		`);

		const geoMarkers = markersResult.rows.map((m: Record<string, unknown>) => {
			const base: Record<string, unknown> = {
				id: m.id as number,
				name: (m.associable_name as string) || '',
				lat: parseFloat(m.lat as string),
				lon: parseFloat(m.lon as string),
				type: (m.associable_type as string) || '',
				associableId: m.associable_id as number,
				cityId: m.city_id ? parseInt(m.city_id as string) : null
			};
			// Add activity stats for Company markers only
			if (m.associable_type === 'Company') {
				const totalActivities = m.total_activities ? parseInt(m.total_activities as string) : 0;
				const activeUsers = m.active_users ? parseInt(m.active_users as string) : 0;
				const totalKm = m.total_km ? parseInt(m.total_km as string) : 0;
				const empCount = m.emp_count ? parseInt(m.emp_count as string) : 0;
				if (totalActivities > 0) base.totalActivities = totalActivities;
				if (activeUsers > 0) base.activeUsers = activeUsers;
				if (totalKm > 0) base.totalKm = totalKm;
				if (empCount > 0) base.empCount = empCount;
			}
			return base;
		});

		const markersPath = resolve(DATA_DIR, 'geo-markers.json');
		writeFileSync(markersPath, JSON.stringify(geoMarkers));
		console.log(`  Wrote ${markersPath}`);
		console.log(`  Markers: ${geoMarkers.length}`);

		const byType = geoMarkers.reduce((acc: Record<string, number>, m: { type: string }) => {
			acc[m.type] = (acc[m.type] || 0) + 1;
			return acc;
		}, {});
		console.log(`  By type: ${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(', ')}`);

		console.log('\nDone! Commit the updated JSON files to git.');
	} finally {
		await pool.end();
	}
}

main().catch((err) => {
	console.error('Error:', err.message);
	process.exit(1);
});
