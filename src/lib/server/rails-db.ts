/**
 * Direct read-only connection to the Altmo Core (Rails) production Postgres DB.
 *
 * Requires SSH tunnel: `ssh altmo-db-tunnel -N -f`
 * Then connect via localhost:5433 to the `cycletowork` database.
 *
 * Safety: All connections use `default_transaction_read_only=on` to prevent
 * accidental writes. The pool is lazy-initialized on first use.
 *
 * This module is only used locally (dev machine / scripts). Vercel production
 * cannot reach the DB — it uses Supabase + static JSON instead.
 */

import pg from 'pg';

let pool: pg.Pool | null = null;

export function getRailsPool(): pg.Pool {
	if (!pool) {
		pool = new pg.Pool({
			host: process.env.RAILS_DB_HOST || 'localhost',
			port: parseInt(process.env.RAILS_DB_PORT || '5433'),
			database: process.env.RAILS_DB_NAME || 'cycletowork',
			user: process.env.RAILS_DB_USER || 'postgres',
			max: 5,
			idleTimeoutMillis: 30000,
			connectionTimeoutMillis: 5000,
			options: '-c default_transaction_read_only=on'
		});
	}
	return pool;
}

export async function isRailsDbAvailable(): Promise<boolean> {
	try {
		const client = await getRailsPool().connect();
		await client.query('SELECT 1');
		client.release();
		return true;
	} catch {
		return false;
	}
}

export async function closeRailsPool(): Promise<void> {
	if (pool) {
		await pool.end();
		pool = null;
	}
}
