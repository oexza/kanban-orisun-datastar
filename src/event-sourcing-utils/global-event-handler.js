import { createModuleLogger, logError } from "~/utils/logger";
const logger = createModuleLogger('global-event-handler');
export class GlobalEventHandler {
    eventsSubscriber;
    eventHandlerCheckpointer;
    name;
    maxEventRetries;
    handleEvent;
    query;
    stream;
    isSubscribing = false;
    baseEventRetryDelay = 1000; // 1 second
    baseCheckpointRetryDelay = 500; // 0.5 seconds
    subscriptionRetryTimeout = null;
    constructor(eventsSubscriber, eventHandlerCheckpointer, name, maxEventRetries = -1, handleEvent, query, stream) {
        this.eventsSubscriber = eventsSubscriber;
        this.eventHandlerCheckpointer = eventHandlerCheckpointer;
        this.name = name;
        this.maxEventRetries = maxEventRetries;
        this.handleEvent = handleEvent;
        this.query = query;
        this.stream = stream;
        if (this.maxEventRetries < -1) {
            throw new Error("maxEventRetries must be -1 (infinite) or a positive integer");
        }
        if (!name) {
            throw new Error("name is required");
        }
    }
    async retryCheckpointUpdate(eventHandlerName, position, retryCount = 0) {
        try {
            await this.eventHandlerCheckpointer.updateCheckpoint(eventHandlerName, position);
        }
        catch (error) {
            logError(logger, error, {
                context: 'checkpoint-update',
                eventHandlerName,
                position,
                retryCount
            });
            // Calculate delay with exponential backoff and jitter for checkpoint
            const baseDelay = this.baseCheckpointRetryDelay * Math.pow(2, retryCount);
            const jitter = Math.random() * 500; // 0-0.5s jitter
            const delay = Math.min(baseDelay + jitter, 10000); // Max 10 seconds
            logger.info(`${this.name} retrying checkpoint update in ${Math.round(delay)}ms (attempt ${retryCount + 2})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.retryCheckpointUpdate(eventHandlerName, position, retryCount + 1);
        }
    }
    async retryEventProcessing(event, retryCount = 0) {
        try {
            // Process the event
            await this.handleEvent(event);
            logger.info({
                eventId: event.event.eventId,
                eventType: event.event.eventType,
                retryCount,
                success: true
            }, `${this.name} successfully processed event ${event.event.eventId}`);
        }
        catch (error) {
            logError(logger, error, {
                context: 'event-processing',
                eventId: event.event.eventId,
                eventType: event.event.eventType,
                retryCount,
                maxRetries: this.maxEventRetries
            });
            if (this.maxEventRetries == -1 || retryCount < this.maxEventRetries - 1) {
                // Calculate delay with exponential backoff and jitter
                const baseDelay = this.baseEventRetryDelay * Math.pow(2, retryCount);
                const jitter = Math.random() * 1000; // 0-1s jitter
                const delay = Math.min(baseDelay + jitter, 30000); // Max 30 seconds
                logger.info({
                    eventId: event.event.eventId,
                    eventType: event.event.eventType,
                    retryCount,
                    maxRetries: this.maxEventRetries,
                    delay: Math.round(delay)
                }, `${this.name} retrying event processing in ${Math.round(delay)}ms (attempt ${retryCount + 2}/${this.maxEventRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.retryEventProcessing(event, retryCount + 1);
            }
            else {
                logError(logger, error, {
                    context: 'event-processing',
                    eventId: event.event.eventId,
                    eventType: event.event.eventType,
                    retryCount,
                    maxRetries: this.maxEventRetries
                });
                throw error;
            }
        }
    }
    async processEvent(event) {
        // First, retry event processing until successful
        await this.retryEventProcessing(event);
        // Then, separately retry checkpoint update until successful
        await this.retryCheckpointUpdate(this.name, event.position);
        logger.info(`${this.name} successfully processed and checkpointed event ${event.event.eventId}`);
    }
    async startSubscribing() {
        if (this.isSubscribing) {
            logger.info(`${this.name} is already subscribing, skipping duplicate subscription attempt`);
            return;
        }
        const lastPosition = async () => await this.eventHandlerCheckpointer.getCheckpoint(this.name) || {
            commitPosition: 0,
            preparePosition: 0
        };
        logger.info({ lastPosition }, `Starting subscription from position:`);
        const subscribeWithRetry = async (retryCount = 0) => {
            if (this.isSubscribing) {
                logger.info(`${this.name} subscription already in progress, aborting retry attempt`);
                return;
            }
            this.isSubscribing = true;
            try {
                logger.info(`${this.name} attempting subscription (attempt ${retryCount + 1})`);
                await this.eventsSubscriber.subscribeToEvents(this.name, async (event) => {
                    await this.processEvent(event);
                }, this.query, this.stream, await lastPosition(), (error) => {
                    logError(logger, error, {
                        context: 'subscription',
                        eventHandlerName: this.name,
                        message: `Unhandled subscription error: ${this.name}:`
                    });
                    this.isSubscribing = false;
                    // Add jitter to prevent thundering herd
                    const baseDelay = Math.min(5000 * Math.pow(2, retryCount), 60000); // 5s, 10s, 20s, max 60s
                    const jitter = Math.random() * 2000; // 0-2s jitter
                    const delay = baseDelay + jitter;
                    logger.info(`${this.name} scheduling retry in ${Math.round(delay)}ms (attempt ${retryCount + 2}/4)`);
                    this.subscriptionRetryTimeout = setTimeout(() => {
                        this.subscriptionRetryTimeout = null;
                        subscribeWithRetry(retryCount + 1);
                    }, delay);
                });
                logger.info(`${this.name} subscription established successfully`);
            }
            catch (error) {
                logError(logger, error, {
                    context: 'subscription-setup',
                    eventHandlerName: this.name,
                    message: `${this.name} subscription setup error:`
                });
                this.isSubscribing = false;
                if (retryCount < 3) {
                    const baseDelay = Math.min(5000 * Math.pow(2, retryCount), 60000);
                    const jitter = Math.random() * 2000;
                    const delay = baseDelay + jitter;
                    logger.info(`${this.name} retrying subscription in ${Math.round(delay)}ms (attempt ${retryCount + 2}/4)`);
                    this.subscriptionRetryTimeout = setTimeout(() => {
                        this.subscriptionRetryTimeout = null;
                        subscribeWithRetry(retryCount + 1);
                    }, delay);
                }
                else {
                    logError(logger, error, {
                        context: 'subscription-setup',
                        eventHandlerName: this.name,
                        message: `${this.name} max retry attempts reached. Subscription failed.`
                    });
                    throw error;
                }
            }
        };
        await subscribeWithRetry();
    }
    stopSubscribing() {
        logger.info(`${this.name} stopping subscription`);
        this.isSubscribing = false;
        if (this.subscriptionRetryTimeout) {
            clearTimeout(this.subscriptionRetryTimeout);
            this.subscriptionRetryTimeout = null;
        }
    }
}
