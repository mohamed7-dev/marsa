# @marsa/indexeddb-persistence

Browser IndexedDB adapter for Marsa's framework-independent persistence contract.

The package implements the public `PersistedRecord` and `PersistenceAdapterStrategy` contracts from `@marsa/core`. Core's generic `StateService` uses the adapter without depending on this package or browser APIs. Runtime services and plugins should normally access state through `StateService` rather than calling the adapter directly.

```ts
import { bootstrap } from '@marsa/core';
import { IndexedDbPersistencePlugin } from '@marsa/indexeddb-persistence';

bootstrap({
    plugins: [IndexedDbPersistencePlugin],
});
```

Each `store(name)` handle scopes reads, writes, deletes, and `entries()` to one named IndexedDB object store. The object store is created lazily on the first operation, which may upgrade the database version. Writes resolve only after the IndexedDB transaction completes. The database name, legacy backing object-store name, minimum database version, and `IDBFactory` can be configured. Existing records in the previous default object store remain available through the `application-state` store name. Use `close()` to release the connection; later operations reopen the database.

The package requires a browser or another runtime that supplies the IndexedDB API. Importing the package is safe in non-browser environments; constructing the adapter without an IndexedDB implementation throws an explicit error.
