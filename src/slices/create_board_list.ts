import {HonoType} from "~/lib/api_types";
import {DomainEvent, DuplicateError, EventRetriever, EventSaver} from "~/event-sourcing-utils/types";
import {BoardCreatedEvent, BoardListCreated, } from "~/events/events";

const createBoardRoute = (honoApp: HonoType, eventSaver: EventSaver, eventsRetriever: EventRetriever) => {
    return honoApp.post("/board", async (c) => {
        const formData = await c.req.formData();
        const title = (formData.get("title") as string).trim();
        const position = (formData.get("position") as unknown as number);
        const boardCreatedId = (formData.get("boardId") as string).trim();

        await createBoardListCommandHandler(
            new CreateBoardListCommand(
                boardCreatedId,
                title,
                position
            ),
            eventSaver,
            eventsRetriever
        );

        return c.json("{}");
    });
}

export class CreateBoardListCommand {
    constructor(readonly boardCreatedId: string, readonly title: string, readonly position: number) {
    }
}

export const createBoardListCommandHandler = async (command: CreateBoardListCommand, eventSaver: EventSaver, eventsRetriever: EventRetriever) => {
    const query = {
        criteria: [
            {
                tags: [
                    {key: "eventType", value: BoardCreatedEvent.name,},
                    {key: BoardCreatedEvent.boardCreatedId, value: command.boardCreatedId,},
                ]
            },
            {
                tags: [
                    {key: "eventType", value: BoardListCreated.name,},
                    {key: BoardListCreated.title, value: command.title,},
                    {key: "scope.boardCreatedId", value: command.boardCreatedId,}
                ]
            }
        ]
    }

    let events = await eventsRetriever.getEvents(

        0,
        2,
        'forward',
        query,
    )

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
            data: new BoardListCreated(
                eventId,
                command.title,
                command.position,
                {
                    boardCreatedId: command.boardCreatedId
                },
            ),
            metadata: {query},
        },
    ]

    await eventSaver.saveEvents(

        eventsToSave,
        events[events.length - 1]?.position,
        [...(events.map(value => value.event.data.scope ?? []))],
        query,
    );
}

class ContextModel {
    public boardCreatedId: string | null = null;
    public listExists: boolean = false;

    public handle(event: DomainEvent): ContextModel {
        switch (event.eventType) {
            case BoardCreatedEvent.name:
                const boardCreatedEvent = event.data as BoardCreatedEvent;
                this.boardCreatedId = boardCreatedEvent.boardCreatedId;
                break
            case BoardListCreated.name:
                this.listExists = true;
                break
            default:
                break
        }
        return this
    }
}