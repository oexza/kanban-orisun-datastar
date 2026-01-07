import {EventHandlerCheckpointer, Position} from "./types";
import {eq} from "drizzle-orm";
import {randomUUIDv7} from "bun";
import {projectorCheckpoint} from "../../drizzle/schema";
import {NodePgDatabase} from "drizzle-orm/node-postgres";
import {Pool} from "pg";

export class PostgresEventHandlerCheckpointer implements EventHandlerCheckpointer {
    constructor(private db: NodePgDatabase & {
        $client: Pool;
    }) {
    }

    async updateCheckpoint(eventHandlerName: string, lastProcessedPosition: Position): Promise<void> {
        await this.db
            .insert(projectorCheckpoint)
            .values({
                id: randomUUIDv7(),
                name: eventHandlerName,
                commitPosition: lastProcessedPosition.commitPosition.toString(),
                preparePosition: lastProcessedPosition.preparePosition.toString(),
                updatedAt: new Date()
            })
            .onConflictDoUpdate({
                target: projectorCheckpoint.name,
                set: {
                    commitPosition: lastProcessedPosition.commitPosition.toString(),
                    preparePosition: lastProcessedPosition.preparePosition.toString(),
                    updatedAt: new Date()
                },
            });
    }

    async getCheckpoint(eventHandlerName: string): Promise<Position | null> {
        const res = await this.db
            .select({
                commitPosition: projectorCheckpoint.commitPosition,
                preparePosition: projectorCheckpoint.preparePosition,
            })
            .from(projectorCheckpoint)
            .where(eq(projectorCheckpoint.name, eventHandlerName));

        if (!res.length) return null;
        return {
            commitPosition: Number(res[0].commitPosition),
            preparePosition: Number(res[0].preparePosition),
        };
    }
}