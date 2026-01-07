import { BoardCreatedEvent, STREAM_ID, STREAM_TYPE } from "~/events/events";
const createBoardRoute = (honoApp, eventSaver, eventsRetriever) => {
    return honoApp.post("/board", async (c) => {
        const formData = await c.req.formData();
        const title = formData.get("title").trim();
        const description = formData.get("description")?.trim() || "";
        await createBoardCommandHandler(new CreateBoardCommand(title, description), eventSaver, eventsRetriever);
        return c.json("{}");
    });
};
class CreateBoardCommand {
    title;
    description;
    constructor(title, description) {
        this.title = title;
        this.description = description;
    }
}
const createBoardCommandHandler = async (command, eventSaver, eventsRetriever) => {
    const boardId = crypto.randomUUID();
    const query = {
        criteria: [
            {
                tags: [
                    { key: "eventType", value: BoardCreatedEvent.name, },
                    { key: BoardCreatedEvent.boardCreatedId, value: boardId, },
                ]
            },
        ]
    };
    const eventsToSave = [
        {
            eventId: boardId,
            eventType: BoardCreatedEvent.name,
            data: new BoardCreatedEvent(boardId, command.title, command.description, {}),
            metadata: { query },
        },
    ];
    await eventSaver.saveEvents(STREAM_ID, STREAM_TYPE, eventsToSave, -1, [], query);
    return boardId;
};
export { createBoardRoute, CreateBoardCommand, createBoardCommandHandler };
