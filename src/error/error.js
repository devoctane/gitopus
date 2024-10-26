export class GitError extends Error {
    constructor(message) {
        super(message);
        this.name = "GitError";
    }
}

export class APIError extends Error {
    constructor(message, isRateLimit = false) {
        super(message);
        this.name = "APIError";
        this.isRateLimit = isRateLimit;
    }
}
