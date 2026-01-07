import {HonoType} from "~/lib/api_types";
import {
    CardCreatedEvent,
    CardDeletedEvent,
} from "~/events/events";
import {
    EventRetriever,
    EventSaver,
    noEventPosition,
    Position,
    ResolvedDomainEvent
} from "~/event-sourcing-utils/types";
import {randomUUIDv7} from "bun";

const deleteCardRoute = (
    honoApp: HonoType,
    eventSaver: EventSaver,
    eventsRetriever: EventRetriever
) => {
    return honoApp.delete("/board/:boardId/card/:cardId", async (c) => {
        const boardId = c.req.param("boardId");
        const cardId = c.req.param("cardId");

        await deleteCardCommandHandler(
            new DeleteCardCommand(boardId, cardId),
            eventSaver,
            eventsRetriever
        );

        return c.json("{}");
    });
}

export class DeleteCardCommand {
    constructor(
        readonly boardId: string,
        readonly cardId: string
    ) {
    }
}

export const deleteCardCommandHandler = async (
    command: DeleteCardCommand,
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
            },
            {
                tags: [
                    {key: "eventType", value: CardDeletedEvent.name},
                    {key: "scope.cardCreatedId", value: command.cardId},
                ]
            }
        ]
    }

    const events = await eventsRetriever.getEvents(

        0,
        2,
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

    if (model.deleted)
        throw new Error(`Deleted: ${model.deleted}`);

    const eventId = randomUUIDv7();
    const eventsToSave = [
        {
            eventId: eventId,
            eventType: CardDeletedEvent.name,
            data: new CardDeletedEvent(
                eventId,
                {
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
    public latestEventPosition: Position = noEventPosition;
    public deleted: boolean = false;

    public handle(revent: ResolvedDomainEvent): ContextModel {
        const event = revent.event

        switch (event.eventType) {
            case CardCreatedEvent.name:
                const cardCreatedEvent = event.data as CardCreatedEvent;
                this.cardId = cardCreatedEvent.cardCreatedId;
                this.boardCreatedId = cardCreatedEvent.scope.boardCreatedId
                break
            case CardDeletedEvent.name:
                const cardDeletedEvent = event.data as CardDeletedEvent;
                this.cardId = cardDeletedEvent.scope.cardCreatedId;
                this.boardCreatedId = cardDeletedEvent.scope.boardCreatedId
                this.deleted = true;
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

export {deleteCardRoute};