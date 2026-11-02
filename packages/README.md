# Package boundaries

Marsa packages communicate through public, typed contracts. Keep implementation details private and do not import another package's source files.

| Package                  | Owns                                            | Dependency boundary                                                      |
| ------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------ |
| `@marsa/core`            | Framework-independent runtime and kernel        | No framework, UI, router, build-tool, or validation-library dependencies |
| `@marsa/react`           | React providers, hooks, and rendering lifecycle | May depend on core and React                                             |
| `@marsa/ui`              | Native Web Components and design system         | Must not depend on core or a UI framework                                |
| `@marsa/vite`            | Build-time configuration and Vite integration   | Must not initialize the runtime kernel                                   |
| `@marsa/router-tanstack` | TanStack Router adapter                         | Depends on core contracts and TanStack Router                            |
| `@marsa/validation-zod`  | Zod validation adapter                          | Implements framework-independent validation contracts                    |

These are package ownership boundaries, not claims that the planned APIs are implemented. See [AGENTS.md](../AGENTS.md) and [SPEC-001-Marsa.md](../SPEC-001-Marsa.md) for the full architecture.
