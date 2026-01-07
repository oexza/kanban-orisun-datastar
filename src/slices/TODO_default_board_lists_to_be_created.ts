import {createModuleLogger, logError} from "~/utils/logger";
import {GlobalEventHandler} from "~/event-sourcing-utils/global-event-handler";
import {
    DuplicateError,
    EventHandlerCheckpointer, EventRetriever, EventSaver,
    EventsSubscriber,
    ResolvedDomainEvent
} from "~/event-sourcing-utils/types";
import {BoardCreatedEvent,} from "~/events/events";
import {constructorNameToSnakeCase} from "~/utils/string-utils";
import {CreateBoardListCommand, createBoardListCommandHandler} from "~/slices/create_board_list";

const logger = createModuleLogger('TODO-default-board-lists-to-be-created');

export class TodoDefaultBoardListsToBeCreatedEventHandler {
    private globalEventHandler: GlobalEventHandler;

    constructor(
        private readonly eventsSubscriber: EventsSubscriber,
        private readonly eventHandlerCheckpointer: EventHandlerCheckpointer,
        private readonly eventRetriever: EventRetriever,
        private readonly eventSaver: EventSaver,
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
        switch (resolvedEvent.event.eventType) {
            case BoardCreatedEvent.name:
                const event = resolvedEvent.event.data as BoardCreatedEvent;

                await createDefaultListsForBoard(
                    event.boardCreatedId,
                    this.eventRetriever,
                    this.eventSaver
                )

                if (logger.isDebugEnabled()) {
                    logger.debug(`Processed BoardCreatedEvent for board ID: ${event.boardCreatedId}`);
                }

                break;
        }
    }

    name = constructorNameToSnakeCase(TodoDefaultBoardListsToBeCreatedEventHandler);
}

async function createDefaultListsForBoard(boardId: string, eventRetriever: EventRetriever, eventSaver: EventSaver) {
    const listTitles = ["Todo", "In-Progress", "QA", "Done"];

    for (let i = 0; i < listTitles.length; i++) {
        try {
            await createBoardListCommandHandler(
                new CreateBoardListCommand(
                    boardId,
                    listTitles[i],
                    i + 1,
                ),
                eventSaver,
                eventRetriever
            );
        } catch (error) {
            if ((error as any).name == DuplicateError.name) {
                logger.info({msg: "Default list '%s' already exists for board ID: %s. Skipping creation."}, boardId);
                continue;
            }
            throw error
        }
    }
}