import { MarsaError } from '../common/errors/errors.js';
import { Injectable } from '../infra/ioc-container/injectable.decorator.js';

/**
 * @description
 * Tracks fatal safe-mode activation for the runtime and protects nonessential operations.
 * @docsPage core/safe-mode
 * @docsCategory Services
 */
@Injectable()
export class SafeModeContext {
    private enabled = false;

    /**
     * @description
     * Indicates whether fatal safe mode is active.
     * @docsPage core/safe-mode
     * @docsCategory Services
     */
    get safeMode(): boolean {
        return this.enabled;
    }

    /**
     * @description
     * Enters safe mode. It remains active for the lifetime of this runtime.
     * @docsPage core/safe-mode
     * @docsCategory Services
     */
    enter(): void {
        this.enabled = true;
    }

    /**
     * @description
     * Rejects a nonessential operation while safe mode is active.
     * @param operation Description of the operation being blocked.
     * @throws {MarsaError} With code `SAFE_MODE` when safe mode is active.
     * @docsPage core/safe-mode
     * @docsCategory Services
     */
    assertAllowed(operation: string): void {
        if (this.enabled) {
            throw new MarsaError(
                'SAFE_MODE',
                `${operation} is unavailable while the runtime is in safe mode.`,
            );
        }
    }
}
