import { DuplicateError } from "~/event-sourcing-utils/types";
import { BoardCreatedEvent, BoardListCreated, STREAM_ID, STREAM_TYPE } from "~/events/events";
const createBoardRoute = (honoApp, eventSaver, eventsRetriever) => {
    return honoApp.post("/board", async (c) => {
        const formData = await c.req.formData();
        const title = formData.get("title").trim();
        const position = formData.get("position");
        const boardCreatedId = formData.get("boardId").trim();
        await createBoardListCommandHandler(new CreateBoardListCommand(boardCreatedId, title, position), eventSaver, eventsRetriever);
        return c.json("{}");
    });
};
export class CreateBoardListCommand {
    boardCreatedId;
    title;
    position;
    constructor(boardCreatedId, title, position) {
        this.boardCreatedId = boardCreatedId;
        this.title = title;
        this.position = position;
    }
}
export const createBoardListCommandHandler = async (command, eventSaver, eventsRetriever) => {
    const query = {
        criteria: [
            {
                tags: [
                    { key: "eventType", value: BoardCreatedEvent.name, },
                    { key: BoardCreatedEvent.boardCreatedId, value: command.boardCreatedId, },
                ]
            },
            {
                tags: [
                    { key: "eventType", value: BoardListCreated.name, },
                    { key: BoardListCreated.title, value: command.title, },
                    { key: "scope.boardCreatedId", value: command.boardCreatedId, }
                ]
            }
        ]
    };
    let events = await eventsRetriever.getEvents(STREAM_ID, STREAM_TYPE, 0, 2, 'forward', query);
    const model = new ContextModel();
    for (const event of events) {
        model.handle(event.event);
    }
    if (!model.boardCreatedId) {
        throw new Error(`Board with id ${command.boardCreatedId} does not exist.`);
    }
    if (model.listExists)
        throw new DuplicateError(`List with title ${command.title} exists.`);
    const eventId = crypto.randomUUID();
    const eventsToSave = [
        {
            eventId: eventId,
            eventType: BoardListCreated.name,
            data: new BoardListCreated(eventId, command.title, command.position, {
                boardCreatedId: command.boardCreatedId
            }),
            metadata: { query },
        },
    ];
    await eventSaver.saveEvents(STREAM_ID, STREAM_TYPE, eventsToSave, events[events.length - 1]?.position, [...(events.map(value => value.event.data.scope ?? []))], query);
};
class ContextModel {
    boardCreatedId = null;
    listExists = false;
    handle(event) {
        switch (event.eventType) {
            case BoardCreatedEvent.name:
                const boardCreatedEvent = event.data;
                this.boardCreatedId = boardCreatedEvent.boardCreatedId;
                break;
            case BoardListCreated.name:
                this.listExists = true;
                break;
            default:
                break;
        }
        return this;
    }
}
