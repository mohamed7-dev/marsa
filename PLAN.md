# Marsa — MVP Implementation Plan

**Project:** Marsa (مرسى)  
**Repository:** `marsa`  
**Status:** Implementation roadmap  
**Architecture reference:** `SPEC-001-Marsa`  
**Agent instructions:** `AGENTS.md`

---

## 1. Purpose

This document defines the implementation roadmap for the Marsa MVP.

AI coding agents and human contributors must use this plan to guide implementation.

The objective is to build a working, maintainable, and publishable MVP of Marsa while preserving the architecture defined in `SPEC-001-Marsa`.

This is an implementation plan, not a list of ideas. Each task describes:

- What needs to be implemented.
- Why it is required.
- What the expected result should be.
- How completion should be verified.
- Which tasks must be completed first.

### 1.1 Mandatory implementation rules

1. Read the root `AGENTS.md` before starting work.
2. Read the relevant sections of `SPEC-001-Marsa` before implementing architectural functionality.
3. Follow the phases in this document in dependency order.
4. Do not skip prerequisites.
5. Do not implement post-MVP functionality unless explicitly requested.
6. Do not implement multiple unrelated phases in one change.
7. Keep every change focused and testable.
8. Add tests alongside implementation, not afterward.
9. Update documentation when public APIs or behavior change.
10. Do not mark a task complete until its acceptance criteria pass.
11. Do not fabricate test results or claim that unexecuted checks passed.
12. If an architectural ambiguity blocks implementation, document it and ask for clarification rather than inventing a public API.

### 1.2 Task status conventions

Use the following status values when tracking progress:

- `[ ]` Not started.
- `[-]` In progress.
- `[x]` Completed.
- `[!]` Blocked.

Update this file as implementation progresses.

When completing a task, record important decisions, deviations, and relevant verification results.

Do not mark an entire phase complete while any required task within that phase remains unfinished.

---

## 2. MVP Definition

The MVP provides one desktop application runtime in which applications run inside independently managed windows.

A developer must be able to:

- Register applications.
- Launch applications from the desktop.
- Open application windows.
- Move and resize windows.
- Focus, minimize, maximize, restore, and close windows.
- Switch workspaces.
- Use basic window snapping.
- Preserve Marsa-managed application state during virtualization.

### Core functionality

- Headless bootstrap and service-owned runtime.
- Typed public contracts.
- Application registry.
- Lifecycle management.
- Error management.
- Permissions.
- Event communication.
- Configuration validation.
- Notifications.
- TypeScript integration.

---

# Phase 0 — Repository Inspection and Architecture Preparation

**Goal:** Understand the existing repository and prepare it for implementation without unnecessarily modifying existing work.

### Tasks

#### 0.1 Inspect the repository

- Inspect the current directory structure.
- Read `AGENTS.md`.
- Inspect existing `package.json` files.
- Inspect pnpm, Nx, and Lerna configuration if present.
- Identify existing source code, tests, and documentation.
- Identify incomplete or placeholder implementations.
- Check the existing Git state before making changes.

Do not assume that the repository is empty.

#### 0.2 Validate architectural dependencies

Review `SPEC-001-Marsa` and identify:

- Package responsibilities.
- Dependency restrictions.
- Public API boundaries.
- Runtime ownership.
- Build-time versus runtime responsibilities.

Document any contradictions between the specification and the existing repository.

#### 0.3 Create an implementation tracking structure

Ensure that implementation progress can be tracked through this document and normal Git commits or pull requests.

### Acceptance criteria

- [x] Repository structure has been inspected.
- [x] Existing implementation has been understood.
- [x] Architectural dependencies have been reviewed.
- [x] Any blocking ambiguities have been documented.
- [x] No unnecessary repository changes have been introduced.

### Inspection findings and decisions

- The repository contains the project instructions, specification, plan, and root tooling configuration. `packages/` and `examples/` are empty; no source files, tests, Nx configuration, or Lerna configuration exist yet.
- The root manifest has a placeholder `test` script. Its declared development dependencies are not listed in the root importer in `pnpm-lock.yaml`; reconcile the lockfile when establishing the monorepo tooling in Phase 1.
- The pre-commit hook refers to `lintstaged.config.mjs`, but the existing file is named `linstaged.config.mjs` and contains a placeholder command. Resolve this during Phase 1 engineering setup.
- The current Git repository has no commits or tracked files; the existing project files are untracked. Preserve that baseline and avoid staging or committing files without explicit instruction.
- No conflict was found between the architecture documents and an existing implementation; there is no implementation yet to compare. The package boundaries and runtime/build-time ownership described in `AGENTS.md`, `PLAN.md`, and `SPEC-001-Marsa.md` are aligned.
- Phase 0 clarifications: keep the IndexedDB adapter outside `@marsa/core` behind its persistence contract; Phase 6 assigns it to `@marsa/persistence`, which depends on the public core package contract; use static developer configuration for capability grants, with no runtime consent UI; keep runtime overrides runtime-only, with application settings taking precedence over environment settings and framework defaults.
- Remaining specification decisions—such as window defaults, workspace limits, performance budgets, and SSR validation—do not block Phase 1 and should be resolved when their implementation phases are reached.

**Dependency:** None.

---

# Phase 1 — Monorepo Foundation

**Goal:** Establish a reliable monorepo development environment.

### 1.1 Initialize pnpm workspaces

Create or configure:

- Root `package.json`.
- `pnpm-workspace.yaml`.
- Shared workspace scripts.
- Node.js and pnpm version requirements.

Use pnpm as the package manager.

Define consistent scripts for:

- Development.
- Build.
- Test.
- Lint.
- Type-check.
- Formatting.

### 1.2 Configure Nx

Configure Nx for dependency-aware task execution.

Requirements:

- Detect project dependencies.
- Execute project-specific tasks.
- Support affected-project execution.
- Support local task caching.
- Define consistent target names.

Avoid duplicating Nx functionality with another task orchestrator.

### 1.3 Configure Lerna

Configure Lerna in fixed/locked version mode.

