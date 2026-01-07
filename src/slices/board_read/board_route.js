import { getBoard, getTags, getUsers } from "~/db/api";
import { Board, BoardPage } from "~/components/board";
import { sendKeepAlivePing, ssePatch } from "~/lib/datastar";
import { streamSSE } from "hono/streaming";
import { renderToString } from "hono/jsx/dom/server";
import { LandingPage } from "~/components";
import { getBoardsChannelName } from "~/slices/boards_readmodel/boards_projection";
import { createModuleLogger } from "~/utils/logger";
const logger = createModuleLogger("board_route");
export const boardRoute = (honoApp, eventSaver, eventsRetriever) => {
    honoApp.get("/board/:boardId", async (c) => {
        const boardId = c.req.param("boardId");
        const board = await getBoard(boardId);
        if (!board) {
            return c.notFound();
        }
        const users = await getUsers();
        const tags = await getTags();
        // Check if this is a Datastar request (e.g., from @get() in drop event)
        const isDatastarRequest = c.req.header("Datastar-Request") === "true";
        if (isDatastarRequest) {
            // Return SSE patch for body morphing
            const html = renderToString(Board({ board, users, tags }));
            return streamSSE(c, async (stream) => {
                await stream.writeSSE(ssePatch("#board-app", html));
            });
        }
        // Return full HTML page for regular navigation
        const html = renderToString(BoardPage({
            board: {
                description: "",
                lists: [],
                title: "",
                id: boardId,
            }, users, tags
        }));
        return c.html(html);
    });
};
export const createBoardsSSERoute = (honoApp, db, subscriber) => {
    return honoApp.get("/board/:boardId/sse", async (c) => {
        return streamSSE(c, async (stream) => {
            const boardId = c.req.param("boardId");
            const board = (await getBoard(boardId));
            const users = await getUsers();
            const tags = await getTags();
            const html = renderToString(Board({ board, users, tags }));
            await stream.writeSSE(ssePatch("#board-app", html));
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
