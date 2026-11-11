# Marsa — Repository Guidelines for AI Coding Agents

## 1. Project Overview

Marsa (مرسى) is a framework for building modern administrative dashboards and web applications.

Its goal is to bring multiple web applications together into one seamless workspace.

Marsa provides a desktop-like environment where applications run inside independently managed windows.

The desktop experience takes inspiration from GNOME 40, Pop!_OS, and tiling window managers.

Marsa is designed to be extensible, modular, framework-independent at its core, and suitable for integration with different JavaScript UI frameworks.

**Important:** Before implementing a feature, understand which architectural layer owns its responsibility. Do not introduce dependencies or responsibilities into the wrong layer for convenience.

---

## 2. General Instructions

When working in this repository:

1. Read this file before making changes.
2. Inspect the existing implementation before proposing or implementing modifications.
3. Follow the established architecture and coding conventions.
4. Prefer small, focused, maintainable changes.
5. Avoid unnecessary abstractions and premature optimization.
6. Do not introduce dependencies without a clear technical justification.
7. Do not duplicate functionality that already exists.
8. Preserve backward compatibility unless a breaking change is explicitly requested.
9. Update tests and documentation when changing public behavior.
10. Never silently change public APIs, configuration contracts, or architectural boundaries.

When requirements are ambiguous:

- Inspect related implementations and existing contracts.
- Follow established repository patterns.
- Prefer the simplest solution consistent with the architecture.
- Ask for clarification when a decision could materially affect public APIs or architectural boundaries.
- Do not invent requirements or claim that an unimplemented capability exists.

When proposing architectural changes, explain the trade-offs and affected packages before implementing them.

---

## Implementation Roadmap

The repository root contains a `PLAN.md` file that defines the implementation roadmap for the Marsa MVP.

**All AI coding agents and contributors must read `PLAN.md` before starting implementation work.**

The `PLAN.md` file defines:

- Implementation phases and their dependencies.
- Detailed development tasks.
- Expected deliverables.
- Acceptance criteria.
- Testing and verification requirements.
- MVP release gates.
- Features explicitly excluded from the MVP.

### Implementation rules

1. Follow the implementation phases in `PLAN.md` in dependency order.
2. Complete and verify the acceptance criteria for a task before marking it complete.
3. Update task statuses in `PLAN.md` as work progresses.
4. Do not skip prerequisites or begin dependent phases prematurely.
5. Do not implement post-MVP or future features unless explicitly requested.
6. If implementation reveals architectural decisions missing from `PLAN.md` or `SPEC-001-Marsa`, document them and request clarification when necessary.
7. Keep `PLAN.md` synchronized with actual implementation progress. Do not mark unimplemented functionality as complete.
8. If a package-specific `AGENTS.md` is introduced, follow it in addition to this root file and the implementation roadmap.

**Priority of guidance:**

- `AGENTS.md` defines repository-wide development rules and architectural constraints.
- `SPEC-001-Marsa` defines the intended system architecture and requirements.
- `PLAN.md` defines the implementation sequence, tasks, and completion criteria.
- Package-specific `AGENTS.md` files define additional package-level implementation conventions.

If these documents appear to conflict, do not silently choose an interpretation. Report the conflict and request clarification.

## 3. Architectural Principles

Marsa follows these principles:

### 3.1 Separation of Concerns

Each package must own a clearly defined responsibility.

Do not mix:

- Core runtime logic with UI rendering.
- Build-time configuration with runtime initialization.
- Framework-specific behavior with framework-independent contracts.
- Application definitions with application instances.
- Window geometry calculations with kernel orchestration.
- UI presentation with business logic.

### 3.2 Headless Core

`@marsa/core` must remain framework-independent.

It must not depend on:

- React.
- Vue or other UI frameworks.
- Vite.
- `@marsa/ui`.
- Browser-specific rendering implementations.

The core must not assume whether the host application uses:

