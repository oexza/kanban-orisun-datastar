import {createModuleLogger, logError} from "~/utils/logger";
import {GlobalEventHandler} from "~/event-sourcing-utils/global-event-handler";
import {
    EventHandlerCheckpointer,
    EventsSubscriber, Publisher,
    ResolvedDomainEvent
} from "~/event-sourcing-utils/types";
import {CommentAddedToCardEvent,} from "~/events/events";
import {constructorNameToSnakeCase} from "~/utils/string-utils";
import {NodePgDatabase} from "drizzle-orm/node-postgres";
import {Pool} from "pg";
import {comments} from "../../../drizzle/schema";

const logger = createModuleLogger('comments-projection');

export class CommentsProjectionEventHandler {
    private globalEventHandler: GlobalEventHandler;

    constructor(
        private readonly eventsSubscriber: EventsSubscriber,
        private readonly eventHandlerCheckpointer: EventHandlerCheckpointer,
        private readonly notificationPublisher: Publisher,
        private readonly db: NodePgDatabase & {
            $client: Pool
        }
    ) {
        this.globalEventHandler = new GlobalEventHandler(
            this.eventsSubscriber,
            this.eventHandlerCheckpointer,
            this.name,
            -1,
            async (resolvedEvent: ResolvedDomainEvent<any>) => await this.handleEvent(resolvedEvent),
            {
                criteria: [
                    {
                        tags: [
                            {key: "eventType", value: CommentAddedToCardEvent.name,},
                        ]
                    },
                ],
            }
        );
    }

    public async startSubscribing() {
        await this.globalEventHandler.startSubscribing();
    }

    public stopSubscribing() {
        this.globalEventHandler.stopSubscribing();
    }

    private async handleEvent(resolvedEvent: ResolvedDomainEvent<any>) {
        switch (resolvedEvent.event.eventType) {
            case CommentAddedToCardEvent.name:
                const event = resolvedEvent.event.data as CommentAddedToCardEvent;

                await addComment(event, this.db);

                if (logger.isDebugEnabled()) {
                    logger.debug(`Processed comment event for card ID: ${event.scope.cardCreatedId}`);
                }

                break;
        }
    }

    name = constructorNameToSnakeCase(CommentsProjectionEventHandler);
}

async function addComment(event: CommentAddedToCardEvent, db: NodePgDatabase): Promise<void> {
    await db.insert(comments)
        .values({
            id: event.commentCreatedId,
            cardId: event.scope.cardCreatedId,
            userId: event.userId,
            text: event.text,
            createdAt: new Date(),
        })
        .onConflictDoNothing();
}