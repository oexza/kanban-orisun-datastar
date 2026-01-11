import {getBoard, getTags, getUsers} from "~/db/api";
import {Board, BoardPage} from "~/components/board";
import {sendKeepAlivePing, ssePatch} from "~/lib/datastar";
import {HonoType} from "~/lib/api_types";
import {EventRetriever, EventSaver, Subscriber, Subscription} from "~/event-sourcing-utils/types";
import {streamSSE} from "hono/streaming";
import {renderToString} from "hono/jsx/dom/server";
import {getBoardChannelName} from "~/slices/boards_readmodel/boards_projection";
import {createModuleLogger} from "~/utils/logger";
import {getBoardCardChannelName} from "~/slices/card_readmodel/cards_projection";

const logger = createModuleLogger("board_route");

export const boardRoute = (honoApp: HonoType, eventSaver: EventSaver, eventsRetriever: EventRetriever, subscriber: Subscriber) => {
    honoApp.get("/board/:boardId", async (c) => {
        const boardId = c.req.param("boardId");

        // Return shell page
        const html = renderToString(BoardPage({
            board: {
                description: "",
                lists: [],
                title: "",
                id: boardId,
            }, users: [], tags: []
        }));
        return c.html(html);
    });

    async function getBoardHTML(boardId: string) {
        const board = (await getBoard(boardId))!;
        const users = await getUsers();
        const tags = await getTags();
        return renderToString(Board({board, users, tags}));
    }

    honoApp.get("/board/:boardId/sse", async (c) => {
        return streamSSE(
            c,
            async (stream) => {
                const boardId = c.req.param("boardId");
                const html = await getBoardHTML(boardId);

                await stream.writeSSE(ssePatch("#board-app", html));

                let boardSubscription: Subscription | undefined
                let boardCardSubscription: Subscription | undefined
                try {
                    boardSubscription = await subscriber.subscribe(
                        getBoardChannelName(boardId),
                        async (data: any) => {
                            if (logger.isDebugEnabled())
                                logger.debug(`SSE route received event data: ${JSON.stringify(data)}`);
                            const updatedHtml = await getBoardHTML(boardId);

                            await stream.writeSSE(ssePatch("#board-app", updatedHtml));

                        }
                    )

                    boardCardSubscription = await subscriber.subscribe(
                        getBoardCardChannelName(boardId),
                        async (data: any) => {
                            if (logger.isDebugEnabled())
                                logger.debug(`SSE route received event data: ${JSON.stringify(data)}`);
                            const updatedHtml = await getBoardHTML(boardId);

                            await stream.writeSSE(ssePatch("#board-app", updatedHtml));

                        }
                    )


                    let isAborted = false;
                    stream.onAbort(() => {
                        isAborted = true;
                    })

                    await sendKeepAlivePing(stream)

                    while (!isAborted && !stream.closed) {
                        await new Promise((resolve) => setTimeout(resolve, 7000));
                        // await stream.sleep(1000)
                        await sendKeepAlivePing(stream)
                    }
                } finally {
                    boardSubscription?.close()
                    boardCardSubscription?.close()
                }
            },
            async (err) => {
                console.error(err);
            }
        )
    });
}