- SSR.
- SPA.
- Hydration.
- Client-side rendering.
- A particular UI framework.

Browser-specific functionality must be isolated behind appropriate interfaces or adapters.

Zod is an explicit core runtime dependency used only for modular domain schemas and validation at runtime boundaries; it does not make core framework- or browser-dependent.

### 3.3 Integration Through Contracts

Packages should communicate through explicit, typed public contracts.

Prefer dependency inversion over direct implementation dependencies.

Avoid circular dependencies.

Do not import internal modules from another package when a public contract is available.

### 3.4 Services as the Source of Truth

Core domain services own authoritative runtime state and business behavior. Services are grouped by concern, composed during bootstrap, and made available to integrations and plugins through typed contracts.

The kernel is a small runtime integration boundary. It may coordinate initialization, shutdown, plugin installation, and composition, but it must not duplicate application, lifecycle, permission, persistence, event, or error business logic.

UI frameworks are rendering and interaction layers, not authoritative state managers. They consume service/controller contracts and observe runtime events.

### 3.5 Extensibility

Design public contracts with future integrations in mind.

However, do not implement speculative features or infrastructure without an MVP requirement.

Provide stable extension points where appropriate, while keeping the initial implementation simple.

Plugins receive the configured service context and use its services for domain operations such as installing applications and creating instances. Do not require plugins to reach into kernel internals or register business logic in UI integrations.

---

## 4. Repository Structure

The repository is a pnpm-based monorepo managed with Nx and Lerna.

Expected structure:

```text
marsa/
├── packages/
│   ├── core/
│   ├── indexeddb-persistence/
│   ├── react/
│   ├── ui/
│
├── examples/
│   └── floating-dashboard/
│
├── playground/
├── docs/
├── tools/
│
├── nx.json
├── lerna.json
├── pnpm-workspace.yaml
├── package.json
└── AGENTS.md
```

This is the intended architectural structure. Inspect the actual repository before assuming that every directory or package has already been implemented.

The floating dashboard example demonstrates the framework's single application model.

### Package responsibilities

| Package                        | Responsibility                                                           |
| ------------------------------ | ------------------------------------------------------------------------ |
| `@marsa/core`                  | Bootstrap, service-owned runtime behavior, domain schemas, and contracts |
| `@marsa/indexeddb-persistence` | Browser IndexedDB adapter implementing core persistence contracts        |
| `@marsa/react`                 | React integration, providers, hooks, and rendering lifecycle             |
| `@marsa/ui`                    | Framework-independent UI components using native Web Components          |

### Dependency rules

The following rules are mandatory:

1. `core` must not depend on any integration or UI package.
2. `indexeddb-persistence` may depend on `core` only through its public exports, and owns browser-specific IndexedDB code.
3. `core` must not depend on `indexeddb-persistence`; it owns the adapter contract. Application-state coordination is deferred until its service and lifecycle integration is designed.
4. `ui` must not depend on `core`.
5. `react` may depend on `core` and React.
6. `core` uses Zod for domain/runtime schemas, not for validating the top-level Marsa config object. Keep schemas modular by concern under `core/src/schemas`; do not put schema definitions in `core/src/config`. Validate untrusted domain inputs at their service/public runtime boundaries and derive public contract types from schemas where practical.
7. `vite` owns its build-time configuration schema and must not initialize runtime services. Generated runtime code may call the public bootstrap API for the host application.
8. Integration packages must communicate through public contracts.
9. No package may introduce circular dependencies.

If a proposed change violates these rules, reconsider the design before implementation.

---

## 5. Application Runtime

Marsa has one application model: a desktop-like workspace where registered applications run inside windows.

Characteristics:

- The desktop shell is the host application's main entry experience.
- Applications are launched as windows.
- Core services control application instances and window management.
- Applications may support single or multiple instances.
- Applications are loaded lazily.
- React trees are mounted only when required.
- Windows and workspaces are managed independently of application definitions.

Register applications through the application registry.

---

