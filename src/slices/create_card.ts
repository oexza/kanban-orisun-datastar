import {HonoType} from "~/lib/api_types";
import {
    EventRetriever,
    EventSaver, isThisNewerThanThat,
    noEventPosition,
    Position,
    ResolvedDomainEvent
} from "~/event-sourcing-utils/types";
import {BoardCreatedEvent, BoardListCreated, CardCreatedEvent, } from "~/events/events";
import {logger} from "~/utils/logger";

function deepMerge<T>(target: T, source: Partial<T>): T {
    const result = {...target};

    for (const key in source) {
        if (source[key] !== undefined) {
            const targetValue = (result as any)[key];
            const sourceValue = source[key];

            if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
                (result as any)[key] = [...targetValue, ...sourceValue];
            } else if (
                typeof targetValue === 'object' &&
                targetValue !== null &&
                !Array.isArray(targetValue) &&
                typeof sourceValue === 'object' &&
                sourceValue !== null &&
                !Array.isArray(sourceValue)
            ) {
                (result as any)[key] = deepMerge(targetValue, sourceValue);
            } else {
                (result as any)[key] = sourceValue;
            }
        }
    }

    return result;
}

const createCardRoute = (
    honoApp: HonoType,
    eventSaver: EventSaver,
    eventsRetriever: EventRetriever
) => {
    return honoApp.post("/board/:boardId/card", async (c) => {
        const boardId = c.req.param("boardId");

        const formData = await c.req.formData();

        const title = (formData.get("title") as string).trim();
        const description = (formData.get("description") as string)?.trim() || null;
        const assigneeId = (formData.get("assigneeId") as string)?.trim() || null;
        const tagIds = formData.getAll("tagIds") as string[];

        await createCardCommandHandler(
            new CreateCardCommand(boardId, title, description, assigneeId, tagIds),
            eventSaver,
            eventsRetriever
        );

        return c.json("{}");
    });
}

export class CreateCardCommand {
    constructor(
        readonly boardId: string,
        readonly title: string,
        readonly description: string | null,
        readonly assigneeId: string | null,
        readonly tagIds: string[]
    ) {
    }
}

export const createCardCommandHandler = async (
    command: CreateCardCommand,
    eventSaver: EventSaver,
    eventsRetriever: EventRetriever,
) => {
    const query = {
        criteria: [
            {
                tags: [
                    {key: "eventType", value: BoardCreatedEvent.name},
                    {key: BoardCreatedEvent.boardCreatedId, value: command.boardId},
                ]
            },
            {
                tags: [
                    {key: "eventType", value: BoardListCreated.name},
                    {key: BoardListCreated.title, value: "Todo"},
                    {key: "scope.boardCreatedId", value: command.boardId}
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
                    {key: "eventType", value: CardCreatedEvent.name},
                    {key: "scope.boardListCreatedId", value: model.todoListId},
                ]
            },
        ]
    }

    const cardEvents = await eventsRetriever.getEvents(
        0,
        1000,
        'forward',
        cardPositionQuery,
    );

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
            data: new CardCreatedEvent(
                cardId,
                command.title,
                command.description,
                command.assigneeId,
                command.tagIds,
                highestPosition + 1,
                {
                    boardCreatedId: command.boardId,
                    boardListCreatedId: model.todoListId,
                }
            ),
            metadata: {query},
        },
    ]

    await eventSaver.saveEvents(
        eventsToSave,
        model.latestEventPosition,
        [...(events.map(value => value.event.data.scope ?? []))],
        deepMerge(query, cardPositionQuery),
    );

    return cardId;
}

class ContextModel {
    public boardCreatedId: string | null = null;
    public todoListId: string | null = null;
    public highestCardPosition: number = -1;
    public latestEventPosition: Position = noEventPosition;

    public handle(revent: ResolvedDomainEvent): ContextModel {
        const event = revent.event
        switch (event.eventType) {
            case BoardListCreated.name:
                const boardListCreatedEvent = event.data as BoardListCreated;
                this.todoListId = boardListCreatedEvent.boardListCreatedId;
                this.boardCreatedId = boardListCreatedEvent.scope.boardCreatedId;
                break
            case CardCreatedEvent.name:
                if (this.highestCardPosition < (event.data as CardCreatedEvent).position) {
                    this.highestCardPosition = (event.data as CardCreatedEvent).position;
                }
                break
            default:
                break
        }
        if (isThisNewerThanThat(revent.position, this.latestEventPosition)) {
            this.latestEventPosition = revent.position;
        }
        return this
    }
}

export {createCardRoute};