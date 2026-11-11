export class MarsaInvalidEvent extends Event {
    constructor() {
        super('marsa-invalid', { bubbles: true, cancelable: false, composed: true });
    }
}

declare global {
    interface GlobalEventHandlersEventMap {
        'marsa-invalid': MarsaInvalidEvent;
    }
}
