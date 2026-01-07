import { createModuleLogger, logError } from "~/utils/logger";
import { GlobalEventHandler } from "~/event-sourcing-utils/global-event-handler";
import { BoardListCreated } from "~/events/events";
import { constructorNameToSnakeCase } from "~/utils/string-utils";
import { lists } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
const logger = createModuleLogger('boards-projection');
export class BoardsListsProjectionEventHandler {
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
                        { key: "eventType", value: BoardListCreated.name, },
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
            case BoardListCreated.name:
                const event = resolvedEvent.event.data;
                const existingBoardList = await getBoardListById(event.boardListCreatedId, this.db) ?? defaultBoardList;
                const handledBoardList = handle(existingBoardList, event);
                if (existingBoardList !== handledBoardList) {
                    await upsertBoard(handledBoardList, this.db);
                    board = handledBoardList;
                }
                if (logger.isDebugEnabled()) {
                    logger.debug(`Processed ${resolvedEvent.event.eventType} for board ID: ${board?.boardId}`);
                }
                break;
        }
        if (board) {
            this.notificationPublisher.publish(getBoardListChannelName(board.boardId), board).catch(error => {
                logError(logger, error);
            });
        }
    }
    name = constructorNameToSnakeCase(BoardsListsProjectionEventHandler);
}
export function getBoardsListsChannelName() {
    return 'board_list.board.*';
}
export function getBoardListChannelName(boardId) {
    return 'board_list.board.' + boardId;
}
async function getBoardListById(listId, db) {
    const result = await db
        .select({
        id: lists.id,
        title: lists.title,
        position: lists.position,
        boardId: lists.boardId,
    })
        .from(lists)
        .where(eq(lists.id, listId));
    return result.length > 0 ? result[0] : null;
}
async function upsertBoard(data, db) {
    await db.transaction(async (tx) => {
        await tx.insert(lists)
            .values([{
                id: data.id,
                boardId: data.boardId,
                title: data.title,
                position: data.position,
                boardListCreatedId: data.id,
            }])
            .onConflictDoUpdate({
            target: lists.id,
            set: {
                boardId: data.boardId,
                title: data.title,
                position: data.position,
                boardListCreatedId: data.id,
            },
        });
    });
}
const defaultBoardList = {
    id: crypto.randomUUID(),
    boardId: '',
    title: '',
    position: 0,
};
function handle(board, boardCreatedEvent) {
    const newBoard = { ...board };
    newBoard.id = boardCreatedEvent.boardListCreatedId;
    newBoard.title = boardCreatedEvent.title;
    newBoard.position = boardCreatedEvent.position;
    newBoard.boardId = boardCreatedEvent.scope.boardCreatedId;
    return newBoard;
}
