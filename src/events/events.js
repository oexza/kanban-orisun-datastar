export const STREAM_ID = "kanban_board_stream";
export const STREAM_TYPE = "general";
export class BoardCreatedEvent {
    boardCreatedId;
    title;
    description;
    scope;
    constructor(boardCreatedId, title, description, scope) {
        this.boardCreatedId = boardCreatedId;
        this.title = title;
        this.description = description;
        this.scope = scope;
    }
    static name = "BoardCreated";
    static boardCreatedId = "boardCreatedId";
    static title = "title";
}
export class BoardListCreated {
    boardListCreatedId;
    title;
    position;
    scope;
    constructor(boardListCreatedId, title, position, scope) {
        this.boardListCreatedId = boardListCreatedId;
        this.title = title;
        this.position = position;
        this.scope = scope;
    }
    static name = "BoardListCreated";
    static position = "position";
    static title = "title";
}
export class CardCreatedEvent {
    cardCreatedId;
    title;
    description;
    assigneeId;
    tagIds;
    position;
    scope;
    constructor(cardCreatedId, title, description, assigneeId, tagIds, position = 0, scope) {
        this.cardCreatedId = cardCreatedId;
        this.title = title;
        this.description = description;
        this.assigneeId = assigneeId;
        this.tagIds = tagIds;
        this.position = position;
        this.scope = scope;
    }
    static name = "CardCreated";
    static cardCreatedId = "cardCreatedId";
    static title = "title";
    static description = "description";
    static assigneeId = "assigneeId";
}
