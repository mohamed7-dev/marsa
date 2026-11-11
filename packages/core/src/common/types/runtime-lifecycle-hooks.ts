export interface OnApplicationBootstrap {
    onApplicationBootstrap(): Promise<void> | void;
}

export interface OnApplicationShutdown {
    onApplicationShutdown(): Promise<void> | void;
}
