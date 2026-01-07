import {createModuleLogger, logError} from "~/utils/logger";
import {GlobalEventHandler} from "~/event-sourcing-utils/global-event-handler";
import {
    EventHandlerCheckpointer,
    EventsSubscriber, Publisher,
    ResolvedDomainEvent
} from "~/event-sourcing-utils/types";
import {BoardCreatedEvent} from "~/events/events";
import {constructorNameToSnakeCase} from "~/utils/string-utils";
import {NodePgDatabase} from "drizzle-orm/node-postgres";
import {Pool} from "pg";
import {boards, lists} from "../../../drizzle/schema";
import {eq} from "drizzle-orm";

const logger = createModuleLogger('boards-projection');

export class BoardsProjectionEventHandler {
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
                            {key: "eventType", value: BoardCreatedEvent.name,},
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
        let board: Board | undefined = undefined;

        switch (resolvedEvent.event.eventType) {
            case BoardCreatedEvent.name:
                const event = resolvedEvent.event.data as BoardCreatedEvent;

                const existingBoard = await getBoardById(event.boardCreatedId, this.db) ?? defaultBoard;
                const handledBoard = handle(existingBoard, event);

                if (existingBoard !== handledBoard) {
                    await upsertBoard(
                        handledBoard,
                        this.db
                    )
                    board = handledBoard
                }

                if (logger.isDebugEnabled()) {
                    logger.debug(`Processed BoardCreatedEvent for board ID: ${event.boardCreatedId}`);
                }

                break;
        }

        if (board) {
            this.notificationPublisher.publish(
                getBoardChannelName(board.id),
                board
            ).catch(error => {
                logError(logger, error,)
            })
        }
    }

    name = constructorNameToSnakeCase(BoardsProjectionEventHandler);
}

export function getBoardsChannelName(): string {
    return 'board.*';
}

export function getBoardChannelName(boardId: string): string {
    return 'board.' + boardId;
}

async function getBoardById(boardId: string, db: NodePgDatabase): Promise<Board | null> {
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

async function upsertBoard(data: Board, db: NodePgDatabase): Promise<Board> {
    await db.transaction(async tx => {
        await tx.insert(boards)
            .values({
                ...data,
                boardCreatedId: data.id
            })
            .onConflictDoUpdate(
                {
                    target: boards.id,
                    set: {
                        title: data.title,
                        description: data.description,
                    },
                }
            )
    })

    return {id: data.id, title: data.title, description: data.description};
}

interface Board {
    id: string;
    title: string;
    description: string | null;
}

const defaultBoard: Board = {
    id: "",
    title: "",
    description: "",
};

function handle(board: Board, boardCreatedEvent: BoardCreatedEvent): Board {
    const newBoard = {...board};
    newBoard.id = boardCreatedEvent.boardCreatedId
    newBoard.title = boardCreatedEvent.title
    newBoard.description = boardCreatedEvent.description
    return newBoard
}