## 6. Application and Runtime Lifecycle

Always distinguish between:

- Application definition.
- Application instance.
- Window.
- Workspace.

An application definition describes an application and how to load it.

An application instance represents one execution of that application.

A window represents its visual presentation.

A workspace represents the desktop environment containing windows.

These concepts must not be conflated.

### Lifecycle ownership

The lifecycle and instance services own lifecycle transitions.

React adapters observe service events and manage rendering in response.

Closing an application must:

- Execute applicable before-close hooks.
- Respect cancellation.
- Clean up subscriptions and resources.
- Unmount its framework rendering tree.
- Destroy the logical instance.
- Release associated runtime resources.

Launching the application again creates a new instance unless explicitly configured otherwise.

Do not rely on React component state as the authoritative application state.

---

## 7. State Management and Persistence

Marsa distinguishes between:

1. Temporary UI state.
2. Instance-scoped application state.
3. Durable application state.
4. Session and desktop state.

Use Marsa-managed state APIs for state that must survive virtualization.

Do not claim that arbitrary React-local state can be serialized or restored automatically.

Persistence requirements:

- IndexedDB is the default browser persistence implementation.
- Persistence must be replaceable through adapters.
- Persisted state must support schema versions and migrations.
- Persistence failures must be handled gracefully.
- Failed writes must never be reported as successful.
- Applications must not crash because persistence fails.

Virtualization must preserve logical application instances while allowing their UI trees to be unmounted.

Do not destroy an application instance merely because its UI is unmounted.

The existing application-state store is not yet integrated with the agreed bootstrap/service/plugin architecture. Do not expose it through the kernel or plugin service context until restore timing, lifecycle flush/cleanup, ownership, and failure behavior are specified. Track that integration as deferred work in `PLAN.md`; do not claim that arbitrary application state is currently available through the runtime.

---

## 8. Window Management

Window management belongs to the core runtime, not React components.

The window manager owns:

- Window geometry.
- Focus.
- Z-order.
- Minimize and maximize operations.
- Window lifecycle.
- Workspace association.
- Presentation state.

The layout engine is responsible for calculating geometry and layouts.

Keep the layout engine independent from UI rendering and kernel orchestration.

### Geometry conventions

Window geometry uses CSS pixels relative to the active display viewport.

```ts
interface WindowGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
}
```

Respect:

- Minimum and maximum dimensions.
- Usable viewport bounds.
- Reserved desktop areas.
- Workspace boundaries.
- Existing layout constraints.

Do not use device pixels or physical screen pixels for window geometry.

Advanced features such as automatic tiling, tab groups, and Shake to Focus are not MVP requirements unless explicitly requested.

---

## 9. UI Architecture

`@marsa/ui` uses native Web Components and Shadow DOM.

The UI package must remain framework-independent.

### Component conventions

Custom elements use the `marsa-` prefix.

Examples:

```html
<marsa-button></marsa-button>
<marsa-window></marsa-window>
<marsa-dock></marsa-dock>
```

Shadow DOM should encapsulate component chrome and internal styling.

Application content should remain accessible through explicitly defined content containers or slots.

Do not assume React children automatically mount into Web Component slots.

The React adapter is responsible for mounting and unmounting React trees into the content container exposed by the relevant Web Component.

### Design system

All built-in UI components must use the shared Marsa design system.

This includes:

- Typography.
- Colors.
- Spacing.
- Borders.
- Shadows.
- Themes.
- Icons.
- Focus styles.
- Accessibility behavior.

Support light, dark, and system themes.

The configurable accent color must derive its related interaction colors automatically.

Structural design tokens remain controlled by the framework.

### Icons

Use the shared icon provider abstraction.

Lucide is the default provider.

Built-in UI components must use the shared provider rather than hardcoding icons from a specific library.

Missing icons must have a predictable fallback.

---

## 10. Internationalization and Accessibility

English is the default locale.

Arabic and RTL support are first-class requirements from the beginning.

