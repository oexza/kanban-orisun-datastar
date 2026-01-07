import { createModuleLogger, logError } from "~/utils/logger";
import { GlobalEventHandler } from "~/event-sourcing-utils/global-event-handler";
import { BoardCreatedEvent } from "~/events/events";
import { constructorNameToSnakeCase } from "~/utils/string-utils";
import { boards } from "../../../drizzle/schema";
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
                        { key: "eventType", value: BoardCreatedEvent.name, },
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
            case BoardCreatedEvent.name:
                const event = resolvedEvent.event.data;
                const existingBoard = await getBoardById(event.boardCreatedId, this.db) ?? defaultBoard;
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
async function getBoardById(boardId, db) {
    const result = await db
        .select({
        id: boards.id,
        title: boards.title,
        description: boards.description,
    })
        .from(boards)
        .where(eq(boards.id, boardId));
    return result.length > 0 ? result[0] : null;
}
async function upsertBoard(data, db) {
    await db.transaction(async (tx) => {
        await tx.insert(boards)
            .values({
            ...data,
            boardCreatedId: data.id
        })
            .onConflictDoUpdate({
            target: boards.id,
            set: {
                title: data.title,
                description: data.description,
            },
        });
    });
    return { id: data.id, title: data.title, description: data.description };
}
const defaultBoard = {
    id: "",
    title: "",
    description: "",
};
function handle(board, boardCreatedEvent) {
    const newBoard = { ...board };
    newBoard.id = boardCreatedEvent.boardCreatedId;
    newBoard.title = boardCreatedEvent.title;
    newBoard.description = boardCreatedEvent.description;
    return newBoard;
}