All Marsa packages must be released using coordinated versions.

The initial release version should follow the pre-1.0 SemVer policy.

### 1.4 Create package skeletons

Create the following packages:

- `@marsa/core`
- `@marsa/persistence`
- `@marsa/react`
- `@marsa/ui`
- `@marsa/vite`

Each package should have:

- `package.json`.
- `src/`.
- `README.md`.
- `tsconfig.json`.
- Test configuration.
- Explicit package exports.

Create the `examples/floating-dashboard` application.

### 1.5 Establish shared engineering configuration

Configure:

- TypeScript strict mode.
- ESLint.
- Prettier.
- Vitest.
- Shared test utilities.
- Conventional Commits conventions.

### Acceptance criteria

- [x] pnpm workspace installs successfully.
- [x] Nx recognizes all projects.
- [x] Lerna recognizes all publishable packages.
- [x] All packages have valid initial manifests.
- [x] Shared TypeScript configuration works.
- [x] Lint, formatting, and type-check commands execute.
- [x] Package dependency boundaries are documented.
- [x] A basic CI workflow can validate the repository.

### Completion notes

- Configured the pnpm workspace, Node.js/pnpm requirements, root development/build/test/lint/type-check/format scripts, and a frozen-lockfile install.
- Configured Nx project targets, dependency-aware builds, local caching, affected-project defaults, and package watch targets. Nx discovers all six packages and both examples.
- Configured Lerna fixed-version mode at `0.0.0`; Lerna discovered the initial six publishable packages and also recognizes the Phase 6 `@marsa/persistence` package.
- Added initial manifests, explicit exports, strict TypeScript configurations, READMEs, shared Vitest configuration, and source entry points for all packages; added TypeScript-configured placeholders for both examples.
- Documented package ownership and dependency boundaries in `packages/README.md`.
- Added ESLint, Prettier, Vitest, Conventional Commit hooks, lint-staged formatting/linting, and a GitHub Actions workflow running `pnpm check`.
- Corrected the pre-commit hook's lint-staged config filename mismatch and added ignores for generated Nx/build output.
- Toolchain adjustment: the initially selected TypeScript 7.0.2 was rejected by `typescript-eslint` 8.72.1. Updated to TypeScript 6.0.3, after which linting, type-checking, tests, and builds passed.
- Verification: `pnpm install --frozen-lockfile`, `pnpm check`, both example `tsc --noEmit` checks, `nx show projects`, and `lerna list --all` succeeded. The GitHub Actions workflow itself was not run remotely; its install and validation commands were verified locally.
- No standalone shared test-helper library was introduced before tests establish reusable patterns; all package test scripts currently consume the shared Vitest configuration.

**Dependencies:** Phase 0.

---

# Phase 2 — Core Contracts and Type System

**Goal:** Define stable framework-independent contracts before implementing runtime behavior.

This phase is especially important because the core must not become dependent on React or any particular rendering strategy.

### 2.1 Define shared identifiers

Define types for:

- Application IDs.
- Application instance IDs.
- Window IDs.
- Workspace IDs.
- Event IDs.
- Notification IDs.
- Correlation IDs.

Use a consistent identifier-generation strategy.

### 2.2 Define application contracts

Create framework-independent definitions for:

- Application metadata.
- Application loaders.
- Instance policies.
- Application capabilities.
- Application lifecycle.
- Application instances.

Do not import React types into core contracts.

The core application loader must return a framework-neutral module or opaque runtime definition.

The React integration will adapt that definition into a React component.

### 2.3 Define window and workspace contracts

Create typed contracts for:

- Window geometry.
- Window lifecycle.
- Window state.
- Focus state.
- Workspace metadata.
- Window-to-instance relationships.

### 2.4 Define infrastructure contracts

Define interfaces for:

- Persistence adapters.
- Domain-scoped Zod schemas for caller-provided runtime inputs.
- Event delivery.
- Permission checks.
- Error reporting.
- Notification services.
- Lifecycle subscriptions.
- Framework-neutral desktop controller.

### 2.5 Validate runtime contracts in core

- [ ] Keep domain/runtime schemas grouped by concern under `packages/core/src/schemas`; do not store schemas in `packages/core/src/config`.
- [ ] Derive public domain data types from their schemas where practical; keep opaque payloads and generic callback types appropriately typed.
- [ ] Validate domain/runtime inputs at the owning service boundary. Do not define or run a Zod schema for the overall Marsa config object.
- [x] Remove the separate `@marsa/validation-zod` package and its workspace references.

### Acceptance criteria

- [ ] All foundational contracts are implemented and exported intentionally.
- [ ] Core contracts have no framework-specific dependencies or circular type dependencies.
- [ ] Type-level tests cover important contracts.
- [ ] JSDoc documents public interfaces.

### Current source assessment

- The current source tree has schemas for application definitions/instances, identifiers, lifecycle hooks, permissions, and persistence. Some schema and strategy definitions remain under `config/`; event, window, and notification domain contracts are incomplete; and `src/index.ts` currently exports only `bootstrap`.
- The existing config object is type-driven and does not have a config-options Zod schema. Domain schema organization and explicit public exports remain unfinished.
- Earlier completion notes described a prior source snapshot and do not establish that the current tree still satisfies these acceptance criteria. Re-verify each criterion against current source and validation before marking this phase complete.

**Dependencies:** Phase 1.

---

# Core architecture alignment — Bootstrap, services, and plugins

**Status:** [-] Agreed direction; implementation not complete

**Goal:** Make `bootstrap(config)` the runtime entry point, place domain behavior in services, and keep the kernel focused on integration and plugin lifecycle.

### Tasks

