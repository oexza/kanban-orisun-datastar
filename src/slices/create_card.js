import { noEventPosition } from "~/event-sourcing-utils/types";
import { BoardCreatedEvent, BoardListCreated, CardCreatedEvent, STREAM_ID, STREAM_TYPE } from "~/events/events";
const createCardRoute = (honoApp, eventSaver, eventsRetriever) => {
    return honoApp.post("/board/:boardId/card", async (c) => {
        const boardId = c.req.param("boardId");
        const formData = await c.req.formData();
        const title = formData.get("title").trim();
        const description = formData.get("description")?.trim() || null;
        const assigneeId = formData.get("assigneeId")?.trim() || null;
        const tagIds = formData.getAll("tagIds");
        await createCardCommandHandler(new CreateCardCommand(boardId, title, description, assigneeId, tagIds), eventSaver, eventsRetriever);
        return c.json("{}");
    });
};
export class CreateCardCommand {
    boardId;
    title;
    description;
    assigneeId;
    tagIds;
    constructor(boardId, title, description, assigneeId, tagIds) {
        this.boardId = boardId;
        this.title = title;
        this.description = description;
        this.assigneeId = assigneeId;
        this.tagIds = tagIds;
    }
}
export const createCardCommandHandler = async (command, eventSaver, eventsRetriever) => {
    const query = {
        criteria: [
            {
                tags: [
                    { key: "eventType", value: BoardCreatedEvent.name },
                    { key: BoardCreatedEvent.boardCreatedId, value: command.boardId },
                ]
            },
            {
                tags: [
                    { key: "eventType", value: BoardListCreated.name },
                    { key: BoardListCreated.title, value: "Todo" },
                    { key: "scope.boardCreatedId", value: command.boardId }
                ]
            }
        ]
    };
    const events = await eventsRetriever.getEvents(STREAM_ID, STREAM_TYPE, 0, 2, 'forward', query);
    const model = new ContextModel();
    for (const event of events) {
        model.handle(event);
    }
    if (!model.boardCreatedId) {
        throw new Error(`Board with id ${command.boardId} does not exist.`);
    }
    if (!model.todoListId) {
        throw new Error(`Todo list not found for board ${command.boardId}.`);
    }
    // Query for cards in the Todo list to find the highest position
    const cardPositionQuery = {
        criteria: [
            {
                tags: [
                    { key: "eventType", value: CardCreatedEvent.name },
                    { key: "scope.boardListCreatedId", value: model.todoListId },
                ]
            },
        ]
    };
    const cardEvents = await eventsRetriever.getEvents(STREAM_ID, STREAM_TYPE, 0, 1000, 'forward', cardPositionQuery);
    for (const event of cardEvents) {
        model.handle(event);
    }
    // Find the highest position (or 0 if no cards exist)
    const highestPosition = model.highestCardPosition;
    const cardId = crypto.randomUUID();
    const eventsToSave = [
        {
            eventId: cardId,
            eventType: CardCreatedEvent.name,
            data: new CardCreatedEvent(cardId, command.title, command.description, command.assigneeId, command.tagIds, highestPosition + 1, {
                boardCreatedId: command.boardId,
                boardListCreatedId: model.todoListId,
            }),
            metadata: { query },
        },
    ];
    await eventSaver.saveEvents(STREAM_ID, STREAM_TYPE, eventsToSave, model.latestEventPosition, [...(events.map(value => value.event.data.scope ?? []))], query);
    return cardId;
};
class ContextModel {
    boardCreatedId = null;
    todoListId = null;
    highestCardPosition = 0;
    latestEventPosition = noEventPosition;
    handle(revent) {
        const event = revent.event;
        switch (event.eventType) {
            case BoardCreatedEvent.name:
                const boardCreatedEvent = event.data;
                this.boardCreatedId = boardCreatedEvent.boardCreatedId;
                break;
            case BoardListCreated.name:
                const boardListCreatedEvent = event.data;
                this.todoListId = boardListCreatedEvent.boardListCreatedId;
                break;
            case CardCreatedEvent.name:
                if (this.highestCardPosition < event.data.position) {
                    this.highestCardPosition = event.data.position;
                }
                break;
            default:
                break;
        }
        if (this.latestEventPosition < revent.position) {
            this.latestEventPosition = revent.position;
        }
        return this;
    }
}
export { createCardRoute };
