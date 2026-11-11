/**
 * @description
 * Abstract class extended by all Events used by the EventBus system
 */
export abstract class MarsaEvent {
    public readonly createdAt: Date;
    protected constructor() {
        this.createdAt = new Date();
    }
}