- [ ] Preserve the current process-global config state and merge semantics. Do not add a Zod schema for the top-level config object.
- [ ] Make `bootstrap(config)` responsible for resolving config, composing runtime services, constructing the kernel/integration boundary, and installing configured plugins.
- [ ] Make services own application definitions, instance operations, lifecycle, permission checks, persistence adapters, and runtime errors. Avoid duplicating business behavior in the kernel.
- [ ] Define a typed plugin context that exposes supported services and the RxJS event bus. Plugins use services to install applications and create/manage instances; they do not depend on kernel internals.
- [ ] Use the RxJS `Subject` event bus as the common publication path for service events and expose an observable to integrations/plugins.
- [x] Add typed application and instance event classes and publish committed application/instance operations through the event bus without runtime schema validation.
- [ ] Move domain schemas out of config modules and organize them by concern under `src/schemas`. Do not add config-options schemas.
- [ ] Keep kernel integration limited to composition, initialization/shutdown coordination, and plugin integration that cannot be owned by a domain service.
- [x] Add a context-agnostic `StateService` with named generic collections; keep session restoration out of scope.
- [ ] Plan a separate migration for React, Vite, and examples, which currently consume/construct the direct kernel API.

### Process-global configuration constraint

The global `activeConfig` is intentionally retained. `setConfig` merges overrides into that shared object, so repeated bootstrap calls can inherit earlier values and concurrent bootstrap/plugin configuration can affect the same config. The refactor must not imply independent runtime configuration isolation. Test setup that needs a clean baseline must use the existing reset path; tests for concurrent bootstrap must characterize shared-state behavior.

### Acceptance criteria

- [ ] Bootstrap returns a fully initialized runtime with service and event-bus access.
- [ ] Configured plugins can use typed services to install applications and create instances without kernel internals.
- [ ] Kernel contains no duplicate domain business logic.
- [ ] Service events flow through the RxJS Subject and subscriber APIs.
- [ ] Core domain schemas live under `src/schemas`; no top-level config schema is introduced.
- [x] Application and instance managers delegate their authoritative records to generic collections without adding domain CRUD to `StateService`.
- [ ] Core type-check/build and focused tests pass. Do not claim validation that was not run.

**Dependencies:** Phase 2.

---

# Phase 3 — Core Kernel and Registries

**Status:** [ ] Rework required under the service-owned architecture.

**Goal:** Implement headless runtime composition through bootstrap and domain services.

### 3.1 Implement kernel initialization

Implement bootstrap/kernel integration responsible for:

- Runtime initialization.
- Runtime shutdown.
- Service composition.
- Plugin installation and cleanup.

The kernel must not render UI or own domain business logic. Application and instance state remain owned by their services.

Initialization should be deterministic and idempotency behavior must be explicitly defined.

### 3.2 Implement application registry

Implement application registry behavior in the application service:

- Application registration.
- Application lookup.
- Application metadata retrieval.
- Application removal where permitted.
- Duplicate ID detection.
- Loader metadata storage.

Registration must not eagerly load application JavaScript.

### 3.3 Implement application instance management

Implement instance behavior in the application-instance service:

- Instance creation.
- Instance lookup.
- Instance status transitions.
- Instance destruction.
- Instance policy enforcement.

The single-instance policy should focus an existing instance when a second launch is requested.

### Acceptance criteria

- [ ] Bootstrap initializes and shuts down the composed runtime correctly.
- [ ] Application registry operations are owned by the application service.
- [ ] Duplicate application definitions are detected.
- [ ] Application modules remain lazy.
- [ ] Single-instance policy is enforced by the instance service.
- [ ] Service lifecycle and bootstrap integration are covered.

### Current source assessment

- `ApplicationManager` and `ApplicationInstanceManager` exist as DI services, but launch integration is commented/incomplete and plugin code does not receive a typed service context.
- `MarsaApp.initialize()` and `shutdown()` are placeholders; `initKernel()` is unfinished. The current public core entry point exports only `bootstrap`.
- No separate kernel domain runtime is currently composed through `bootstrap`. Do not consider this phase complete based on earlier completion notes.

**Dependencies:** Phase 2 and Core architecture alignment.

---

# Phase 4 — Lifecycle and Error Management

**Status:** [ ] Partial helper implementations exist; service integration and error paths remain unverified.

**Goal:** Implement predictable application lifecycle transitions and runtime error isolation.

### 4.1 Implement lifecycle orchestration

Support the applicable lifecycle events:

- Launch.
- Mount.
- Unmount.
- Virtualize.
- Restore.
- Minimize.
- Maximize.
- Focus.
- Blur.
- Close.
- Workspace change.
- Permission revocation.

The lifecycle service owns transitions and hook execution.

Framework adapters notify application components about relevant transitions.

### 4.2 Implement before and after hooks

Implement two-phase lifecycle behavior.

Before hooks:

- May run asynchronously.
- May cancel operations.
- Must support timeouts.
- Must run in deterministic order.

After hooks:

- Run only after successful transitions.
- Cannot cancel completed operations.

If a multi-participant operation is cancelled, previously prepared participants must receive compensating cleanup in reverse preparation order.

### 4.3 Implement central error manager

Implement:

- [x] A shared service-method reporting boundary that logs failures through the error manager and rethrows them unchanged.
- [x] Deduplicate the same reported error as it propagates across nested service boundaries.
- Error categorization.
- Error history.
- Error subscriptions.
- Error correlation IDs.
- Error recovery metadata.
- Error reporting API.

Use a configurable in-memory ring buffer with a default capacity of 500 records.

### 4.4 Implement error isolation

Ensure that:

- Application failures do not crash unrelated applications.
- Integration failures are reported.
- Kernel errors preserve the last valid state where possible.
- Fatal errors can initiate safe mode.

### Acceptance criteria

- [x] Failures from application, instance, lifecycle, permission, and event-bus service methods are centrally reported without swallowing the original error.
- [ ] Lifecycle transitions are deterministic and service-owned.
- [ ] Before hooks can cancel operations.
- [ ] After hooks run only after successful operations.
- [ ] Hook failures are isolated and reported by the runtime error service.
- [ ] Timeouts are handled correctly.
- [ ] Error history is queryable through the plugin-facing service API.
- [ ] Application failures do not crash unrelated applications.
- [-] Fatal errors activate safe mode; application/instance, lifecycle, and permission operations enforce safe-mode restrictions. Window/layout safe mode and explicit subsystem recovery remain pending.

