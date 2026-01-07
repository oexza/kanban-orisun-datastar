interface Event {
    scope: Record<string, any>
}

export class BoardCreatedEvent implements Event {
    constructor(
        public readonly boardCreatedId: string,
        public readonly title: string,
        public readonly description: string,
        public readonly scope: Record<string, any>
    ) {
    }

    public static name = "BoardCreated";
    public static boardCreatedId: BoardCreatedFields = "boardCreatedId";
    public static title: BoardCreatedFields = "title";
}

export type BoardCreatedFields = keyof InstanceType<typeof BoardCreatedEvent>

export class BoardListCreated implements Event {
    constructor(
        public readonly boardListCreatedId: string,
        public readonly title: string,
        public readonly position: number,
        public readonly scope: Record<string, any> & {
            boardCreatedId: string
        }
    ) {
    }

    public static name = "BoardListCreated";
    public static position: BoardListCreatedFields = "position";
    public static title: BoardListCreatedFields = "title";
    public static boardListCreatedId: BoardListCreatedFields = "boardListCreatedId";
}

export type BoardListCreatedFields = keyof InstanceType<typeof BoardListCreated>

export class CardCreatedEvent implements Event {
    constructor(
        public readonly cardCreatedId: string,
        public readonly title: string,
        public readonly description: string | null,
        public readonly assigneeId: string | null,
        public readonly tagIds: string[],
        public readonly position: number = 0,
        public readonly scope: Record<string, any> & {
            boardCreatedId: string
            boardListCreatedId: string
        }
    ) {
    }

    public static name = "CardCreated";
    public static cardCreatedId: CardCreatedFields = "cardCreatedId";
    public static title: CardCreatedFields = "title";
    public static description: CardCreatedFields = "description";
    public static assigneeId: CardCreatedFields = "assigneeId";
}

export type CardCreatedFields = keyof InstanceType<typeof CardCreatedEvent>;

export class CardUpdatedEvent implements Event {
    constructor(
        public readonly cardUpdatedId: string,
        public readonly title: string,
        public readonly description: string | null,
        public readonly assigneeId: string | null,
        public readonly tagIds: string[],
        public readonly scope: Record<string, any> & {
            boardListCreatedId: string
            cardCreatedId: string
        }
    ) {
    }

    public static name = "CardUpdated";
    public static cardUpdatedId: CardUpdatedFields = "cardUpdatedId";
    public static title: CardUpdatedFields = "title";
    public static description: CardUpdatedFields = "description";
    public static assigneeId: CardUpdatedFields = "assigneeId";
}

export type CardUpdatedFields = keyof InstanceType<typeof CardUpdatedEvent>;

export class CardDeletedEvent implements Event {
    constructor(
        public readonly cardDeletedId: string,
        public readonly scope: Record<string, any> & {
            cardCreatedId: string
        }
    ) {
    }

    public static name = "CardDeleted";
    public static cardDeletedId: CardDeletedFields = "cardDeletedId";
}

export type CardDeletedFields = keyof InstanceType<typeof CardDeletedEvent>;

export class CommentAddedToCardEvent implements Event {
    constructor(
        public readonly commentCreatedId: string,
        public readonly text: string,
        public readonly userId: string,
        public readonly scope: Record<string, any> & {
            cardCreatedId: string
        }
    ) {
    }

    public static name = "CommentAddedToCardEvent";
    public static commentCreatedId: CommentAddedToCardEventFields = "commentCreatedId";
    public static text: CommentAddedToCardEventFields = "text";
    public static userId: CommentAddedToCardEventFields = "userId";
}

export type CommentAddedToCardEventFields = keyof InstanceType<typeof CommentAddedToCardEvent>;

export class CardMovedEvent implements Event {
    constructor(
        public readonly cardMovedId: string,
        public readonly position: number,
        public readonly scope: Record<string, any> & {
            boardListCreatedId: string
            cardCreatedId: string
        }
    ) {
    }

    public static name = "CardMoved";
    public static cardMovedId: CardMovedFields = "cardMovedId";
    public static position: CardMovedFields = "position";
}

export type CardMovedFields = keyof InstanceType<typeof CardMovedEvent>;