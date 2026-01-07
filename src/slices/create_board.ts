import {HonoType} from "~/lib/api_types";
import {EventRetriever, EventSaver} from "~/event-sourcing-utils/types";
import {BoardCreatedEvent, } from "~/events/events";
import {randomUUIDv7} from "bun";

const createBoardRoute = (honoApp: HonoType, eventSaver: EventSaver, eventsRetriever: EventRetriever) => {
    return honoApp.post("/board", async (c) => {
        const formData = await c.req.formData();
        const title = (formData.get("title") as string).trim();
        const description = (formData.get("description") as string)?.trim() || "";

        await createBoardCommandHandler(
            new CreateBoardCommand(title, description),
            eventSaver,
            eventsRetriever
        );

        return c.json("{}");
    });
}

class CreateBoardCommand {
    constructor(readonly title: string, readonly description: string) {
    }
}

const createBoardCommandHandler = async (command: CreateBoardCommand, eventSaver: EventSaver, eventsRetriever: EventRetriever) => {
    const boardId = randomUUIDv7();

    const query = {
        criteria: [
            {
                tags: [
                    {key: "eventType", value: BoardCreatedEvent.name,},
                    {key: BoardCreatedEvent.boardCreatedId, value: boardId,},
                ]
            },
        ]
    }

    const eventsToSave = [
        {
            eventId: boardId,
            eventType: BoardCreatedEvent.name,
            data: new BoardCreatedEvent(
                boardId,
                command.title,
                command.description,
                {},
            ),
            metadata: {query},
        },
    ]

    await eventSaver.saveEvents(

        eventsToSave,
        -1,
        [],
        query,
    );

    return boardId;
}

export {createBoardRoute, CreateBoardCommand, createBoardCommandHandler};