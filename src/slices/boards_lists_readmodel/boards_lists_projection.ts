import {createModuleLogger, logError} from "~/utils/logger";
import {GlobalEventHandler} from "~/event-sourcing-utils/global-event-handler";
import {
    EventHandlerCheckpointer,
    EventsSubscriber, Publisher,
    ResolvedDomainEvent
} from "~/event-sourcing-utils/types";
import {BoardListCreated} from "~/events/events";
import {constructorNameToSnakeCase} from "~/utils/string-utils";
import {NodePgDatabase} from "drizzle-orm/node-postgres";
import {Pool} from "pg";
import {lists} from "../../../drizzle/schema";
import {eq} from "drizzle-orm";

const logger = createModuleLogger('boards-projection');

export class BoardsListsProjectionEventHandler {
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
                            {key: "eventType", value: BoardListCreated.name,},
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
        let board: BoardList | undefined = undefined;

        switch (resolvedEvent.event.eventType) {
            case BoardListCreated.name:
                const event = resolvedEvent.event.data as BoardListCreated;

                const existingBoardList = await getBoardListById(event.boardListCreatedId, this.db) ?? defaultBoardList;
                const handledBoardList = handle(existingBoardList, event);

                if (existingBoardList !== handledBoardList) {
                    await upsertBoard(
                        handledBoardList,
                        this.db
                    )
                    board = handledBoardList
                }

                if (logger.isDebugEnabled()) {
                    logger.debug(`Processed ${resolvedEvent.event.eventType} for board ID: ${board?.boardId}`);
                }

                break;
        }

        if (board) {
            this.notificationPublisher.publish(
                getBoardListChannelName(board.boardId),
                board
            ).catch(error => {
                logError(logger, error,)
            })
        }
    }

    name = constructorNameToSnakeCase(BoardsListsProjectionEventHandler);
}

export function getBoardsListsChannelName(): string {
    return 'board_list.board.*';
}

export function getBoardListChannelName(boardId: string): string {
    return 'board_list.board.' + boardId;
}

async function getBoardListById(listId: string, db: NodePgDatabase): Promise<BoardList | null> {
    const result = await db
        .select({
            id: lists.id,
            title: lists.title,
            position: lists.position,
            boardId: lists.boardId,
            boardListCreatedId: lists.boardListCreatedId,
        })
        .from(lists)
        .where(eq(lists.id, listId));

    return result.length > 0 ? result[0] : null;
}

async function upsertBoard(data: BoardList, db: NodePgDatabase): Promise<void> {
    await db.transaction(async tx => {
        await tx.insert(lists)
            .values(
                [{
                    id: data.id,
                    boardId: data.boardId,
                    title: data.title,
                    position: data.position,
                    boardListCreatedId: data.id,
                }]
            )
            .onConflictDoUpdate(
                {
                    target: lists.id,
                    set: {
                        boardId: data.boardId,
                        title: data.title,
                        position: data.position,
                        boardListCreatedId: data.id,
                    },
                }
            )
    })
}

interface BoardList {
    id: string;
    boardId: string,
    title: string;
    position: number;
    boardListCreatedId: string | null;
}

const defaultBoardList: BoardList = {
    id: "",
    boardId: '',
    title: '',
    position: 0,
    boardListCreatedId: null,
};

function handle(board: BoardList, boardCreatedEvent: BoardListCreated): BoardList {
    const newBoard = {...board};
    newBoard.id = boardCreatedEvent.boardListCreatedId
    newBoard.title = boardCreatedEvent.title
    newBoard.position = boardCreatedEvent.position
    newBoard.boardId = boardCreatedEvent.scope.boardCreatedId;
    return newBoard
}