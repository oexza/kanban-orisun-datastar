// Run database migrations
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from "~/db";
console.log("Running migrations...");
migrate(db, { migrationsFolder: "drizzle/migrations" }).then(value => {
    console.log("Migrations applied:");
    process.exit(0);
});
