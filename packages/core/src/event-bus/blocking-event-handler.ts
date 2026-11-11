import type { ClassType } from '../common/types/utils.js';
import { MarsaEvent } from './marsa-event.js';

export interface BlockingHandlerOptions<Event extends MarsaEvent> {
    event: ClassType<Event> | Array<ClassType<Event>>;
    /**
     * Unique identifier used for ordering
     */
    id: string;
    handler: (event: Event) => void | Promise<void>;
    /**
     * Identifier of a handler that this handler should run before
     */
    before?: string;
    /**
     * Identifier of a handler that this handler should run after
     */
    after?: string;
}