### Completion notes

- Service method reporting now uses a shared reporter/decorator for synchronous and asynchronous failures. It logs through the configured logger, preserves the original error for callers, and avoids duplicate reports for an error and its already-reported cause. `RuntimeErrorManager` is available to plugins through `PluginCommonModule`; error history/subscriptions and bootstrap runtime exposure remain incomplete.
- Lifecycle helpers exist under `services/helpers`, but current `MarsaApp` startup does not invoke service lifecycle hooks. The duplicate helper runtime-error manager was removed in favor of the canonical `runtime-error-manager` module.
- Fatal errors activate the injectable `SafeModeContext`; application registry writes, new instance creation/launch, nonessential lifecycle progression, and capability authorization are restricted. State preservation, focus, virtualization, close/unmount, and permission revocation remain available. No window/layout manager or subsystem recovery API exists yet.
- Verification: the focused core suite passes (23 tests), core test type-check passes, and ESLint passes for the changed error-management files.
- Prior completion notes describe a different source snapshot. Re-establish behavior and run focused validation before marking this phase complete.

**Dependencies:** Phase 3.

---

# Phase 5 — Event Bus and Permission System

**Status:** [ ] RxJS event bus exists; unified service publication and permission integration remain incomplete.

**Goal:** Enable secure application communication and centralized capability enforcement.

### 5.1 Implement typed event bus

Implement:

- Event publication.
- Event subscriptions.
- Subscription cleanup.
- Event metadata.
- Event scopes.
- Subscriber error isolation.

Support instance, application, and dashboard scopes.

Transient delivery is the MVP requirement.

### 5.2 Implement event access control

Applications must declare the event types they may publish and subscribe to.

The responsible domain services enforce permissions at operation boundaries and publish resulting runtime events through the shared RxJS `Subject` event bus.

### 5.3 Implement capability registry

Define the initial capability model.

Examples:

- `events.publish`
- `events.subscribe`
- `storage.read`
- `storage.write`
- `windows.create`
- `notifications.send`

Applications must not grant themselves capabilities.

### 5.4 Implement permission enforcement

Protected operations must check capabilities in the owning service at the operation boundary.

Do not rely on UI-level restrictions.

### 5.5 Implement permission audit log

Record:

- Permission requests.
- Developer grants.
- Revocations.
- Denials.
- Relevant configuration changes.

Audit records must be append-only from the application's perspective.

### Acceptance criteria

- [ ] Event publication and subscriptions work through the RxJS event bus.
- [ ] Event scopes are enforced by the event/runtime services.
- [ ] Subscriber cleanup works.
- [ ] Unauthorized event operations are rejected by the owning service.
- [ ] Protected operations enforce capabilities.
- [ ] Revocation blocks subsequent operations.
- [ ] Permission audit records are generated without sensitive payload data.

### Completion notes

- `EventBus` publishes events through an RxJS `Subject` and supports RxJS observable subscriptions plus ordered blocking handlers. This bus is injected through the module container, but the application service still publishes class-based events and does not consistently route all domain events through it.
- Permission helper code exists but is not yet consistently invoked at application/runtime operation boundaries or exposed through a stable service context.
- Prior completion notes describe a different source snapshot. Verify the unified service/event/permission path and failure behavior before marking this phase complete.

**Dependencies:** Phase 4.

---

# Phase 6 — Persistence and Application State

**Status:** [-] Generic state collections and manager integration are implemented; full runtime/plugin exposure and adapter acceptance checks remain pending.

**Goal:** Implement application state independent of React component mounting.

### Completion notes

- `StateService` exposes caller-named, domain-agnostic collections. Application and instance managers keep domain behavior in their services and store their records through the `applications` and `application-instances` collections.
- The service selects the configured adapter when `stateOptions.persistenceEnabled` is true and an in-memory adapter when false. Collections retain versioned values, adjacent migrations, durability, debounce/batching, explicit flush, release, and structured failure behavior.
- Session restoration remains post-MVP: active instances are not restored automatically, and application payload restoration is explicit through the state service.

### 6.1 Define persistence adapter contract

Define a generic persistence interface.

The core must not depend on IndexedDB directly.

Support operations for:

- Read.
- Write.
- Delete.
- Flush.
- Migration.
- Error reporting.

### 6.2 Implement IndexedDB adapter

Implement the default browser persistence adapter in `@marsa/persistence`. It must depend on `@marsa/core` and implement the persistence contract through the core package's public exports only. The core must not depend on this browser-specific package.

It must support:

- Database initialization.
- Object store management.
- Versioned records.
- Transactions.
- Read/write operations.
- Error handling.

### 6.3 Implement instance-scoped state

Implement a generic collection API whose callers choose collection names and keys. Application-scoped state, plugins, and other runtime areas can choose independent collections without the state service interpreting their contents.

### 6.4 Implement durable state

Allow applications to opt into durable state.

`release(key)` clears a temporary value or releases a durable value from memory. Collection owners coordinate release with their own lifecycle; the generic service does not assume application or instance ownership.

### 6.5 Implement state migrations

Support schema versions and migration functions.

Migration failures must not corrupt the last valid state.

### 6.6 Implement persistence scheduling

Use debounced writes (300 ms default), batched persistence, explicit flush, and structured errors. Lifecycle owners decide when to flush or release collection values.

Persistence failures must produce structured errors and an in-memory fallback.

### Acceptance criteria

- [x] State is isolated by collection and key.
- [ ] IndexedDB adapter works against the IndexedDB API contract; adapter tests cover CRUD, transactions, and reconnection.
- [ ] Durable state survives adapter/store reconstruction.
- [x] Temporary state can be cleared through `release`.
- [x] Version migrations work and migration failures preserve stored data.
- [ ] Persistence errors do not crash the runtime; lifecycle owners handle failed flushes safely.
- [x] Failed writes are rejected and never reported as successful.
- [x] State service tests cover failure and recovery.

### 6.7 Integrate application state with the service-owned runtime

