# Package boundaries

Marsa packages communicate through public, typed contracts. Keep implementation details private and do not import another package's source files.

| Package                        | Owns                                            | Dependency boundary                                                          |
| ------------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `@marsa/core`                  | Framework-independent runtime, schemas, kernel  | Zod runtime validation; no framework, UI, router, or build-tool dependencies |
| `@marsa/indexeddb-persistence` | Browser IndexedDB persistence adapter           | Implements public persistence contracts from `@marsa/core`                   |
| `@marsa/react`                 | React providers, hooks, and rendering lifecycle | Requires a kernel created outside the package; may depend on core and React  |

These are package ownership boundaries, not claims that the planned APIs are implemented. See [AGENTS.md](../AGENTS.md) and [SPEC-001-Marsa.md](../SPEC-001-Marsa.md) for the full architecture.
