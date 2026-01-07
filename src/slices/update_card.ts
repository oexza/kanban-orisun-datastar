import {HonoType} from "~/lib/api_types";
import {
    BoardCreatedEvent,
    BoardListCreated,
    CardCreatedEvent,
    CardUpdatedEvent,
    
} from "~/events/events";
import {
    EventRetriever,
    EventSaver,
    noEventPosition,
    Position,
    ResolvedDomainEvent
} from "~/event-sourcing-utils/types";
import {randomUUIDv7} from "bun";

const updateCardRoute = (
    honoApp: HonoType,
    eventSaver: EventSaver,
    eventsRetriever: EventRetriever
) => {
    return honoApp.post("/board/:boardId/card/:cardId", async (c) => {
        const boardId = c.req.param("boardId");
        const cardId = c.req.param("cardId");

        const formData = await c.req.formData();

        const title = (formData.get("title") as string).trim();
        const description = (formData.get("description") as string)?.trim() || null;
        const assigneeId = (formData.get("assigneeId") as string)?.trim() || null;
        const tagIds = formData.getAll("tagIds") as string[];

        await updateCardCommandHandler(
            new UpdateCardCommand(boardId, cardId, title, description, assigneeId, tagIds),
            eventSaver,
            eventsRetriever
        );

        return c.json("{}");
    });
}

export class UpdateCardCommand {
    constructor(
        readonly boardId: string,
        readonly cardId: string,
        readonly title: string,
        readonly description: string | null,
        readonly assigneeId: string | null,
        readonly tagIds: string[]
    ) {
    }
}

export const updateCardCommandHandler = async (
    command: UpdateCardCommand,
    eventSaver: EventSaver,
    eventsRetriever: EventRetriever,
) => {
    const query = {
        criteria: [
            {
                tags: [
                    {key: "eventType", value: CardCreatedEvent.name},
                    {key: CardCreatedEvent.cardCreatedId, value: command.cardId},
                ]
            }
        ]
    }

    const events = await eventsRetriever.getEvents(

        0,
        1,
        'forward',
        query,
    )

    const model = new ContextModel();
    for (const event of events) {
        model.handle(event);
    }

    if (!model.cardId) {
        throw new Error(`Card with id ${command.cardId} does not exist.`);
    }

    const eventId = randomUUIDv7();
    const eventsToSave = [
        {
            eventId: eventId,
            eventType: CardUpdatedEvent.name,
            data: new CardUpdatedEvent(
                eventId,
                command.title,
                command.description,
                command.assigneeId,
                command.tagIds,
                {
                    boardListCreatedId: model.listId!,
                    cardCreatedId: model.cardId,
                }
            ),
            metadata: {query},
        },
    ]

    await eventSaver.saveEvents(

        eventsToSave,
        model.latestEventPosition,
        [...(events.map(value => value.event.data.scope ?? []))],
        query,
    );

    return command.cardId;
}

class ContextModel {
    public boardCreatedId: string | null = null;
    public cardId: string | null = null;
    public listId: string | null = null;
    public latestEventPosition: Position = noEventPosition;

    public handle(revent: ResolvedDomainEvent): ContextModel {
        const event = revent.event

        switch (event.eventType) {
            case CardCreatedEvent.name:
                const cardCreatedEvent = event.data as CardCreatedEvent;
                this.cardId = cardCreatedEvent.cardCreatedId;
                this.listId = cardCreatedEvent.scope.boardListCreatedId;
                this.boardCreatedId = cardCreatedEvent.scope.boardCreatedId
                break
            default:
                break
        }

        if (this.latestEventPosition.commitPosition < revent.position.commitPosition) {
            this.latestEventPosition = revent.position;
        }

        return this
    }
}

export {updateCardRoute};