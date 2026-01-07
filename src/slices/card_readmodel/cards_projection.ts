import {createModuleLogger, logError} from "~/utils/logger";
import {GlobalEventHandler} from "~/event-sourcing-utils/global-event-handler";
import {
    EventHandlerCheckpointer,
    EventsSubscriber, Publisher,
    ResolvedDomainEvent
} from "~/event-sourcing-utils/types";
import {CardCreatedEvent, CardDeletedEvent, CardMovedEvent, CardUpdatedEvent} from "~/events/events";
import {constructorNameToSnakeCase} from "~/utils/string-utils";
import {NodePgDatabase} from "drizzle-orm/node-postgres";
import {Pool} from "pg";
import {cards, cardTags,} from "../../../drizzle/schema";
import {eq} from "drizzle-orm";

const logger = createModuleLogger('cards-projection');

export class CardsProjectionEventHandler {
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
                            {key: "eventType", value: CardCreatedEvent.name,},
                        ]
                    },
                    {
                        tags: [
                            {key: "eventType", value: CardUpdatedEvent.name,},
                        ]
                    },
                    {
                        tags: [
                            {key: "eventType", value: CardDeletedEvent.name,},
                        ]
                    },
                    {
                        tags: [
                            {key: "eventType", value: CardMovedEvent.name,},
                        ]
                    },
                ],
            },
        );
    }

    public async startSubscribing() {
        await this.globalEventHandler.startSubscribing();
    }

    public stopSubscribing() {
        this.globalEventHandler.stopSubscribing();
    }

    private async handleEvent(resolvedEvent: ResolvedDomainEvent<any>) {
        let card: Card | undefined = undefined;

        switch (resolvedEvent.event.eventType) {
            case CardCreatedEvent.name:
                const event = resolvedEvent.event.data as CardCreatedEvent;

                const existingBoard = await getCardById(event.cardCreatedId, this.db) ?? defaultBoard;
                const handledEvent = handle(existingBoard, event);

                if (existingBoard !== handledEvent) {
                    await upsertCard(
                        handledEvent,
                        this.db
                    )
                    card = handledEvent
                }

                if (logger.isDebugEnabled()) {
                    logger.debug(`Processed event for board ID: ${event.cardCreatedId}`);
                }

                break;
            case CardUpdatedEvent.name:
                const updateEvent = resolvedEvent.event.data as CardUpdatedEvent;

                const existingCard = await getCardById(updateEvent.scope.cardCreatedId, this.db);
                if (!existingCard) {
                    logError(logger,`Error processing CardUpdatedEvent: Card with ID ${updateEvent.scope.cardCreatedId} not found.`);
                    break
                }
                const handledUpdateEvent = handleCardUpdated(existingCard, updateEvent);

                if (existingCard !== handledUpdateEvent) {
                    await upsertCard(
                        handledUpdateEvent,
                        this.db
                    )
                    card = handledUpdateEvent
                }

                if (logger.isDebugEnabled()) {
                    logger.debug(`Processed update event for card ID: ${updateEvent.cardUpdatedId}`);
                }

                break;
            case CardDeletedEvent.name:
                const deleteEvent = resolvedEvent.event.data as CardDeletedEvent;

                await deleteCard(deleteEvent.scope.cardCreatedId, this.db);

                // Create a minimal card for notification
                card = {
                    id: deleteEvent.scope.cardCreatedId,
                    title: "",
                    description: null,
                    assigneeId: null,
                    tagIds: [],
                    position: 0,
                    listId: "",
                    boardId: deleteEvent.scope.cardCreatedId,
                };

                if (logger.isDebugEnabled()) {
                    logger.debug(`Processed delete event for card ID: ${deleteEvent.scope.cardCreatedId}`);
                }

                break;
            case CardMovedEvent.name:
                const movedEvent = resolvedEvent.event.data as CardMovedEvent;

                const existingMovedCard = await getCardById(movedEvent.scope.cardCreatedId, this.db);
                if (existingMovedCard) {
                    const handledMovedEvent = handleCardMoved(existingMovedCard, movedEvent);

                    if (existingMovedCard !== handledMovedEvent) {
                        await updateCardPosition(
                            handledMovedEvent,
                            this.db
                        )
                        card = handledMovedEvent
                    }

                    if (logger.isDebugEnabled()) {
                        logger.debug(`Processed move event for card ID: ${movedEvent.scope.cardCreatedId}`);
                    }
                }

                break;
        }

        if (card) {
            this.notificationPublisher.publish(
                getBoardCardChannelName(card.boardId),
                card
            ).catch(error => {
                logError(logger, error,)
            })
        }
    }

    name = constructorNameToSnakeCase(CardsProjectionEventHandler);
}

