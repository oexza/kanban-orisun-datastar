import { eq, inArray, asc, max } from "drizzle-orm";
import { db } from "./index";
import { boards, lists, cards, tags, comments, cardTags, users, } from "../../drizzle/schema";
export async function getBoard(boardId) {
    const boardRows = await db
        .select({
        id: boards.id,
        title: boards.title,
        description: boards.description,
    })
        .from(boards)
        .where(eq(boards.id, boardId));
    if (boardRows.length === 0) {
        return null;
    }
    const board = boardRows[0];
    const listRows = await db
        .select({
        id: lists.id,
        title: lists.title,
        position: lists.position,
    })
        .from(lists)
        .where(eq(lists.boardId, boardId))
        .orderBy(asc(lists.position));
    if (listRows.length === 0) {
        return { ...board, lists: [] };
    }
    const listIds = listRows.map((list) => list.id);
    const cardRows = await db
        .select({
        id: cards.id,
        title: cards.title,
        description: cards.description,
        position: cards.position,
        completed: cards.completed,
        assigneeId: cards.assigneeId,
        listId: cards.listId,
    })
        .from(cards)
        .where(inArray(cards.listId, listIds))
        .orderBy(asc(cards.position));
    const cardIds = cardRows.map((card) => card.id);
    const tagRows = cardIds.length
        ? await db
            .select({
            cardId: cardTags.cardId,
            tagId: tags.id,
            tagName: tags.name,
            tagColor: tags.color,
        })
            .from(cardTags)
            .innerJoin(tags, eq(cardTags.tagId, tags.id))
            .where(inArray(cardTags.cardId, cardIds))
        : [];
    const commentRows = cardIds.length
        ? await db
            .select({
            id: comments.id,
            cardId: comments.cardId,
            userId: comments.userId,
            text: comments.text,
            createdAt: comments.createdAt,
        })
            .from(comments)
            .where(inArray(comments.cardId, cardIds))
            .orderBy(asc(comments.createdAt))
        : [];
    const tagsByCard = new Map();
    for (const row of tagRows) {
        const list = tagsByCard.get(row.cardId);
        const entry = {
            id: row.tagId,
            name: row.tagName,
            color: row.tagColor,
        };
        if (list) {
            list.push(entry);
        }
        else {
            tagsByCard.set(row.cardId, [entry]);
        }
    }
    const commentsByCard = new Map();
    for (const row of commentRows) {
        const entry = {
            id: row.id,
            userId: row.userId,
            text: row.text,
            createdAt: row.createdAt,
        };
        const list = commentsByCard.get(row.cardId);
        if (list) {
            list.push(entry);
        }
        else {
            commentsByCard.set(row.cardId, [entry]);
        }
    }
    return {
        ...board,
        lists: listRows.map((list) => ({
            ...list,
            cards: cardRows
                .filter((card) => card.listId === list.id)
                .map((card) => ({
                id: card.id,
                title: card.title,
                description: card.description,
                position: card.position,
                completed: card.completed,
                assigneeId: card.assigneeId,
                tags: tagsByCard.get(card.id) ?? [],
                comments: commentsByCard.get(card.id) ?? [],
            })),
        })),
    };
}
export async function getUsers() {
    return db
        .select({ id: users.id, name: users.name })
        .from(users)
        .orderBy(asc(users.name));
}
export async function getTags() {
    return db
        .select({ id: tags.id, name: tags.name, color: tags.color })
        .from(tags)
        .orderBy(asc(tags.name));
}
export async function createBoard(data) {
    const boardId = crypto.randomUUID();
    await db.insert(boards).values({
        id: boardId,
        title: data.title,
        description: data.description,
    });
    // Create the four default lists for the board
    const listTitles = ["Todo", "In-Progress", "QA", "Done"];
    await db.insert(lists).values(listTitles.map((listTitle, index) => ({
        id: crypto.randomUUID(),
        boardId,
        title: listTitle,
        position: index + 1,
    })));
    return { id: boardId, title: data.title, description: data.description };
}
export async function createCard(data) {
    // Find the Todo list for this board
    const todoLists = await db
        .select()
        .from(lists)
        .where(eq(lists.boardId, data.boardId));
    const todoList = todoLists.find((list) => list.title === "Todo");
    if (!todoList) {
        throw new Error("Todo list not found for this board");
    }
    // Get the highest position in the Todo list
    const maxPositionResult = await db
        .select({ maxPos: max(cards.position) })
        .from(cards)
        .where(eq(cards.listId, todoList.id));
    const nextPosition = (maxPositionResult[0]?.maxPos ?? -1) + 1;
    // Create the card
    const cardId = crypto.randomUUID();
    // Use a transaction to create card and tags atomically
    await db.transaction(async (tx) => {
        await tx.insert(cards)
            .values({
            id: cardId,
            listId: todoList.id,
            title: data.title,
            description: data.description,
            assigneeId: data.assigneeId,
            position: nextPosition,
            completed: false,
        });
        // Add tags if any
        if (data.tagIds && data.tagIds.length > 0) {
            await tx.insert(cardTags)
                .values(data.tagIds.map((tagId) => ({
                cardId,
                tagId,
            })));
        }
    });
    return { id: cardId };
}
export async function updateCard(data) {
    // Use a transaction to update card and tags atomically
    await db.transaction(async (tx) => {
        // Update card basic fields
        await tx.update(cards)
            .set({
            title: data.title,
            description: data.description,
            assigneeId: data.assigneeId,
        })
            .where(eq(cards.id, data.cardId));
        // Update tags - delete existing and insert new ones
        await tx.delete(cardTags).where(eq(cardTags.cardId, data.cardId));
        if (data.tagIds && data.tagIds.length > 0) {
            await tx.insert(cardTags)
                .values(data.tagIds.map((tagId) => ({
                cardId: data.cardId,
                tagId,
            })));
        }
    });
}
export async function addComment(data) {
    const commentId = crypto.randomUUID();
    await db.insert(comments).values({
        id: commentId,
        cardId: data.cardId,
        userId: data.userId,
        text: data.text,
    });
    return { id: commentId };
}
export async function updateCardPositions(updates) {
    await db.transaction(async (tx) => {
        for (const update of updates) {
            await tx.update(cards)
                .set({ listId: update.listId, position: update.position })
                .where(eq(cards.id, update.cardId));
        }
    });
}
export async function reorderCards(cardIds) {
    await db.transaction(async (tx) => {
        for (const [index, cardId] of cardIds.entries()) {
            await tx.update(cards)
                .set({ position: index })
                .where(eq(cards.id, cardId));
        }
    });
}
export async function moveCard(cardId, targetListId) {
    // Get the highest position in the target list
    const maxPositionResult = await db
        .select({ maxPos: max(cards.position) })
        .from(cards)
        .where(eq(cards.listId, targetListId));
    const nextPosition = (maxPositionResult[0]?.maxPos ?? -1) + 1;
    await db
        .update(cards)
        .set({ listId: targetListId, position: nextPosition })
        .where(eq(cards.id, cardId));
}
export async function deleteCard(cardId) {
    if (!cardId) {
        throw new Error("Card ID is required");
    }
    await db.delete(cards).where(eq(cards.id, cardId));
}