The core `StateService` provides a generic state boundary:

- Application and instance managers use named collection operations rather than application-/instance-specific methods on `StateService`.
- Any runtime service or plugin can define its own collection and keying strategy; payloads remain opaque to core.
- `stateOptions.persistenceEnabled` selects the configured adapter or an in-memory adapter.
- Migration, debounce/batching, durability, explicit flush/release, and structured persistence failures remain supported.
- Collection owners coordinate lifecycle flushing and cleanup. Reading state is explicit; creating an instance does not trigger session restoration.

Focused tests cover generic collection isolation, CRUD, migrations, durability/release, write scheduling, failure reporting, and application/instance event behavior. Plugin context exposure and complete shutdown wiring remain part of unfinished runtime integration work.

**Verification:** The focused generic state and application/instance event tests pass (9 tests), and changed-file ESLint/Prettier checks pass. The full core suite and type-check remain blocked by pre-existing invalid relative imports in `services/helpers/runtime-error-manager/runtime-error-manager.service.ts` and its test. The persistence suite still resolves a stale built `@marsa/core` entry that lacks `PersistenceStoreNameSchema`.

**Dependencies:** Phase 5.

---

# Phase 7 — React Integration

**Status:** [-] Existing integration targets the earlier direct-kernel API; migration to the bootstrap/service contracts is pending.

**Goal:** Connect the headless core to React without moving runtime ownership into React.

### 7.1 Implement React provider

Implement a provider that:

- Consumes the runtime returned by `bootstrap(config)` or its documented public service/controller contracts.
- Exposes runtime context.
- Subscribes to relevant service events.
- Cleans up subscriptions.
- Handles framework integration and cleanup without owning service lifecycle.

Avoid constructing a kernel or duplicating core runtime composition in React.

### 7.2 Implement application registration API

Expose an ergonomic React integration API for registering React applications through the application service or the supported plugin context.

The adapter must convert React component loaders into the framework-neutral core loader contract.

Example:

```tsx
const marsa = await bootstrap({ plugins: [usersPlugin] });

<MarsaProvider runtime={marsa}>
    <Desktop />
</MarsaProvider>;
```

React hooks still target the earlier direct-kernel API; migrate them to the service-owned state contract with the remaining React runtime integration work.

### 7.3 Implement lifecycle hooks

Provide React hooks for relevant lifecycle events.

Hooks must subscribe and unsubscribe correctly.

### 7.4 Implement application renderer

Implement the React renderer responsible for:

- Loading application components.
- Mounting applications.
- Unmounting applications.
- Handling rendering errors.
- Observing application-instance service state.

### 7.5 Validate rendering integration

Ensure that React integration does not impose SSR or SPA as a core architectural decision.

The host framework determines rendering strategy.

Browser-only functionality must be initialized safely within the relevant runtime boundary.

### Acceptance criteria

- [ ] React provider consumes the bootstrapped runtime/service contracts without constructing a kernel.
- [ ] Applications are registered through service/plugin contracts.
- [ ] React applications load lazily.
- [ ] React trees mount and unmount in response to instance-service events.
- [ ] Service-event subscriptions clean up correctly.
- [ ] React rendering and loading errors are isolated and reported through the runtime error service.
- [ ] Core remains independent of React.
- [ ] Rendering strategy remains a host integration concern.

The current React implementation and its previous test notes target an external `MarsaKernel` and kernel-owned state API. Treat that integration as legacy until it is migrated; do not infer that the current core public exports provide those APIs. App-state hooks are not part of this migration.

**Dependencies:** Phases 3, 4, and 6.

---

---

# Phase 8 — Vite Plugin and Configuration

**Goal:** Provide the main developer-facing configuration and build integration.

### 8.1 Implement configuration types

Implement the centralized Marsa configuration structure.

It must include:

- Kernel settings.
- Window manager settings.
- Notifications.
- UI settings.
- Diagnostics.

Only implement MVP-supported settings as active behavior.

Do not expose configuration for unimplemented post-MVP functionality as if it works.

**Progress:** The initial typed configuration surface is implemented for kernel error-history capacity and IndexedDB adapter settings. Unsupported settings are rejected rather than being presented as active behavior.

### 8.2 Implement configuration resolution

Resolve configuration using the agreed precedence:

1. Explicit runtime overrides.
2. Application-level settings.
3. Environment-specific settings.
4. Framework defaults.

Enforce security restrictions during resolution.

**Progress:** Implemented a pure resolver with runtime > application > environment > defaults precedence. The plugin resolves application and environment layers; a host runtime override mechanism is not wired yet. No security-sensitive settings are currently configurable.

### 8.3 Implement Vite plugin

Implement:

- Configuration validation.
- Configuration resolution.
- Virtual modules.
- Development integration.
- Production integration.
- Build-time diagnostics.

**Progress:** The plugin validates settings with its package-local Zod schema during Vite config resolution, resolves environment-specific values, and exposes a deeply frozen `virtual:marsa/config` module. It also generates `virtual:marsa/runtime`, which constructs a client kernel and exports one-argument application registration helpers and a provider wrapper that forwards the kernel to `@marsa/react`. The Vite plugin itself remains build-time only, and the React provider never constructs a kernel. Development server integration, production-specific integrations, persistence adapter construction, and build-time diagnostics remain pending.

This generated direct-kernel runtime is the current legacy integration and must be replaced with a generated call to core's `bootstrap(config)` after the service/plugin context is available.

The plugin must not initialize the runtime kernel.

### 8.4 Implement application discovery convenience

Explicit registration remains the baseline.

If automatic discovery is implemented in the MVP, use Vite's `import.meta.glob` and ensure that:

- IDs are deterministic.
- Duplicate IDs are detected.
- Metadata is available without eagerly loading components.
- Registration completes before the desktop becomes interactive.
- Loader failures are isolated.

### 8.5 Implement basic HMR

Support basic Vite HMR.

Do not implement advanced state-preservation guarantees.

**Status: pending (deferred).** Defer HMR until the Vite-managed runtime/bootstrap and core integration are in place.

