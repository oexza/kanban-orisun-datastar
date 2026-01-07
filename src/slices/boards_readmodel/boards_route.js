import { IndexPage, LandingPage } from "~/components";
import { renderToString } from "hono/jsx/dom/server";
import { boards } from "../../../drizzle/schema";
import { desc } from "drizzle-orm";
import { createModuleLogger } from "~/utils/logger";
import { randomUUIDv7 } from "bun";
import { streamSSE } from "hono/streaming";
import { getBoardsChannelName } from "~/slices/boards_readmodel/boards_projection";
import { sendKeepAlivePing, ssePatch } from "~/lib/datastar";
const logger = createModuleLogger("boards-readmodel-route");
export const createBoardsRoute = (honoApp, db, subscriber) => {
    honoApp.get("/", async (c) => {
        const html = renderToString(IndexPage({ boards: [] }));
        function getSession() {
            const sessionx = c.get("session");
            if (!sessionx.get("session_id")) {
                sessionx.set("session_id", randomUUIDv7().replaceAll("-", ""));
            }
        }
        getSession();
        logger.debug(`route sid is ${c.get('session').get("session_id")}`);
        return c.html(html);
    });
    createBoardsSSERoute(honoApp, db, subscriber);
};
export const createBoardsSSERoute = (honoApp, db, subscriber) => {
    return honoApp.get("/sse", async (c) => {
        return streamSSE(c, async (stream) => {
            const boards = await getBoards(db);
            const session = getSession(c);
            const updatedHtml = renderToString(LandingPage(boards));
            await stream.writeSSE(ssePatch("#landingPage", updatedHtml));
            let subscription;
            try {
                subscription = await subscriber.subscribe(getBoardsChannelName(), async (data) => {
                    logger.debug(`SSE route received event data: ${JSON.stringify(data)}`);
                    const updatedBoards = await getBoards(db);
                    const updatedHtml = renderToString(LandingPage(updatedBoards));
                    await stream.writeSSE(ssePatch("#landingPage", updatedHtml));
                });
                let isAborted = false;
                stream.onAbort(() => {
                    isAborted = true;
                });
                await sendKeepAlivePing(stream);
                while (!isAborted && !stream.closed) {
                    await new Promise((resolve) => setTimeout(resolve, 7000));
                    // await stream.sleep(1000)
                    await sendKeepAlivePing(stream);
                }
            }
            finally {
                subscription?.close();
            }
        }, async (err) => {
            console.error(err);
        });
    });
};
function getSession(c) {
    const sessionx = c.get("session");
    if (!sessionx.get("session_id")) {
        sessionx.set("session_id", randomUUIDv7().replaceAll("-", ""));
    }
    return sessionx;
}
async function getBoards(db) {
    return db
        .select({
        id: boards.id,
        title: boards.title,
        description: boards.description,
    })
        .from(boards)
        .orderBy(desc(boards.createdAt));
}