All user-facing framework strings must be localizable.

Do not hardcode user-facing text inside reusable components.

Components must respect configured locale and text direction.

The default UI targets WCAG 2.2 AA.

Accessibility is not an optional enhancement.

Pay particular attention to:

- Keyboard navigation.
- Focus management.
- Accessible names and roles.
- Screen-reader announcements.
- Dialog and menu behavior.
- Color contrast.
- Reduced-motion preferences.
- RTL layout behavior.

New interactive components must include appropriate accessibility behavior and tests.

---

## 11. Configuration and Build Integration

Core configuration is supplied as a typed configuration object and resolved through the existing process-global config state. Preserve that global behavior unless a task explicitly changes it. Core does not define or run a Zod schema over the overall config object; remove/avoid config-options schemas. Validate domain inputs (for example application definitions, lifecycle hooks, persistence records, and permission grants) with their concern-specific schemas instead. Keep those schemas under `core/src/schemas`, not in `core/src/config`.

The process-global config behavior is a known constraint: calls to `bootstrap` share and merge against the same active config, so independent runtime configurations are not isolated, repeated bootstraps may retain prior overrides, and concurrent bootstrap/plugin-configuration work can interleave. Tests and consumers that need a clean default must use the existing reset path. Do not silently change this contract as part of service refactoring.

The Vite plugin is responsible for build-time integration.

It may:

- Validate configuration.
- Generate virtual modules.
- Resolve build-time settings.
- Integrate with Vite development behavior.
- Support application discovery conveniences.

The plugin itself must not construct or initialize runtime services. Its generated client runtime module may call the public bootstrap API and expose configured runtime helpers to the host application.

The runtime is constructed through bootstrap, not by `@marsa/react`. React providers consume the bootstrapped runtime or its public service/controller contracts and expose framework integration to hooks and renderers. Register/install applications through the application service before integrations consume the application registry.

Configuration must be type-safe, documented, predictable, and explicit about defaults. Core does not perform config-object schema validation. Core schemas are the source of truth for domain runtime data contracts; validate those values at service boundaries and leave intentionally opaque payloads opaque. The Vite package owns its separate schema for Vite-specific plugin configuration.

---

## 12. Error Handling

Use centralized error management for runtime failures.

Do not silently swallow errors.

Do not expose raw internal exceptions directly to end users.

Errors should be categorized and include enough context to diagnose the problem.

Expected categories:

- `application`
- `integration`
- `kernel`
- `fatal`

Application errors should be isolated whenever possible.

Kernel errors should attempt safe recovery without corrupting the last valid runtime state.

Fatal errors may require entering safe mode.

Use React error boundaries for React rendering errors, but do not make React error boundaries responsible for runtime error management.

---

## 13. Security and Permissions

Marsa uses capability-based permissions.

Protected operations must be checked by the owning service at the operation boundary.

Rules:

1. Default deny.
2. Applications cannot grant themselves capabilities.
3. Permissions must be checked at the operation boundary.
4. Permission revocation must prevent subsequent protected operations.
5. Workers and subscriptions must respect applicable permissions.
6. Audit records must not contain sensitive application data.

Do not implement security checks only in UI components.

Hiding an action in the UI is not a substitute for enforcing its permission in the owning service.

---

## 14. Coding Standards

### Language

Use TypeScript for implementation.

Enable strict TypeScript checking.

Avoid `any` unless there is a clear technical reason and the usage is contained.

Prefer:

- Explicit interfaces.
- Discriminated unions.
- Narrow types.
- Readonly contracts where appropriate.
- Predictable error types.
- Small, cohesive modules.

Avoid unnecessarily complex generic types.

### Naming

Use descriptive names.

Prefer:

```ts
ApplicationDefinition;
ApplicationInstance;
WindowGeometry;
WorkspaceManager;
PermissionManager;
```

Avoid unclear abbreviations and overly generic names.

Public APIs should use consistent terminology across packages.

