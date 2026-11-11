# @marsa/core

Framework-independent Marsa runtime package. Core contains the bootstrap/configuration path, module container, domain services, RxJS event bus, persistence code, and domain schemas. It does not depend on a UI framework, Vite, or browser rendering APIs.

## Current implementation status

The package is an incomplete scaffold; its public API and runtime wiring are in progress. The public exports include `bootstrap` and the service-owned `StateService`.

`bootstrap(config)` applies the supplied options through `setConfig`, resolves the active config, applies plugin configuration functions, creates the entry module, and calls `MarsaApp.initialize()`. `MarsaApp.initialize()` and `shutdown()` currently contain placeholders; `initKernel()` is unfinished. Do not treat successful bootstrap as proof that all runtime services or plugins have been initialized.

The current plugin mechanism uses `@MarsaPlugin` module metadata and the global IoC container. Plugin configuration hooks can mutate the resolved config before module initialization. The application and helper managers are registered in `ServiceModule`, but a typed plugin-facing service context is not yet exposed. `ApplicationManager` supports install, uninstall, and launch operations; broader application lifecycle integration remains incomplete.

## Configuration

Marsa config is a typed config object with defaults and merge behavior; core does not validate the overall config object with a Zod schema. Domain/runtime schemas are separate from config options.

`stateOptions.persistenceEnabled` controls whether `StateService` uses the adapter configured under `persistenceOptions`; it defaults to `true`. Setting it to `false` keeps all state collections in memory. `stateOptions` also configures the schema version, 300 ms default write debounce, migrations, and structured persistence error callback.

```ts
await bootstrap({
    stateOptions: {
        persistenceEnabled: false,
    },
});
```

Configuration state is process-global. `setConfig()` merges into the shared `activeConfig`; `resetConfig()` reloads the defaults. This is intentionally retained for the current design:

- Multiple bootstrap calls share configuration; a later call can retain values merged by an earlier call.
- Plugin configuration runs against the same active config.
- Concurrent bootstrap/configuration flows are not isolated and may affect the same config object.

Use the reset path when a consumer or test needs the defaults back. Independent concurrent runtimes with different config objects are not supported by this global model.
Runtime services require initialized configuration; resolve them through `bootstrap(config)` rather than constructing service providers before configuration is loaded.

## Services and kernel direction

Business logic is organized under `src/services/` (application/instance management and lifecycle, permission, error, and persistence helpers). The module container wires these providers, but the service layer is not yet consistently implemented or accessible from a stable public API.

The agreed refactor keeps `bootstrap(config)` as the entry point, makes domain services the owners of runtime behavior, and reduces the kernel to composition and integration duties such as plugin lifecycle. Plugins should receive typed services through a context and use those services for application installation and instance operations. This is a target, not a completed API; React, Vite, and examples still consume or construct the earlier direct-kernel API.

`ErrorManagementModule` is the canonical provider for the shared `RuntimeErrorManager` and `RuntimeErrorReporter`. It is imported by core service modules and exported through `PluginCommonModule`, so plugins can inject the same runtime error manager used by core. Registered application, instance, lifecycle, permission, and event-bus service methods use a shared error-reporting boundary. It reports failures through `RuntimeErrorManager` with the service operation as context, then rethrows the original error so callers still observe failure. Reporting is deduplicated when the same error crosses nested service boundaries. Errors from lifecycle hooks that are intentionally isolated are reported at the hook boundary.

## Safe mode

A fatal runtime error latches `SafeModeContext` for the runtime. Safe mode rejects application installation/removal, new instance creation or launch, instance progression into loading/mounted states, and nonessential lifecycle events. It retains reads, state persistence and flushing, diagnostics, permission revocation, focus, virtualization, and closing/unmounting so the host can preserve state and keep essential controls available. Permission authorization fails closed. No window/layout manager or subsystem restart API is implemented yet; safe mode is not automatically cleared.

## Events

`EventBus` publishes events through an RxJS `Subject` and exposes filtered event streams as RxJS observables. It also supports ordered blocking handlers. Application and instance services publish typed classes for application installation, uninstallation and launch, and instance creation, focus requests, status changes, and destruction. Event payloads use TypeScript contracts only; the bus does not schema-validate event data. Other service domains still need their own event classes and publication wiring.

## Schemas

Domain schemas are under `src/schemas/` for applications, identifiers, lifecycle hooks, permissions, and persistence. Some schema definitions still live with config contracts, and event/window/notification schemas and public exports are incomplete. The agreed organization is concern-based schemas under `src/schemas/`; config folders should contain config types, defaults, and merge/configuration behavior, not schema definitions.

The overall config object has no config-options schema and must remain that way. Continue to use concern-specific runtime validation for domain inputs at their owning boundaries where implemented. Opaque application state payloads belong to applications, not core schemas.

## Generic state collections

`StateService` exposes caller-named `StateCollection` handles. It does not define application-, instance-, window-, or workspace-specific operations or interpret stored values. Application services use the `applications` collection for application definitions; instance services use the `application-instances` collection with persistence disabled. Plugins and other runtime services can open their own collections through the same API.

Collections support versioned reads and writes, adjacent migrations, durable values, debounced/batched writes, enumeration, deletion, `release`, and explicit `flush`. A collection can opt out of persistence; the global `stateOptions.persistenceEnabled: false` setting keeps every collection in memory. The owner of a collection is responsible for coordinating `flush` and `release` with its lifecycle. Failed writes reject while retaining the latest in-memory value; optional `onPersistenceError` receives the collection and key context. No automatic application/session restoration is provided. The browser IndexedDB adapter remains in the separate `@marsa/persistence` package.

## Development

Core sources are TypeScript. Build, type-check, lint, and test commands are declared in `package.json`. Focused application/instance event tests cover typed payloads and publication after service operations.
