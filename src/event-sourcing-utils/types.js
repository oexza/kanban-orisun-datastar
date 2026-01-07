export const noEventPosition = {
    commitPosition: -1,
    preparePosition: -1,
};
export const firstEventPosition = {
    commitPosition: 0,
    preparePosition: 0,
};
export const lastEventPosition = {
    commitPosition: Number.MAX_SAFE_INTEGER,
    preparePosition: Number.MAX_SAFE_INTEGER,
};
// Error Types
export class EventSourcingError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'EventSourcingError';
    }
}
export class DuplicateError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DuplicateError';
    }
    name = 'DuplicateError';
}
export class ConcurrencyError extends EventSourcingError {
    constructor(aggregateId, expectedVersion, actualVersion) {
        super(`Concurrency conflict for aggregate ${aggregateId}. Expected version ${expectedVersion}, but actual version is ${actualVersion}`, 'CONCURRENCY_ERROR');
    }
}
