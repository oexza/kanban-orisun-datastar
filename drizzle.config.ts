import type { Config } from 'drizzle-kit';

// Construct database URL from individual environment variables
const constructDatabaseUrl = () => {
  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_DB;

  return `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`;
};

export default {
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: constructDatabaseUrl()
  },
  verbose: true,
  strict: true,
  migrations: {
    prefix: 'timestamp',
  },
} satisfies Config;
