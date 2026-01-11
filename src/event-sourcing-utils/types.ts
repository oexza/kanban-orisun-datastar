// Base Event Sourcing Types
export type EventData = {
    scope?: { [key: string]: any }
};

export interface DomainEvent<T = EventData> {
    eventId: string;
    eventType: string;
    metadata?: Record<string, any>;
    data: T;
}

export interface ResolvedDomainEvent<T = EventData> {
    position: Position;
    event: DomainEvent<T>;
}

export interface Position {
    commitPosition: number;
    preparePosition: number;
}

export interface Tag {
    key: string;
    value: string;
}

export interface Criterion {
    tags: Tag[];
}

export interface Query {
    criteria: Criterion[];
}

export interface WriteResult {
    logPosition: Position;
}

export const noEventPosition: Position = {
    commitPosition: -1,
    preparePosition: -1,
}

export const firstEventPosition: Position = {
    commitPosition: 0,
    preparePosition: 0,
}

export const lastEventPosition: Position = {
    commitPosition: Number.MAX_SAFE_INTEGER,
    preparePosition: Number.MAX_SAFE_INTEGER,
}

// Individual Event Store Method Interfaces
export interface EventSaver {
    saveEvents(events: DomainEvent[], expectedPosition: -1 | Position, scopeEvents: ResolvedDomainEvent[], streamSubQuery?: Query,): Promise<WriteResult>;
}

export interface EventRetriever {
    getEvents(fromPosition?: 0 | Position, count?: number, direction?: 'forward' | 'backward', query?: Query): Promise<ResolvedDomainEvent[]>;
}

export interface AllEventsRetriever {
    getAllEvents(fromPosition?: Position, count?: number, direction?: 'forward' | 'backward', query?: Query): Promise<ResolvedDomainEvent[]>;
}

export interface EventsSubscriber {
    subscribeToEvents(subscriberName: string,
                      callback: (event: ResolvedDomainEvent) => Promise<void>,
                      query?: Query,
                      fromPosition?: Position,
                      onError?: (error: Error) => void
    ): Promise<void>;
}

// Composite EventStore interface that extends all individual interfaces
export interface EventStore extends EventSaver, EventRetriever, AllEventsRetriever, EventsSubscriber {
}

// Event Handler Types
export interface EventHandler<T extends DomainEvent = DomainEvent> {
    handle(event: T): Promise<void>;
}

export interface EventBus {
    publish(event: DomainEvent): Promise<void>;

    subscribe<T extends DomainEvent>(eventType: string, handler: EventHandler<T>): void;
}

export interface EventHandlerCheckpointer {
    updateCheckpoint(eventHandlerName: string, lastProcessedPosition: Position): Promise<void>;

    getCheckpoint(eventHandlerName: string): Promise<Position | null>;
}

// Error Types
export class EventSourcingError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = 'EventSourcingError';
    }
}

export class DuplicateError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DuplicateError';
    }
    name = 'DuplicateError';
}

export class ConcurrencyError extends EventSourcingError {
    constructor(aggregateId: string, expectedVersion: number, actualVersion: number) {
        super(
            `Concurrency conflict for aggregate ${aggregateId}. Expected version ${expectedVersion}, but actual version is ${actualVersion}`,
            'CONCURRENCY_ERROR'
        );
    }
}

// pub sub types
export interface Publisher {
    publish(channel: string, event: any): Promise<void>;
}

export interface Subscriber {
    subscribe(channel: string, onMessage: (message: any) => void): Promise<Subscription>;
}

export interface Subscription {
    close(): Promise<void>;
}

// Comparison result enum
enum ComparationResult {
    IsLessThan = -1,
    IsEqual = 0,
    IsGreaterThan = 1,
}

// Compare two positions
function comparePositions(p1: Position, p2: Position): ComparationResult {
    if (p1.commitPosition === p2.commitPosition && p1.preparePosition === p2.preparePosition) {
        return ComparationResult.IsEqual;
    }

    if (
        p1.commitPosition < p2.commitPosition ||
        (p1.commitPosition === p2.commitPosition && p1.preparePosition < p2.preparePosition)
    ) {
        return ComparationResult.IsLessThan;
    }

    return ComparationResult.IsGreaterThan;
}

// Check if the new event position is greater than the last processed position
export function isThisNewerThanThat(thisPosition: Position, thatPosition: Position): boolean {
    return comparePositions(thisPosition, thatPosition) === ComparationResult.IsGreaterThan;
}