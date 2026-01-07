import { createModuleLogger, logError } from "~/utils/logger";
import { GlobalEventHandler } from "~/event-sourcing-utils/global-event-handler";
import { CardCreatedEvent } from "~/events/events";
import { constructorNameToSnakeCase } from "~/utils/string-utils";
import { cards } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
const logger = createModuleLogger('boards-projection');
export class BoardsProjectionEventHandler {
    eventsSubscriber;
    eventHandlerCheckpointer;
    notificationPublisher;
    db;
    globalEventHandler;
    constructor(eventsSubscriber, eventHandlerCheckpointer, notificationPublisher, db) {
        this.eventsSubscriber = eventsSubscriber;
        this.eventHandlerCheckpointer = eventHandlerCheckpointer;
        this.notificationPublisher = notificationPublisher;
        this.db = db;
        this.globalEventHandler = new GlobalEventHandler(this.eventsSubscriber, this.eventHandlerCheckpointer, this.name, -1, async (resolvedEvent) => await this.handleEvent(resolvedEvent), {
            criteria: [
                {
                    tags: [
                        { key: "eventType", value: CardCreatedEvent.name, },
                    ]
                },
            ],
        });
    }
    async startSubscribing() {
        await this.globalEventHandler.startSubscribing();
    }
    stopSubscribing() {
        this.globalEventHandler.stopSubscribing();
    }
    async handleEvent(resolvedEvent) {
        let board = undefined;
        switch (resolvedEvent.event.eventType) {
            case CardCreatedEvent.name:
                const event = resolvedEvent.event.data;
                const existingBoard = await getCardById(event.boardCreatedId, this.db) ?? defaultBoard;
                const handledBoard = handle(existingBoard, event);
                if (existingBoard !== handledBoard) {
                    await upsertBoard(handledBoard, this.db);
                    board = handledBoard;
                }
                if (logger.isDebugEnabled()) {
                    logger.debug(`Processed BoardCreatedEvent for board ID: ${event.boardCreatedId}`);
                }
                break;
        }
        if (board) {
            this.notificationPublisher.publish(getBoardChannelName(board.id), board).catch(error => {
                logError(logger, error);
            });
        }
    }
    name = constructorNameToSnakeCase(BoardsProjectionEventHandler);
}
export function getBoardsChannelName() {
    return 'board.*';
}
export function getBoardChannelName(boardId) {
    return 'board.' + boardId;
}
async function getCardById(boardId, db) {
    const result = await db
        .select({
        id: cards.id,
        title: cards.title,
        description: cards.description,
        assigneeId: cards.assigneeId,
    })
        .from(cards)
        .where(eq(cards.id, boardId));
    return result.length > 0 ? {
        id: result[0].id,
        title: result[0].title,
        description: result[0].description,
        assigneeId: result[0].assigneeId,
        tagIds: [],
    } : null;
}
async function upsertBoard(data, db) {
    await db.transaction(async (tx) => {
        await tx.insert(cards)
            .values({
            id: data.id,
            title: data.title,
            description: data.description,
            assigneeId: data.assigneeId,
        })
            .onConflictDoUpdate({
            target: cards.id,
            set: {
                title: data.title,
                description: data.description,
                assigneeId: data.assigneeId,
            },
        });
    });
    return { id: data.id, title: data.title, description: data.description };
}
const defaultBoard = {
    id: "",
    title: "",
    description: "",
    assigneeId: "",
    tagIds: [],
};
function handle(card, cardCreatedEvent) {
    const newBoard = { ...card };
    newBoard.id = cardCreatedEvent.cardCreatedId;
    newBoard.title = cardCreatedEvent.title;
    newBoard.description = cardCreatedEvent.description;
    newBoard.assigneeId = cardCreatedEvent.assigneeId;
    newBoard.tagIds = cardCreatedEvent.tagIds;
    return newBoard;
}