### Acceptance criteria

- [x] Marsa Vite plugin loads successfully.
- [x] Configuration is typed.
- [x] Invalid configuration produces useful errors.
- [x] Virtual configuration module resolves correctly.
- [ ] The generated runtime calls core's bootstrap API and does not construct a kernel directly.
- [x] Core remains independent of Vite.
- [ ] HMR works for supported development changes. **Status: pending (deferred).**
- [x] The plugin adds no HMR runtime code to production output.

Phase 8 is in progress. The Vite package-local build-config schema and resolver are distinct from core's config object; core does not validate its overall config object with Zod. The generated runtime currently targets the legacy direct-kernel API and requires migration to call core bootstrap. Persistence adapter construction, application discovery, production/development-specific integration, and build-time diagnostics remain pending. Basic HMR is explicitly deferred until the runtime integration is established.

**Dependencies:** Phases 1, 2, and 3.

---

# Phase 9 — UI Foundation

**Goal:** Establish the framework-independent design system and Web Component foundation.

### 9.1 Implement Web Component foundation

Establish:

- Custom element registration conventions.
- Shadow DOM conventions.
- Component lifecycle handling.
- Attribute and property conventions.
- Event conventions.
- Accessibility utilities.

Use the `marsa-` prefix for custom elements.

### 9.2 Implement design tokens

Create tokens for:

- Colors.
- Typography.
- Spacing.
- Borders.
- Shadows.
- Radius.
- Focus states.
- Component sizing.

### 9.3 Implement theme system

Support:

- Light.
- Dark.
- System.

Implement configurable accent color and derived interaction colors.

### 9.4 Implement icon provider

Create a framework-independent icon provider contract.

Implement Lucide as the default provider.

Ensure built-in Marsa UI components consume the shared provider.

### 9.5 Implement primitives

Prioritize:

- Button.
- Input.
- Dialog.
- Popover.
- Menu.
- Tooltip.
- Tabs.
- Notification presentation.
- Toolbar.

### 9.6 Implement accessibility and localization foundations

Implement:

- Keyboard interaction.
- Focus management.
- Accessible roles and names.
- Reduced-motion support.
- Localization adapter.
- English default strings.
- RTL support.

### 9.7 Configure Storybook

Create stories for all public UI components.

Include relevant interaction and accessibility tests.

### Acceptance criteria

- [ ] Web Component foundation works.
- [ ] Shadow DOM behavior is consistent.
- [ ] Design tokens are centralized.
- [ ] Light/dark/system themes work.
- [ ] Accent colors derive correctly.
- [ ] Icon provider can be replaced.
- [ ] Built-in icons use the shared provider.
- [ ] UI components work independently of core and React.
- [ ] RTL behavior is tested.
- [ ] Accessibility tests cover interactive components.
- [ ] Storybook runs successfully.

**Dependencies:** Phase 1.

---

# Phase 10 — Window Manager and Layout Engine

**Goal:** Implement the framework-independent window management engine.

### 10.1 Implement layout engine

Implement pure geometry calculations for:

- Window positioning.
- Window resizing.
- Boundary constraints.
- Minimum and maximum dimensions.
- Usable viewport regions.
- Reserved desktop areas.

Keep calculations independent of the DOM.

### 10.2 Implement window manager

Implement:

- Window creation.
- Window destruction.
- Geometry updates.
- Focus management.
- Z-order management.
- Minimize.
- Maximize.
- Restore.
- Basic snapping.

The kernel coordinates operations while the layout engine calculates geometry.

### 10.3 Implement workspace manager

Implement:

- Workspace creation.
- Workspace deletion.
- Workspace selection.
- Window assignment.
- Workspace switching.
- Active workspace state.

### 10.4 Implement basic snapping

Support the MVP snapping behavior.

At minimum, implement the basic supported edge and half-window layouts.

Advanced automatic tiling is not required.

### 10.5 Add interaction tests

Test geometry and state transitions independently of UI.

Include:

- Overlapping windows.
- Window boundaries.
- Minimum dimensions.
- Focus changes.
- Workspace switching.
- Minimize and restore.
- Maximize and restore.

### Acceptance criteria

- [ ] Layout engine is headless.
- [ ] Window manager is kernel-controlled.
- [ ] Window geometry respects constraints.
- [ ] Focus and z-order work.
- [ ] Window lifecycle operations work.
- [ ] Basic snapping works.
- [ ] Workspaces work.
- [ ] Geometry tests pass.

**Dependencies:** Phases 2, 3, and 4.

---

# Phase 11 — Floating Desktop UI and React Rendering

**Goal:** Build the functional floating desktop experience.

### 11.1 Implement desktop shell

Create the desktop shell with:

- Desktop background.
- Window layer.
- Dock.
- Application launcher.
- Workspace controls.

### 11.2 Implement window Web Component

Create `marsa-window`.

It must provide:

- Window frame.
- Title bar.
- Window controls.
- Content container.
- Focus presentation.
- Minimize and maximize presentation.
- Drag and resize interaction.

The component must not become the authoritative window state manager.

### 11.3 Implement desktop controller integration

Connect the UI to the framework-neutral `DesktopController` contract.

The UI must not import `@marsa/core`.

### 11.4 Implement React mounting

The React integration must mount application components into the content container provided by the window component.

It must unmount React trees when required by the kernel.

Do not rely on automatic React-to-Web-Component slot projection.

### 11.5 Implement dock and launcher

Support:

- Application launching.
- Running application indicators.
- Active window indication.
- Focus existing application.
- Basic application metadata presentation.

### 11.6 Implement window interactions

Connect pointer and keyboard interactions to the desktop controller.

The UI must issue commands rather than directly mutating authoritative kernel state.

### Acceptance criteria

- [ ] Desktop shell renders.
- [ ] Applications launch from the desktop.
- [ ] Windows render correctly.
- [ ] Drag and resize work.
- [ ] Focus changes work.
- [ ] Minimize and maximize work.
- [ ] Closing destroys the instance.
- [ ] Dock reflects runtime state.
- [ ] React content mounts and unmounts correctly.
- [ ] UI remains independent of core implementation details.

