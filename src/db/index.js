import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from "pg";
import { createModuleLogger } from "~/utils/logger";
const logger = createModuleLogger("db");
// Create connection pool
const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    max: 20, // Maximum number of connections in the pool
    min: 1, // Minimum number of connections in the pool
    idleTimeoutMillis: 30000, // Close connections after 30 seconds of inactivity
    connectionTimeoutMillis: 2000, // Timeout when connecting to the database
    ssl: process.env.POSTGRES_USE_SSL === 'true' ? {
        rejectUnauthorized: false,
    } : false,
});
export const db = drizzle(pool);
/**
 * Test database connection at startup
 */
export async function initializeDatabase() {
    try {
        await pool.query('SELECT 1');
        logger.info('[Database] ✅ Connected successfully');
    }
    catch (error) {
        console.error('[Database] ❌ Connection failed:', error);
        process.exit(1);
    }
}
// Graceful shutdown handler
if (typeof process !== "undefined") {
    process.on("SIGINT", () => {
        pool.end();
        process.exit(0);
    });
    process.on("SIGTERM", () => {
        pool.end();
        process.exit(0);
    });
}
