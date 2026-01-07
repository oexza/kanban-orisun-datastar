import { Hono } from "hono";
import { Board } from "../components/board";
import { ssePatch, sendKeepAlivePing } from "../lib/datastar";
import { renderToString } from "hono/jsx/dom/server";
import { getBoard, getUsers, getTags, createCard as dbCreateCard, updateCard as dbUpdateCard, deleteCard as dbDeleteCard, addComment as dbAddComment, updateCardPositions as dbUpdateCardPositions, } from "../db/api";
import { streamSSE } from "hono/streaming";
import { CookieStore, sessionMiddleware } from "hono-sessions";
import { compression } from "~/lib/compression";
import { createBoardRoute } from "~/slices/create_board";
import { createBoardsRoute } from "~/slices/boards_readmodel/boards_route";
import { createModuleLogger } from "~/utils/logger";
import { boardRoute } from "~/slices/board_read/board_route";
import { createCardRoute } from "~/slices/create_card";
const logger = createModuleLogger("routes");
const configureRoutes = (orisunEventRetriever, orisunEventSaver, subscriber, db) => {
    const app = new Hono({});
    app.use(compression);
    const session = sessionMiddleware({
        store: new CookieStore(),
        encryptionKey: process.env["SESSION_SECRET"] ?? "secret-key-that-should-be-very-secret",
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
            const contentTypes = {
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
        return streamSSE(c, async (stream) => {
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
            });
            await sendKeepAlivePing(stream);
            while (!isAborted) {
                await new Promise((resolve) => setTimeout(resolve, 7000));
                // await stream.sleep(1000)
                await sendKeepAlivePing(stream);
            }
            console.log("Stream closed");
        }, async (err) => {
            console.error(err);
        });
    });
    createBoardsRoute(app, db, subscriber);
    createBoardRoute(app, orisunEventSaver, orisunEventRetriever);
    boardRoute(app, orisunEventSaver, orisunEventRetriever);
    createCardRoute(app, orisunEventSaver, orisunEventRetriever);
    app.post("/board/:boardId/card", async (c) => {
        const boardId = c.req.param("boardId");
        const board = await getBoard(boardId);
        if (!board) {
            return c.notFound();
        }
        const formData = await c.req.formData();
        const title = formData.get("title").trim();
        const description = formData.get("description")?.trim() || null;
        const assigneeId = formData.get("assigneeId")?.trim() || null;
        const tagIds = formData.getAll("tagIds");
        await dbCreateCard({
            boardId,
            title,
            description,
            assigneeId,
            tagIds,
        });
        // Re-fetch board to get the newly created card
        const updatedBoard = (await getBoard(boardId));
        const users = await getUsers();
        const tags = await getTags();
        const html = renderToString(Board({ board: updatedBoard, users, tags }));
        return streamSSE(c, async (stream) => {
            await stream.writeSSE(ssePatch("#board-app", html));
        });
    });
    app.post("/board/:boardId/card/:cardId", async (c) => {
        const boardId = c.req.param("boardId");
        const cardId = c.req.param("cardId");
        const board = await getBoard(boardId);
        if (!board) {
            return c.notFound();
        }
        const formData = await c.req.formData();
        const title = formData.get("title").trim();
        const description = formData.get("description")?.trim() || null;
        const assigneeId = formData.get("assigneeId")?.trim() || null;
        const tagIds = formData.getAll("tagIds");
        await dbUpdateCard({
            cardId,
            title,
            description,
            assigneeId,
            tagIds,
        });
        // Re-fetch board to get the updated card
        const updatedBoard = (await getBoard(boardId));
        const users = await getUsers();
        const tags = await getTags();
        const html = renderToString(Board({ board: updatedBoard, users, tags }));
        return streamSSE(c, async (stream) => {
            await stream.writeSSE(ssePatch("#board-app", html));
        });
    });
    app.delete("/board/:boardId/card/:cardId", async (c) => {
        const boardId = c.req.param("boardId");
        const cardId = c.req.param("cardId");
        const board = await getBoard(boardId);
        if (!board) {
            return c.notFound();
        }
        await dbDeleteCard(cardId);
        // Re-fetch board to get the updated state (card removed)
        const updatedBoard = (await getBoard(boardId));
        const users = await getUsers();
        const tags = await getTags();
        const html = renderToString(Board({ board: updatedBoard, users, tags }));
        return streamSSE(c, async (stream) => {
            await stream.writeSSE(ssePatch("#board-app", html));
        });
    });
    app.post("/board/:boardId/card/:cardId/comment", async (c) => {
        const boardId = c.req.param("boardId");
        const cardId = c.req.param("cardId");
        const board = await getBoard(boardId);
        if (!board) {
            return c.notFound();
        }
        const formData = await c.req.formData();
        const userId = formData.get("userId").trim();
        const text = formData.get("text").trim();
        await dbAddComment({
            cardId,
            userId,
            text,
        });
        // Re-fetch board to get the new comment
        const updatedBoard = (await getBoard(boardId));
        const users = await getUsers();
        const tags = await getTags();
        const html = renderToString(Board({ board: updatedBoard, users, tags }));
        return streamSSE(c, async (stream) => {
            await stream.writeSSE(ssePatch("#board-app", html));
        });
    });
    // Single endpoint to handle drag/drop: move card to new list and reorder
    app.put("/board/:boardId/card/:cardId/position", async (c) => {
        const boardId = c.req.param("boardId");
        const cardId = c.req.param("cardId");
        const board = await getBoard(boardId);
        console.log(board);
        if (!board) {
            return c.notFound();
        }
        const body = await c.req.json();
        const listId = body.listId.trim();
        const cardIds = body.cardIds;
        // Update all card positions and list in one atomic operation
        const updates = cardIds.map((id, index) => ({
            cardId: id,
            listId: listId,
            position: index,
        }));
        await dbUpdateCardPositions(updates);
        // Return updated UI
        const updatedBoard = (await getBoard(boardId));
        const users = await getUsers();
        const tags = await getTags();
        console.log(updatedBoard);
        const html = renderToString(Board({ board: updatedBoard, users, tags }));
        return streamSSE(c, async (stream) => {
            console.log(html);
            await stream.writeSSE(ssePatch("#board-app", html));
        });
    });
    return app;
};
export { configureRoutes };
