import {HonoType} from "~/lib/api_types";
import {
    BoardCreatedEvent,
    BoardListCreated,
    CardCreatedEvent,
    CardMovedEvent,
    CardUpdatedEvent,
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
import {createModuleLogger} from "~/utils/logger";

const logger = createModuleLogger('move-card-slice');

const updateCardPositionRoute = (
    honoApp: HonoType,
    eventSaver: EventSaver,
    eventsRetriever: EventRetriever
) => {
    return honoApp.put("/board/:boardId/card/:cardId/position", async (c) => {
        const boardId = c.req.param("boardId");
        const movedCardId = c.req.param("cardId");

        const body = await c.req.json();
        const listId = body.listId.trim();
        const cardIds = body.cardIds as string[];

        await updateCardPositionCommandHandler(
            new UpdateCardPositionCommand(movedCardId, boardId, listId, cardIds),
            eventSaver,
            eventsRetriever
        );

        return c.json("{}");
    });
}

export class UpdateCardPositionCommand {
    constructor(
        readonly movedCardId: string,
        readonly boardId: string,
        readonly listId: string,
        readonly cardIds: string[]
    ) {
    }
}

export const updateCardPositionCommandHandler = async (
    command: UpdateCardPositionCommand,
    eventSaver: EventSaver,
    eventsRetriever: EventRetriever,
) => {
    // Query to find the target list and validate the board exists
    const query = {
        criteria: [
            {
                tags: [
                    {key: "eventType", value: CardCreatedEvent.name},
                    {key: CardCreatedEvent.cardCreatedId, value: command.movedCardId},
                    {key: "scope.boardCreatedId", value: command.boardId},
                ]
            },
            {
                tags: [
                    {key: "eventType", value: BoardListCreated.name},
                    {key: BoardListCreated.boardListCreatedId, value: command.listId},
                    {key: "scope.boardCreatedId", value: command.boardId},
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

    if (!model.movedCardCreatedId) {
        throw new Error(`List with id ${command.movedCardId} does not exist.`);
    }

    if (!model.listId) {
        throw new Error(`Board with id ${command.boardId} does not exist.`);
    }

    // Create CardMovedEvent for each card
    const eventsToSave = command.cardIds.map((cardId, index) => ({
        eventId: randomUUIDv7(),
        eventType: CardMovedEvent.name,
        data: new CardMovedEvent(
            randomUUIDv7(),
            index,
            {
                boardListCreatedId: command.listId,
                cardCreatedId: cardId,
                cardMovedByCardCreatedId: model.movedCardCreatedId!,
            }
        ),
        metadata: {query},
    }));

    await eventSaver.saveEvents(
        eventsToSave,
        model.latestEventPosition,
        [
            ...(events.map(value => {

                        delete value.event.data.scope?.boardListCreatedId
                        return value.event.data.scope ?? {};
                    }
                )
            )
        ],
        query,
    );

    return command.cardIds;
}

class ContextModel {
    public boardCreatedId: string | null = null;
    public listId: string | null = null;
    public movedCardCreatedId: string | null = null;
    public latestEventPosition: Position = noEventPosition;

    public handle(revent: ResolvedDomainEvent): ContextModel {
        const event = revent.event

        switch (event.eventType) {
            case CardCreatedEvent.name:
                const cardCreatedEvent = event.data as CardCreatedEvent;
                this.boardCreatedId = cardCreatedEvent.scope.boardCreatedId
                this.listId = cardCreatedEvent.scope.boardListCreatedId
                this.movedCardCreatedId = cardCreatedEvent.cardCreatedId
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

export {updateCardPositionRoute};