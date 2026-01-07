import {Hono,} from "hono";
import {sendKeepAlivePing} from "~/lib/datastar";
import {streamSSE} from "hono/streaming";
import {CookieStore, Session, sessionMiddleware} from "hono-sessions";
import {compression} from "~/lib/compression";
import {createBoardRoute} from "~/slices/create_board";
import {
    OrisunEventRetriever,
    OrisunEventSaver,
} from "~/event-sourcing-utils/orisun-event-sourcing";
import {createBoardsRoute} from "~/slices/boards_readmodel/boards_route";
import {NodePgDatabase} from "drizzle-orm/node-postgres";
import {createModuleLogger} from "~/utils/logger";
import {SessionDataTypes} from "~/lib/api_types";
import {Subscriber} from "~/event-sourcing-utils/types";
import {boardRoute} from "~/slices/board_read/board_route";
import {createCardRoute} from "~/slices/create_card";
import {updateCardRoute} from "~/slices/update_card";
import {deleteCardRoute} from "~/slices/delete_card";
import {addCommentRoute} from "~/slices/add_comment";
import {updateCardPositionRoute} from "~/slices/move_card";

const logger = createModuleLogger("routes");

const configureRoutes = (
    orisunEventRetriever: OrisunEventRetriever,
    orisunEventSaver: OrisunEventSaver,
    subscriber: Subscriber,
    db: NodePgDatabase
) => {
    const app = new Hono<{
        Variables: {
            session: Session<SessionDataTypes>;
            session_key_rotation: boolean;
        };
    }>({});

    app.use(compression);

    const session = sessionMiddleware({
        store: new CookieStore(),
        encryptionKey:
            process.env["SESSION_SECRET"] ?? "secret-key-that-should-be-very-secret",
        expireAfterSeconds: 60 * 60 * 24 * 90, // Expire session after 90 days of inactivity
        cookieOptions: {
            sameSite: "Lax", // Recommended for basic CSRF protection in modern browsers
            path: "/", // Required for this library to work properly
            httpOnly: true, // Recommended to avoid XSS attacks
        },
        sessionCookieName: "orisun-kanban-session",
    });
    app.use("*", async (c, next) => {
        // Don't give a session to the healthcheck
        if (c.req.path === "/health") {
            return next();
        }

        const response = await session(c, next);

        return response;
    });

    app.get("/static/*", async (c) => {
        const path = c.req.path.replace("/static/", "");
        const filePath = `./static/${path}`;
        const file = Bun.file(filePath);

        if (await file.exists()) {
            // Get the proper content type
            const ext = path.split(".").pop();
            const contentTypes: Record<string, string> = {
                css: "text/css",
                js: "application/javascript",
                png: "image/png",
                jpg: "image/jpeg",
                svg: "image/svg+xml",
                woff: "font/woff",
                woff2: "font/woff2",
            };

            return new Response(file, {
                headers: {
                    "Content-Type": contentTypes[ext || ""] || "application/octet-stream",
                },
            });
        }

        return c.notFound();
    });

    // Hot reload endpoint for development
    let isHotReloaded = false;
    app.get("/hotreload", (c) => {
        c.header('Content-Type', 'text/event-stream');
        c.header('Cache-Control', 'no-cache');
        c.header('Connection', 'keep-alive');

        return streamSSE(
            c,
            async (stream) => {
                if (!isHotReloaded) {
                    await stream.writeSSE({
                        event: "datastar-patch-elements",
                        data: `selector body\nmode append\nelements <script>window.location.reload()</script>`,
                    });
                    isHotReloaded = true;
                    console.log("Hot reload triggered");
                }

                let isAborted = false;
                stream.onAbort(() => {
                    isAborted = true;
                    console.log("Stream aborted");
                })
                await sendKeepAlivePing(stream)

                while (!isAborted) {
                    await new Promise((resolve) => setTimeout(resolve, 7000));
                    // await stream.sleep(1000)
                    await sendKeepAlivePing(stream)
                }
                console.log("Stream closed");
            },
            async (err) => {
                console.error(err);
            });
    });

    createBoardsRoute(app, db, subscriber);
    createBoardRoute(app, orisunEventSaver, orisunEventRetriever)
    boardRoute(app, orisunEventSaver, orisunEventRetriever, subscriber)
    createCardRoute(app, orisunEventSaver, orisunEventRetriever)
    updateCardRoute(app, orisunEventSaver, orisunEventRetriever)
    deleteCardRoute(app, orisunEventSaver, orisunEventRetriever)
    addCommentRoute(app, orisunEventSaver, orisunEventRetriever)
    updateCardPositionRoute(app, orisunEventSaver, orisunEventRetriever)

    return app
}

export {configureRoutes};
