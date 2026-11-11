export class MarsaErrorEvent extends Event {
    constructor() {
        super('marsa-error', { bubbles: true, cancelable: false, composed: true });
    }
}

declare global {
    interface GlobalEventHandlersEventMap {
        'marsa-error': MarsaErrorEvent;
    }
}