**Dependencies:** Phases 7, 9, and 10.

---

# Phase 12 — Virtualization Integration

**Goal:** Reduce unnecessary mounted application trees while preserving logical instances and Marsa-managed state.

### 12.1 Implement virtualization eligibility

Determine whether a window can be virtualized.

Respect:

- Application policy.
- Current focus.
- Active workspace.
- Mounted-window limit.
- Application activity requirements.

### 12.2 Implement LRU scheduler

Track last-active timestamps.

When the mounted-window limit is exceeded:

1. Find eligible inactive windows.
2. Select the least recently used candidate.
3. Save Marsa-managed state.
4. Unmount its React tree.
5. Retain its logical instance and window metadata.

### 12.3 Implement restoration

When a virtualized application becomes active:

1. Load its application module if needed.
2. Restore its Marsa-managed state.
3. Mount the React tree.
4. Notify lifecycle subscribers.
5. Update its activity timestamp.

### 12.4 Integrate persistence failures

If persistence fails:

- Preserve state in memory where possible.
- Report a structured error.
- Do not claim durable persistence succeeded.
- Avoid destroying the last valid state.

### Acceptance criteria

- [ ] LRU virtualization works.
- [ ] Ineligible windows are not virtualized.
- [ ] Logical instances survive unmounting.
- [ ] Marsa-managed state is restored.
- [ ] Persistence failures are handled safely.
- [ ] React trees mount and unmount correctly.
- [ ] Tests cover repeated virtualization and restoration.

**Dependencies:** Phases 6, 7, 10, and 11.

---

# Phase 13 — Notification Service and UI Integration

**Goal:** Provide a centralized notification mechanism for applications and the framework.

### 13.1 Implement notification service

Support:

- Notification creation.
- Notification IDs.
- Notification ownership.
- Dismissal.
- Duration.
- Severity.
- Optional actions.

### 13.2 Implement ownership and permissions

Applications may dismiss only their own notifications.

Kernel-owned notifications must not be controlled by applications.

Validate notification permissions.

### 13.3 Implement notification presentation

Implement:

- Toast presentation.
- Banner presentation where applicable.
- Notification center.
- Keyboard accessibility.
- Screen-reader announcements.

Persistent notification history and browser notifications are post-MVP.

### Acceptance criteria

- [ ] Applications can create notifications.
- [ ] Notification permissions are enforced.
- [ ] Ownership rules work.
- [ ] Dismissal works.
- [ ] Accessible announcements work.
- [ ] UI can be replaced without changing core service contracts.

**Dependencies:** Phases 5, 9, and 11.

---

# Phase 14 — Floating Desktop Example

**Goal:** Validate the public developer experience through runnable examples.

### 14.1 Floating dashboard example

Create an independently runnable application demonstrating:

- Floating desktop configuration.
- Application registration.
- Lazy application loading.
- Application instance policies.
- Window creation.
- Window movement and resizing.
- Workspace switching.
- Application lifecycle.
- Marsa-managed state.
- Notifications.

### 14.2 Example quality

Examples must use public package exports.

Do not import private source files from packages.

Keep examples simple enough to serve as onboarding references.

### Acceptance criteria

- [ ] The example installs independently.
- [ ] The example starts successfully.
- [ ] The example uses public APIs only.
- [ ] The example demonstrates the floating desktop.
- [ ] The example is documented.
- [ ] The example works against built workspace packages.

**Dependencies:** Phases 8, 11, 12, and 13.

---

# Phase 15 — Quality Assurance and Compatibility

**Goal:** Validate the MVP across supported browsers and runtime scenarios.

### 15.1 Unit and integration tests

Complete tests for:

- Kernel.
- Registries.
- Lifecycle.
- Permissions.
- Event bus.
- Persistence.
- Window manager.
- Layout engine.
- React integration.
- Vite integration.
- UI components.

### 15.2 End-to-end tests

Floating desktop journeys:

1. Start the desktop.
2. Launch an application.
3. Move and resize its window.
4. Focus another application.
5. Minimize and restore a window.
6. Switch workspaces.
7. Close an application.
8. Reopen the application.
9. Verify instance and state behavior.

### 15.3 Accessibility tests

Validate:

- Keyboard-only operation.
- Focus visibility.
- Accessible names.
- Screen-reader semantics.
- Reduced motion.
- Dialog and menu behavior.
- RTL layout.
- Contrast.

### 15.4 Browser compatibility

Test the latest two stable versions of:

- Chrome.
- Edge.
- Firefox.
- Safari.

The floating desktop must be tested in supported desktop browsers.

Mobile floating behavior is not an MVP requirement.

### 15.5 Performance baseline

Measure:

- Initial startup time.
- Application launch time.
- Lazy-loading behavior.
- Window interaction responsiveness.
- Memory usage with multiple windows.
- Virtualization and restoration latency.
- Event dispatch overhead.
- Persistence latency.

Establish performance budgets from representative workloads.

### Acceptance criteria

- [ ] Required unit tests pass.
- [ ] Required integration tests pass.
- [ ] Critical E2E journeys pass.
- [ ] Accessibility checks pass.
- [ ] Browser compatibility checks pass.
- [ ] Performance measurements are documented.
- [ ] No known critical runtime failures remain.

**Dependencies:** All preceding implementation phases.

---

# Phase 16 — Documentation and Developer Experience

**Goal:** Prepare Marsa for external developers.

### 16.1 Public API documentation

Add JSDoc to public APIs.

Document:

- Parameters.
- Return values.
- Errors.
- Lifecycle behavior.
- Configuration.
- Examples.
- Constraints.

### 16.2 Package documentation

Each package README must explain:

- Package purpose.
- Installation.
- Dependencies.
- Public exports.
- Basic usage.
- Important limitations.

### 16.3 Root documentation

Document:

- Project overview.
- Installation.
- Architecture.
- Floating desktop setup.
- Configuration.
- Examples.
- Browser support.
- Known limitations.

