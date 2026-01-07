// Main Hono app entry point
import {Hono} from "hono";
import {logger as honoLogger} from "hono/logger";
import {configureRoutes} from "./routes";
import {PostgresEventHandlerCheckpointer} from "~/event-sourcing-utils/postgres-event-handler-checkpointer";
import {db, initializeDatabase} from "~/db";
import {BoardsProjectionEventHandler} from "~/slices/boards_readmodel/boards_projection";
import {
    OrisunEventsSubscriber,
    OrisunEventRetriever,
    OrisunEventSaver
} from '~/event-sourcing-utils/orisun-event-sourcing';
import {createNatsConnection} from "~/nats/nats";
import {Publisher, Subscriber, Subscription} from "~/event-sourcing-utils/types";
import {createModuleLogger} from "~/utils/logger";
import {orisunClient} from '~/event-sourcing-utils/orisun'
import {Subscription as NatsSubscription} from "@nats-io/transport-node";
import {TodoDefaultBoardListsToBeCreatedEventHandler} from "~/slices/TODO_default_board_lists_to_be_created";
import {BoardsListsProjectionEventHandler} from "~/slices/boards_lists_readmodel/boards_lists_projection";
import {CardsProjectionEventHandler} from "~/slices/card_readmodel/cards_projection";
import {CommentsProjectionEventHandler} from "~/slices/card_readmodel/comments_projection";

await orisunClient.healthCheck().catch(reason => process.exit(reason));

const logger = createModuleLogger("main");

const server = new Hono();

const port = process.env.PORT || 3000;
const ORISUN_BOUNDARY = process.env.ORISUN_BOUNDARY || "";

async function startServer() {
    // Initialize database
    await initializeDatabase();

    // Initialize NATS connection
    const nc = await createNatsConnection();

    // Initialize checkpointer
    new PostgresEventHandlerCheckpointer(db);

    // Initialize event store client, subscriber, retriever and saver
    const orisunEventsSubscriber = new OrisunEventsSubscriber(orisunClient, ORISUN_BOUNDARY);
    const orisunEventRetriever = new OrisunEventRetriever(orisunClient, ORISUN_BOUNDARY);
    const orisunEventSaver = new OrisunEventSaver(orisunClient, ORISUN_BOUNDARY);

    // create nats publisher
    const natsPulisher: Publisher = {
        publish: async (subject: string, data: any) => {
            const stringData = JSON.stringify(data)

            nc.publish(subject, stringData);

            if (logger.isDebugEnabled()) {
                logger.debug(`published event ${stringData} for subject: ${subject}`);
            }
        }
    };

    // create nats subscriber
    const natsSubscriber: Subscriber = {
        subscribe: (subject: string, onMessage: (data: any) => void): Promise<Subscription> => {
            let sub: NatsSubscription

            function doSubscribe() {
                sub = nc.subscribe(subject);
                (async () => {
                    for await (const msg of sub) {
                        const data = JSON.parse(new TextDecoder().decode(msg.data));
                        onMessage(data);
                        if (logger.isDebugEnabled()) {
                            logger.debug(`received event ${JSON.stringify(data)} for subject: ${subject}`);
                        }
                    }
                })().catch(reason => {
                    logger.error(reason);
                    sub = doSubscribe()
                });
                return sub;
            }

            doSubscribe()

            return Promise.resolve({
                close: async () => {
                    if (logger.isDebugEnabled()) {
                        logger.debug(`unsubscribed from subject: ${subject}`);
                    }
                    sub.unsubscribe()
                }
            })
        }
    };

    await startProjections(orisunEventRetriever, orisunEventSaver, orisunEventsSubscriber, natsPulisher);

    // Add logger middleware
    server.use("*", honoLogger());

    // Mount routes
    server.route("/", configureRoutes(orisunEventRetriever, orisunEventSaver, natsSubscriber, db));

    console.log(`Starting server on http://localhost:${port}`);
}

async function startProjections(orisunEventRetriever: OrisunEventRetriever,
                                orisunEventSaver: OrisunEventSaver,
                                orisunEventsSubscriber: OrisunEventsSubscriber,
                                natsPulisher: Publisher) {
    const checkpointer = new PostgresEventHandlerCheckpointer(db)

    const boardsProjection = new BoardsProjectionEventHandler(
        orisunEventsSubscriber,
        checkpointer,
        natsPulisher,
        db
    );
    await boardsProjection.startSubscribing();

    const defaultBoardListsProjectionEventHandler = new TodoDefaultBoardListsToBeCreatedEventHandler(
        orisunEventsSubscriber,
        checkpointer,
        orisunEventRetriever,
        orisunEventSaver,
    );
    await defaultBoardListsProjectionEventHandler.startSubscribing();

    const boardsListsProjectionEventHandler = new BoardsListsProjectionEventHandler(
        orisunEventsSubscriber,
        checkpointer,
        natsPulisher,
        db,
    );
    await boardsListsProjectionEventHandler.startSubscribing();

    const cardsEventHandler = new CardsProjectionEventHandler(
        orisunEventsSubscriber,
        checkpointer,
        natsPulisher,
        db,
    );
    await cardsEventHandler.startSubscribing();

    const commentsProjectionEventHandler = new CommentsProjectionEventHandler(
        orisunEventsSubscriber,
        checkpointer,
        natsPulisher,
        db,
    );
    await commentsProjectionEventHandler.startSubscribing();
}

startServer().catch(reason => {
    console.error("Failed to start server:", reason);
    process.exit(1);
})

export default {
    port,
    fetch: server.fetch,
};
