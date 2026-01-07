import { createModuleLogger } from "~/utils/logger";
import { GlobalEventHandler } from "~/event-sourcing-utils/global-event-handler";
import { DuplicateError } from "~/event-sourcing-utils/types";
import { BoardCreatedEvent, STREAM_ID, STREAM_TYPE } from "~/events/events";
import { constructorNameToSnakeCase } from "~/utils/string-utils";
import { CreateBoardListCommand, createBoardListCommandHandler } from "~/slices/create_board_list";
const logger = createModuleLogger('TODO-default-board-lists-to-be-created');
export class TodoDefaultBoardListsToBeCreatedEventHandler {
    eventsSubscriber;
    eventHandlerCheckpointer;
    eventRetriever;
    eventSaver;
    globalEventHandler;
    constructor(eventsSubscriber, eventHandlerCheckpointer, eventRetriever, eventSaver) {
        this.eventsSubscriber = eventsSubscriber;
        this.eventHandlerCheckpointer = eventHandlerCheckpointer;
        this.eventRetriever = eventRetriever;
        this.eventSaver = eventSaver;
        this.globalEventHandler = new GlobalEventHandler(this.eventsSubscriber, this.eventHandlerCheckpointer, this.name, -1, async (resolvedEvent) => await this.handleEvent(resolvedEvent), {
            criteria: [
                {
                    tags: [
                        { key: "eventType", value: BoardCreatedEvent.name, },
                    ]
                },
            ],
        }, {
            id: STREAM_ID,
            type: STREAM_TYPE,
        });
    }
    async startSubscribing() {
        await this.globalEventHandler.startSubscribing();
    }
    stopSubscribing() {
        this.globalEventHandler.stopSubscribing();
    }
    async handleEvent(resolvedEvent) {
        switch (resolvedEvent.event.eventType) {
            case BoardCreatedEvent.name:
                const event = resolvedEvent.event.data;
                await createDefaultListsForBoard(event.boardCreatedId, this.eventRetriever, this.eventSaver);
                if (logger.isDebugEnabled()) {
                    logger.debug(`Processed BoardCreatedEvent for board ID: ${event.boardCreatedId}`);
                }
                break;
        }
    }
    name = constructorNameToSnakeCase(TodoDefaultBoardListsToBeCreatedEventHandler);
}
async function createDefaultListsForBoard(boardId, eventRetriever, eventSaver) {
    const listTitles = ["Todo", "In-Progress", "QA", "Done"];
    for (let i = 0; i < listTitles.length; i++) {
        try {
            await createBoardListCommandHandler(new CreateBoardListCommand(boardId, listTitles[i], i + 1), eventSaver, eventRetriever);
        }
        catch (error) {
            if (error.name == DuplicateError.name) {
                logger.info({ msg: "Default list '%s' already exists for board ID: %s. Skipping creation." }, boardId);
                continue;
            }
            throw error;
        }
    }
}
