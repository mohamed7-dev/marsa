import { MarsaError } from './common/errors/errors.js';
import { iocContainer } from './infra/ioc-container/ioc-container.js';
import type { ModuleClass } from './infra/ioc-container/types.js';

/**
 * @description
 * Reports whether the runtime is ready, shutting down, or failed.
 * @docsPage core/kernel
 * @docsCategory Lifecycle
 */
export type AppState = 'created' | 'initializing' | 'initialized' | 'shutting-down' | 'shutdown' | 'failed';

export class MarsaApp {
    private state: AppState = 'created';
    private initializePromise: Promise<void> | undefined;
    private shutdownPromise: Promise<void> | undefined;

    constructor(entryModule: ModuleClass) {
        iocContainer.loadModule(entryModule);
    }

    /**
     * @description
     * Concurrent calls share initialization; successful repeated calls are idempotent. @link{KernelSubsystem}.
     * @docsPage core/kernel
     * @docsCategory Lifecycle
     * @example
     * ```ts
     * await kernel.initialize();
     * ```
     * @returns A promise that resolves when active subsystems are initialized.
     * @throws {MarsaError} If called after shutdown or failed initialization.
     */
    initialize(): Promise<void> {
        if (this.state === 'initialized') {
            return Promise.resolve();
        }
        if (this.state !== 'created' && this.state !== 'initializing') {
            throw new MarsaError(
                'INVALID_KERNEL_STATE',
                `Cannot initialize the kernel while it is "${this.state}".`,
            );
        }
        if (this.initializePromise) {
            return this.initializePromise;
        }

        this.state = 'initializing';
        this.initializePromise = new Promise(resolve => {
            // collect all onApplicationBootstrap and run them
            resolve();
        });
        return this.initializePromise;
    }

    /**
     * @description
     * Repeated calls are idempotent; a shut-down kernel cannot restart. @link{KernelSubsystem}.
     * @docsPage core/kernel
     * @docsCategory Lifecycle
     * @example
     * ```ts
     * await kernel.shutdown();
     * ```
     * @returns A promise that resolves after shutdown completes.
     * @throws {AggregateError} If one or more subsystems fail during shutdown.
     */
    shutdown(): Promise<void> {
        if (this.state === 'shutdown') {
            return Promise.resolve();
        }
        if (this.shutdownPromise) {
            return this.shutdownPromise;
        }

        this.shutdownPromise = new Promise(resolve => {
            // collect all onApplicationShutdown and run them
            resolve();
        });
        return this.shutdownPromise;
    }

    public initKernel() {
        // Wrap the kernel in a service with a method called `createKernel`
        // then return it from this method
    }
}