A full documentation website is not required for the MVP.

### 16.4 Verify onboarding

Use the example applications to validate that a new developer can follow the setup instructions without importing internal modules or editing package source code.

### Acceptance criteria

- [ ] Public APIs have JSDoc.
- [ ] Package READMEs exist.
- [ ] Root documentation is current.
- [ ] The floating desktop setup example is documented.
- [ ] Public API examples compile.
- [ ] No documentation claims unsupported functionality.

**Dependencies:** Phases 14 and 15.

---

# Phase 17 — CI/CD and Public npm Prerelease

**Goal:** Prepare the packages for coordinated public distribution.

### 17.1 GitHub Actions CI

Implement workflows for:

- Pull-request validation.
- Linting.
- Formatting.
- Type checking.
- Testing.
- Building.
- Nx affected-project execution.

### 17.2 Release automation

Configure Lerna fixed/locked versioning.

Generate coordinated changelogs.

Validate package dependency compatibility.

### 17.3 npm Trusted Publishing

Configure npm Trusted Publishing using GitHub Actions OIDC.

Requirements:

- Configure the trusted GitHub repository and workflow for each npm package.
- Avoid long-lived publishing tokens.
- Restrict publishing to authorized release workflows.
- Generate provenance attestations where supported.

### 17.4 Prerelease publishing

Publish publicly available prereleases.

Use:

- `latest` for stable releases.
- `next` for alpha, beta, and release-candidate releases.

Verify package installation after publishing.

### 17.5 Release validation

Before publishing:

- Run all required tests.
- Build all packages.
- Verify exports.
- Verify package dependencies.
- Check changelogs.
- Check version consistency.
- Verify examples against packaged artifacts.

### Acceptance criteria

- [ ] CI runs successfully.
- [ ] Release workflow validates all packages.
- [ ] Lerna coordinated versions work.
- [ ] npm Trusted Publishing works.
- [ ] Public prerelease packages install correctly.
- [ ] Stable and prerelease tags are assigned correctly.
- [ ] Published examples work against published packages.

**Dependencies:** Phases 15 and 16.

---

# 3. Final MVP Release Gate

The MVP is considered ready for public release only when all required gates pass.

## Architecture

- [ ] Core is independent of React and Vite.
- [ ] UI is independent of core.
- [ ] Runtime ownership belongs to core domain services; the kernel remains a small integration boundary.
- [ ] Package dependency rules are respected.
- [ ] No unintended circular dependencies exist.

- [ ] Applications launch.
- [ ] Lazy loading works.
- [ ] Single-instance policies work.
- [ ] Windows move and resize.
- [ ] Focus and z-order work.
- [ ] Minimize and maximize work.
- [ ] Workspaces work.
- [ ] Basic snapping works.
- [ ] Closing destroys instances correctly.

## Runtime

- [ ] Lifecycle operations work.
- [ ] Application errors are isolated.
- [ ] Permissions are enforced.
- [ ] Event bus works.
- [ ] Notifications work.
- [ ] Virtualization works.
- [ ] Marsa-managed state restores correctly.
- [ ] IndexedDB persistence works.

## UI

- [ ] Web Components work.
- [ ] Shadow DOM encapsulation works.
- [ ] Light, dark, and system themes work.
- [ ] Shared icon provider works.
- [ ] RTL support works.
- [ ] Accessibility requirements are met.

## Developer experience

- [ ] Vite plugin works.
- [ ] Configuration validation works.
- [ ] React integration works.
- [ ] The floating example runs independently.
- [ ] Documentation is sufficient for onboarding.

## Quality and distribution

- [ ] Unit and integration tests pass.
- [ ] Critical E2E tests pass.
- [ ] Browser compatibility is validated.
- [ ] Performance baseline is recorded.
- [ ] CI/CD works.
- [ ] npm Trusted Publishing works.
- [ ] Public prerelease packages install correctly.

---

# 4. Explicitly Excluded from MVP

Unless explicitly approved, do not implement:

- Advanced automatic tiling.
- Tabbed window groups.
- Shake to Focus.
- Advanced worker scheduler.
- Cooperative worker preemption.
- Worker checkpointing.
- Durable event delivery.
- Dead-letter queues.
- Session restoration.
- Runtime permission consent manager.
- Browser notifications.
- Advanced diagnostics UI.
- Advanced HMR state preservation.
- Multi-monitor support.
- Mobile desktop experience.
- Vue or Svelte adapters.
- Full third-party plugin ecosystem.

These features belong to future implementation plans.

---

# 5. Agent Execution Protocol

AI coding agents must follow this protocol.

### Before starting a task

1. Read `AGENTS.md`.
2. Read this `PLAN.md`.
3. Inspect the relevant package.
4. Review the relevant architecture specification.
5. Identify dependencies and acceptance criteria.
6. Check the current Git state.

### During implementation

1. Work on one focused task at a time.
2. Follow existing patterns.
3. Keep changes within the appropriate package.
4. Add tests alongside implementation.
5. Avoid unrelated refactoring.
6. Do not introduce post-MVP features.
7. Update documentation when necessary.

### Before completing a task

1. Run relevant tests.
2. Run type checking.
3. Run linting and formatting checks.
4. Run the relevant package build.
5. Inspect the final diff.
6. Verify acceptance criteria.
7. Update task status in this plan.
8. Record relevant decisions or blockers.

### When a task is blocked

Do not work around architectural restrictions silently.

Record:

- The blocked task.
- The reason.
- The missing dependency or decision.
- Possible solutions.
- The recommended next action.

Ask for clarification when the decision affects public APIs or architecture.

### When a phase is complete

Verify every acceptance criterion.

Only then proceed to the next phase.

---

# 6. Completion Principle

Marsa should be implemented incrementally.

The objective is not to maximize the amount of code written. The objective is to produce a reliable, tested, maintainable framework that satisfies the MVP requirements.

**Implement the smallest complete solution for each phase, verify it, document it, and then continue.**