### Exports

Use explicit package exports.

Do not expose internal modules accidentally.

Do not import package internals through relative paths from another package.

Use the package's public exports.

### Dependencies

Before adding a dependency:

1. Check whether the functionality already exists.
2. Evaluate whether the dependency belongs in the current package.
3. Check compatibility with the repository's supported runtime and toolchain.
4. Prefer actively maintained dependencies.
5. Avoid introducing unnecessary runtime dependencies.
6. Document significant architectural dependencies.

Do not upgrade major dependency versions without checking compatibility and the impact on the monorepo.

---

## 15. Testing Requirements

Testing is part of implementation, not a separate final activity.

Use the following tools:

| Tool                  | Purpose                                          |
| --------------------- | ------------------------------------------------ |
| Vitest                | Unit and integration tests                       |
| React Testing Library | React integration tests                          |
| Playwright            | End-to-end testing                               |
| Storybook             | UI component development and interaction testing |
| Nx                    | Affected-project task execution                  |

### Testing rules

- Add tests for new functionality.
- Update existing tests when behavior changes.
- Test important failure paths.
- Test lifecycle transitions.
- Test public API behavior.
- Test permission enforcement.
- Test state restoration.
- Test accessibility behavior for UI changes.
- Avoid tests that merely duplicate implementation details.

Critical journeys must be tested across application launch, window lifecycle, workspace changes, and persistence.

Target coverage:

- Core runtime services: 90%.
- Window manager and layout engine: 90%.

Coverage percentages are targets, not a substitute for meaningful tests.

---

## 16. Documentation Requirements

Public APIs must include JSDoc documentation.

Document:

- Purpose.
- Parameters.
- Return values.
- Errors and exceptions.
- Lifecycle behavior.
- Configuration defaults.
- Usage examples when they materially clarify API use.
- Important constraints.

### JSDoc format for public APIs and contracts

Use concise JSDoc as the source for the documentation website. Every public API, contract, and interface property must have a JSDoc block beginning with exactly one `@description` directive. Its content must appear immediately below the directive; do not add summary prose before it or repeat `@description`.

Put references inside the description as inline links using `@link{EntityName}`. Do not use standalone `@link` tags.

Use `@docsPage` for the documentation page path and `@docsCategory` for its category. Also add `@since` when the introduction version is known and `@docsWeight` when explicit page ordering is useful. Do not invent release versions or add redundant ordering metadata.

Examples are optional; do not add `@example` to every API, type, or property. Include one only when it materially clarifies API use, a non-obvious workflow, or behavior. Omit examples that merely restate a type, property, literal, or isolated value/object declaration (for example, `const instancePolicy: InstancePolicy = 'single'`). Prefer meaningful API interactions over boilerplate.

When an example is useful, put `@example` on its own line, followed on the next line by a fenced code block with a language identifier, usually `ts`:

```ts
const value = makeValue();
```

Document every interface property individually using the same metadata rules. Add a property example only when it materially clarifies how to supply or interpret that property; keep it short and use a fenced code block.

Put any note inside the description using this exact directive:

:::info
Concise note.
:::

Keep all documentation messages as concise as possible without sacrificing clarity. Avoid repeating information already obvious from a type or nearby description. Examples must reflect working, implemented behavior.

When changing public behavior:

1. Update JSDoc.
2. Update relevant package documentation.
3. Update examples where necessary.
4. Document breaking changes and migration paths.

Do not document unimplemented functionality as if it already exists.

---

## 17. Git and Contribution Conventions

Use Conventional Commits.

Examples:

```text
feat(core): add application registry
fix(react): prevent duplicate application mounting
feat(ui): add window controls
docs: update architecture documentation
test(core): cover lifecycle cancellation
refactor(vite): simplify configuration resolution
```

Branching strategy:

- `main`: integration branch.
- `feature/*`: short-lived feature branches.
- `fix/*`: short-lived fix branches.
- `v1.x`, `v2.x`, etc.: long-lived major-version maintenance branches.

