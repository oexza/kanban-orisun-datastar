import {HonoType} from "~/lib/api_types";
import {
    BoardCreatedEvent,
    CardCreatedEvent,
    CardUpdatedEvent,
    CardDeletedEvent,
    CommentAddedToCardEvent,
    
} from "~/events/events";
import {
    EventRetriever,
    EventSaver,
    noEventPosition,
    Position,
    ResolvedDomainEvent
} from "~/event-sourcing-utils/types";
import {randomUUIDv7} from "bun";

const addCommentRoute = (
    honoApp: HonoType,
    eventSaver: EventSaver,
    eventsRetriever: EventRetriever
) => {
    return honoApp.post("/board/:boardId/card/:cardId/comment", async (c) => {
        const boardId = c.req.param("boardId");
        const cardId = c.req.param("cardId");

        const formData = await c.req.formData();

        const userId = (formData.get("userId") as string).trim();
        const text = (formData.get("text") as string).trim();

        await addCommentCommandHandler(
            new AddCommentCommand(boardId, cardId, userId, text),
            eventSaver,
            eventsRetriever
        );

        return c.json("{}");
    });
}

export class AddCommentCommand {
    constructor(
        readonly boardId: string,
        readonly cardId: string,
        readonly userId: string,
        readonly text: string
    ) {
    }
}

export const addCommentCommandHandler = async (
    command: AddCommentCommand,
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
            eventType: CommentAddedToCardEvent.name,
            data: new CommentAddedToCardEvent(
                eventId,
                command.text,
                command.userId,
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

    return eventId;
}

class ContextModel {
    public cardId: string | null = null;
    public latestEventPosition: Position = noEventPosition;

    public handle(revent: ResolvedDomainEvent): ContextModel {
        const event = revent.event

        switch (event.eventType) {
            case CardCreatedEvent.name:
                const cardCreatedEvent = event.data as CardCreatedEvent;
                this.cardId = cardCreatedEvent.cardCreatedId;
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

export {addCommentRoute};