export function getCardsChannelName(): string {
    return 'board.list.card.*';
}

export function getBoardCardChannelName(boardId: string): string {
    return 'board.list.card.' + boardId;
}

async function getCardById(boardId: string, db: NodePgDatabase): Promise<Card | null> {
    const result = await db
        .select({
            id: cards.id,
            title: cards.title,
            description: cards.description,
            assigneeId: cards.assigneeId,
            position: cards.position,
            listId: cards.listId,
        })
        .from(cards)
        .where(eq(cards.id, boardId));

    return result.length > 0 ? {
        id: result[0].id,
        title: result[0].title,
        description: result[0].description,
        assigneeId: result[0].assigneeId,
        position: result[0].position,
        listId: result[0].listId,
        tagIds: [],
        boardId: "",
    } : null;
}

async function upsertCard(data: Card, db: NodePgDatabase): Promise<void> {
    await db.transaction(async tx => {
        await tx.insert(cards)
            .values({
                id: data.id,
                title: data.title,
                description: data.description,
                assigneeId: data.assigneeId,
                position: data.position,
                listId: data.listId
            })
            .onConflictDoUpdate(
                {
                    target: cards.id,
                    set: {
                        title: data.title,
                        description: data.description,
                        assigneeId: data.assigneeId,
                        position: data.position,
                    },
                }
            )

        // Delete existing tags and insert new ones (idempotent for event replay)
        await tx.delete(cardTags).where(eq(cardTags.cardId, data.id));

        if (data.tagIds && data.tagIds.length > 0) {
            await tx.insert(cardTags)
                .values(
                    data.tagIds.map((tagId) => ({
                        cardId: data.id,
                        tagId,
                    })),
                );
        }
    })
}

interface Card {
    id: string;
    title: string;
    description: string | null;
    assigneeId: string | null;
    tagIds: string[];
    position: number;
    listId: string;
    boardId: string;
}

const defaultBoard: Card = {
    id: "",
    title: "",
    description: "",
    assigneeId: "",
    tagIds: [],
    position: 1,
    listId: "",
    boardId: "",
};

function handle(card: Card, cardCreatedEvent: CardCreatedEvent): Card {
    const newBoard = {...card};
    newBoard.id = cardCreatedEvent.cardCreatedId
    newBoard.title = cardCreatedEvent.title
    newBoard.description = cardCreatedEvent.description
    newBoard.assigneeId = cardCreatedEvent.assigneeId
    newBoard.tagIds = cardCreatedEvent.tagIds
    newBoard.listId = cardCreatedEvent.scope.boardListCreatedId
    newBoard.position = cardCreatedEvent.position
    newBoard.boardId = cardCreatedEvent.scope.boardCreatedId

    return newBoard
}

function handleCardUpdated(card: Card, cardUpdatedEvent: CardUpdatedEvent): Card {
    const updatedCard = {...card};
    updatedCard.title = cardUpdatedEvent.title
    updatedCard.description = cardUpdatedEvent.description
    updatedCard.assigneeId = cardUpdatedEvent.assigneeId
    updatedCard.tagIds = cardUpdatedEvent.tagIds
    updatedCard.boardId = cardUpdatedEvent.scope.boardCreatedId

    return updatedCard
}

async function deleteCard(cardId: string, db: NodePgDatabase): Promise<void> {
    // Delete card tags first (foreign key constraint)
    await db.delete(cardTags).where(eq(cardTags.cardId, cardId));

    // Delete the card
    await db.delete(cards).where(eq(cards.id, cardId));
}

function handleCardMoved(card: Card, cardMovedEvent: CardMovedEvent): Card {
    const movedCard = {...card};
    movedCard.listId = cardMovedEvent.scope.boardListCreatedId;
    movedCard.position = cardMovedEvent.position;
    movedCard.boardId = cardMovedEvent.scope.boardCreatedId

    return movedCard
}

async function updateCardPosition(data: Card, db: NodePgDatabase): Promise<void> {
    await db.update(cards)
        .set({
            listId: data.listId,
            position: data.position,
        })
        .where(eq(cards.id, data.id));
}