New major-version development continues on `main`.

Supported release branches receive compatible maintenance and applicable security fixes.

Only the latest two major versions are supported.

Do not directly modify release branches unless the change is intended for that release line.

---

## 18. CI/CD and Release Rules

GitHub Actions is the CI/CD platform.

Pull requests must pass the applicable:

- Formatting checks.
- Linting.
- Type checking.
- Tests.
- Package builds.

Nx should execute affected-project tasks where appropriate.

Lerna uses fixed/locked versioning to coordinate package releases.

All packages in a coordinated release use the same version.

npm publishing uses Trusted Publishing with GitHub Actions OIDC.

Never introduce long-lived npm publishing tokens into the repository.

Stable releases use the `latest` npm dist-tag.

Public alpha, beta, and release-candidate releases use the `next` dist-tag.

Publishing must require successful validation and an authorized release workflow.

---

## 19. MVP Scope Discipline

Marsa has a broader long-term architecture, but the initial implementation must remain focused.

### MVP capabilities

Prioritize:

- Headless core.
- Desktop workspace runtime.
- React integration.
- Vite plugin.
- Web Components UI.
- Basic window management.
- Basic workspaces.
- Basic snapping.
- Application lifecycle.
- Virtualization.
- Instance-scoped state.
- IndexedDB persistence.
- Transient event bus.
- Capability-based permissions.
- Error management.
- In-app notifications.
- Accessibility and RTL support.
- Testing and example applications.
- CI/CD and public npm prereleases.

### Post-MVP capabilities

Do not implement these without an explicit task:

- Advanced automatic tiling.
- Tabbed window groups.
- Shake to Focus.
- Advanced worker scheduling.
- Durable event delivery.
- Session restoration.
- Runtime permission consent manager.
- Browser notifications.
- Advanced diagnostics and developer inspector.
- Advanced HMR state preservation.

### Future research

- Vue and Svelte integrations.
- Multi-monitor support.
- Mobile desktop workspace.
- Full plugin ecosystem.
- Advanced resource management.

When implementing MVP features, avoid blocking these future capabilities through unnecessarily restrictive contracts.

However, do not build speculative infrastructure solely to support hypothetical future requirements.

---

## 20. Definition of Done

A change is considered complete when applicable conditions are satisfied:

- [ ] Implementation follows the established architecture.
- [ ] Package dependency rules are respected.
- [ ] Public contracts are typed and documented.
- [ ] Relevant tests have been added or updated.
- [ ] Existing tests continue to pass.
- [ ] Linting and formatting checks pass.
- [ ] Type checking passes.
- [ ] Relevant package builds succeed.
- [ ] Accessibility requirements are addressed for UI changes.
- [ ] Error paths are handled.
- [ ] No unrelated functionality has been modified.
- [ ] Documentation and examples are updated where necessary.

For public API changes, also verify compatibility and release implications.

---

## 21. Instructions for Future Package-Level AGENTS.md Files

Package-specific `AGENTS.md` files may be introduced later.

They should provide additional instructions for their respective package, such as:

- Package-specific architecture.
- Internal module structure.
- API conventions.
- Testing strategy.
- Implementation patterns.
- Package-specific restrictions.
- Build and development commands.

Package-level instructions must complement this root document.

If a package-specific instruction appears to contradict a repository-wide architectural rule, do not silently follow the conflicting instruction. Flag the conflict for clarification.

---

## 22. Final Guidance

Marsa is intended to become a reliable framework, not merely a collection of UI components.

Prioritize:

1. Correct architecture.
2. Clear package boundaries.
3. Predictable runtime behavior.
4. Strong TypeScript contracts.
5. Maintainability.
6. Accessibility.
7. Developer experience.
8. Incremental delivery.

**Build the smallest correct implementation that satisfies the current requirement while preserving the architecture's intended direction.**

Do not sacrifice architectural integrity for short-term convenience.
