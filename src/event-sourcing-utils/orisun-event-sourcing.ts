import EventStoreClient, {WriteResult} from "@orisun/eventstore-client";
import {
    DomainEvent,
    EventRetriever,
    EventSaver,
    EventsSubscriber,
    Position,
    Query,
    ResolvedDomainEvent
} from "./types";
import {createModuleLogger} from "~/utils/logger";
import {flatten, unflatten} from 'flat'

const logger = createModuleLogger("orisun-event-sourcing");

class OrisunEventSaver implements EventSaver {
    private tenantId: string;

    constructor(private orisunClient: EventStoreClient, tenantId: string) {
        this.tenantId = tenantId;
    }

    async saveEvents(events: DomainEvent[], expectedPosition: -1 | Position, scopeEvents: ResolvedDomainEvent[],
                     streamSubQuery?: Query, organizationId?: string): Promise<WriteResult> {
        // Sort scopeEvents by position to ensure deterministic scope merging
        const sortedScopeEvents = [...scopeEvents].sort((a, b) => {
            if (a.position.commitPosition !== b.position.commitPosition) {
                return a.position.commitPosition - b.position.commitPosition;
            }
            return a.position.preparePosition - b.position.preparePosition;
        });

        return await this.orisunClient.saveEvents(
            {
                boundary: this.tenantId,
                query: {
                    expectedPosition: expectedPosition === -1 ? {
                        preparePosition: -1,
                        commitPosition: -1
                    } : expectedPosition,
                    subsetQuery: streamSubQuery,
                },
                events: events
                    .map(event => {
                        if (sortedScopeEvents.length > 0) {
                            const seenKeys = new Set(Object.keys(event.data.scope || {}));

                            for (const resolvedScopeEvent of sortedScopeEvents) {
                                const scopeEvent = resolvedScopeEvent.event;
                                const scope = scopeEvent.data.scope || {};
                                for (const key of Object.keys(scope)) {
                                    const existingValue = event.data.scope?.[key];
                                    const newValue = scope[key];

                                    if (seenKeys.has(key) && newValue !== existingValue) {
                                        throw new Error(
                                            `Scope conflict: field "${key}" is defined with conflicting values.\n` +
                                            `  Target Event: ${event.eventType} (ID: ${event.eventId})\n` +
                                            `  Scope Event: ${scopeEvent.eventType} (ID: ${scopeEvent.eventId}, Position: ${resolvedScopeEvent.position.commitPosition}/${resolvedScopeEvent.position.preparePosition})\n` +
                                            `  Field: "${key}"\n` +
                                            `  Existing value: ${JSON.stringify(existingValue)}\n` +
                                            `  Conflicting value: ${JSON.stringify(newValue)}`
                                        );
                                    }
                                    seenKeys.add(key);
                                }
                                event.data.scope = {...event.data.scope, ...scope};
                            }
                        }
                        return {
                            eventId: event.eventId,
                            eventType: event.eventType,
                            data: flatten(event.data),
                            metadata: {...event.metadata, organization_id: organizationId},
                        }
                    }),
            }
        );
    }
}

class OrisunEventRetriever implements EventRetriever {
    private tenantId: string;

    constructor(private orisunClient: EventStoreClient, tenantId: string) {
        this.tenantId = tenantId;
    }

    async getEvents(fromPosition?: 0 | Position, count: number = 100,
                    direction: 'forward' | 'backward' = 'forward', streamSubQuery?: Query): Promise<ResolvedDomainEvent[]> {
        const res = await this.orisunClient.getEvents(
            {
                boundary: this.tenantId,
                fromPosition: fromPosition === 0 ? {preparePosition: 0, commitPosition: 0} : fromPosition,
                count: count,
                direction: direction === 'forward' ? 'ASC' : 'DESC',
                query: streamSubQuery,
            }
        );

        return res.map(event => ({
            position: event.position,
            event: {
                eventId: event.eventId,
                eventType: event.eventType,
                data: unflatten(event.data),
                metadata: event.metadata,
            },
        }));
    }
}

class OrisunEventsSubscriber implements EventsSubscriber {
    private tenantId: string;

    constructor(private orisunClient: EventStoreClient, tenantId: string) {
        this.tenantId = tenantId;
    }

    async subscribeToEvents(subscriberName: string, callback: (event: ResolvedDomainEvent) => Promise<void>,
                            query?: Query, afterPosition?: Position, onError?: (error: Error) => void) {
        logger.info(`Subscribing to events with query ${JSON.stringify(query)} and afterPosition ${JSON.stringify(afterPosition)}`);

        this.orisunClient.subscribeToEvents(
            {
                boundary: this.tenantId,
                query: query,
                afterPosition: afterPosition,
                subscriberName: subscriberName,
            },
            async (event) => {
                await callback({
                    position: event.position,
                    event: {
                        eventId: event.eventId,
                        eventType: event.eventType,
                        data: unflatten(event.data),
                        metadata: event.metadata,
                    },
                });
            },
            onError
        );
    }
}

export {OrisunEventSaver, OrisunEventRetriever, OrisunEventsSubscriber};
