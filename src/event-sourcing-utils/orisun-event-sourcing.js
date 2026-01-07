import { createModuleLogger } from "~/utils/logger";
import { flatten, unflatten } from 'flat';
const logger = createModuleLogger("orisun-event-sourcing");
function constructStreamName(streamId, streamType) {
    return streamType + "---" + streamId;
}
class OrisunEventSaver {
    orisunClient;
    tenantId;
    constructor(orisunClient, tenantId) {
        this.orisunClient = orisunClient;
        this.tenantId = tenantId;
    }
    async saveEvents(streamId, streamType, events, expectedPosition, scopes, streamSubQuery, organizationId) {
        return await this.orisunClient.saveEvents({
            boundary: this.tenantId,
            stream: {
                name: constructStreamName(streamId, streamType),
                expectedPosition: expectedPosition === -1 ? {
                    preparePosition: -1,
                    commitPosition: -1
                } : expectedPosition,
                subsetQuery: streamSubQuery,
            },
            events: events.map(event => {
                if (scopes.length > 0) {
                    let existingScope = { ...event.data.scope };
                    for (const scope of scopes) {
                        event.data.scope = { ...event.data.scope, ...scope };
                    }
                    event.data.scope = { ...event.data.scope, ...existingScope };
                }
                return {
                    eventId: event.eventId,
                    eventType: event.eventType,
                    data: flatten(event.data),
                    metadata: { ...event.metadata, organization_id: organizationId },
                };
            }),
        });
    }
}
class OrisunEventRetriever {
    orisunClient;
    tenantId;
    constructor(orisunClient, tenantId) {
        this.orisunClient = orisunClient;
        this.tenantId = tenantId;
    }
    async getEvents(streamId, streamType, fromPosition, count = 100, direction = 'forward', streamSubQuery) {
        const res = await this.orisunClient.getEvents({
            boundary: this.tenantId,
            stream: {
                name: constructStreamName(streamId, streamType),
            },
            fromPosition: fromPosition === 0 ? { preparePosition: 0, commitPosition: 0 } : fromPosition,
            count: count,
            direction: direction === 'forward' ? 'ASC' : 'DESC',
            query: streamSubQuery,
        });
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
class OrisunEventsSubscriber {
    orisunClient;
    tenantId;
    constructor(orisunClient, tenantId) {
        this.orisunClient = orisunClient;
        this.tenantId = tenantId;
    }
    async subscribeToEvents(subscriberName, callback, query, stream, afterPosition, onError) {
        logger.info(`Subscribing to events with query ${JSON.stringify(query)} and afterPosition ${JSON.stringify(afterPosition)}`);
        this.orisunClient.subscribeToEvents({
            boundary: this.tenantId,
            query: query,
            afterPosition: afterPosition,
            subscriberName: subscriberName,
            stream: stream ? constructStreamName(stream.id, stream.type) : undefined,
        }, async (event) => {
            await callback({
                position: event.position,
                event: {
                    eventId: event.eventId,
                    eventType: event.eventType,
                    data: unflatten(event.data),
                    metadata: event.metadata,
                },
            });
        }, onError);
    }
}
export { OrisunEventSaver, OrisunEventRetriever, OrisunEventsSubscriber };
