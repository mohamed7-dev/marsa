export class MarsaLoadEvent extends Event {
    constructor() {
        super('marsa-load', { bubbles: true, cancelable: false, composed: true });
    }
}

declare global {
    interface GlobalEventHandlersEventMap {
        'marsa-load': MarsaLoadEvent;
    }
}
