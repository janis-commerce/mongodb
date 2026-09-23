# Migration guide: 3.x → 4.0

This guide is for consumers of `@janiscommerce/mongodb` upgrading from `3.x` to `4.0.0`.

`4.0.0` upgrades the underlying [mongodb](https://www.npmjs.com/package/mongodb) driver from `^4.x.x` to `^7.6.0`. This is a breaking change, summarized below.

## At a glance

| Change | Action required? |
| --- | --- |
| [Node version](#node-version) | Yes — bump Node to `>= 20.19.0` |
| [`ObjectId` requires `new`](#objectid-requires-new) | Yes, if you call `ObjectId(...)` directly |
| [`increment()` returns the post-update document](#increment-returns-the-post-update-document) | Only if your code relies on the previous (pre-update) return value |
| [`dropCollection()` no longer throws for a non-existent collection](#dropcollection-no-longer-throws-for-a-non-existent-collection) | Only if your code relies on the rejection |
| [Connection strings use strict booleans](#connection-strings-use-strict-booleans) | Only if your connection string uses non-strict boolean values |
| [`multiUpdate()` with `rawResponse` resolves instead of rejecting](#multiupdate-with-rawresponse-resolves-instead-of-rejecting) | Yes, if you use `rawResponse: true` |
| [`aggregate()` and `batchSize`](#aggregate-and-batchsize) | Only if your pipeline needs a specific `getMore` batch size |

## Node version

The driver requires Node `>= 20.19.0`. Update `engines.node` in your `package.json` and, if deployed as a Lambda, use `nodejs22.x` as the runtime.

## `ObjectId` requires `new`

`bson >= 5` (bundled by driver `^7.x`) no longer allows calling `ObjectId` without `new`:

```js
ObjectId('5df0151dbc1d570011949d86'); // TypeError: Class constructor ObjectId cannot be invoked without 'new'

new ObjectId('5df0151dbc1d570011949d86'); // OK
```

`ObjectId` is exported from this package's entrypoint, so there's no need to depend on `mongodb` directly just to build one:

```js
const { ObjectId } = require('@janiscommerce/mongodb');
```

A deep import from `lib/mongodb-wrapper` still works for backward compatibility, but it's not part of the public API — use the entrypoint import above.

## `increment()` returns the post-update document

`increment()` now resolves the document **after** applying the `$inc` (or `null` if no document matched the filters). Previous versions returned the pre-update document, since the driver never actually supported the `returnNewDocument` option this package used to pass. See [`increment()`](../README.md#async-incrementmodel-filters-incrementdata-setdata) for the current contract.

## `dropCollection()` no longer throws for a non-existent collection

Dropping a collection that doesn't exist no longer rejects. The resolved boolean now depends on the MongoDB server version: `false` on 6.0, `true` on 7.0+ (the `drop` command became idempotent on non-existent namespaces). If you need to know whether the collection existed beforehand, check it separately (e.g. with `getIndexes()` or by listing collections). See [`dropCollection()`](../README.md#async-dropcollectioncollection).

## Connection strings use strict booleans

The driver's connection string parser now only accepts `true`/`false` for boolean options. Values like `ssl=1` or `retryWrites=yes` are rejected:

```
# Before, tolerated:
mongodb://host/db?ssl=1&retryWrites=yes

# Now, required:
mongodb://host/db?ssl=true&retryWrites=true
```

## `multiUpdate()` with `rawResponse` resolves instead of rejecting

**In `3.x`**, a write error made the promise **reject** with a generic `MongoDBError`. The documented detail was unreachable: `writeErrors` and `writeConcernErrors` always resolved as empty arrays and every `operations[].success` was `true`. The bulk write was ordered, so the operations after the failing one were never executed.

**In `4.0`**, when `rawResponse: true` is used the bulk write runs **unordered** and the promise **resolves** with `success: false` and the real detail from the driver: `writeErrors`, `writeConcernErrors` and the per-operation `success`/`errors`. Every operation is attempted, so the ones after a failing operation are applied too.

Any other failure (connection, timeout, invalid operation) keeps rejecting with `MongoDBError`. **Without `rawResponse` nothing changes**: the bulk write is still ordered and a write error still rejects.

**How to migrate:** code that relied on the rejection to detect failures — for example a consumer that let the error propagate so the message is retried — must now inspect `success` (or `operations[].success`), because the promise no longer rejects:

```js
// Before (3.x): the rejection was the only failure signal
await mongo.multiUpdate(model, operations, { rawResponse: true });

// After (4.0): the failure detail comes in the resolved response
const result = await mongo.multiUpdate(model, operations, { rawResponse: true });

if(!result.success) {
   const failedOperations = result.operations.filter(operation => !operation.success);
   throw new Error(`multiUpdate failed for ${failedOperations.length} of ${result.operations.length} operations`);
}
```

See [`multiUpdate()`](../README.md#async-multiupdatemodel-operations-options) for the full `rawResponse` shape.

## `aggregate()` and `batchSize`

The driver no longer defaults `getMore` batches to `1000`. `aggregate()` forwards its `options` argument to the underlying cursor, so pass `batchSize` explicitly if your pipeline needs a specific value:

```js
await mongo.aggregate(model, [{ $match: { status: 'active' } }], { batchSize: 1000 });
```

## Migration checklist

1. Bump Node to `>= 20.19.0` (`nodejs22.x` runtime for Lambdas) and update `engines.node`.
2. Search your codebase for bare `ObjectId(...)` calls and add `new` (e.g. `perl -i -pe 's/(?<!new )\bObjectId\(/new ObjectId(/g'`).
3. Review every `increment()` call site for code that assumed the pre-update document was returned.
4. Review connection strings for non-strict boolean values (`ssl=1`, `retryWrites=yes`) and switch them to `true`/`false`.
5. Review every `multiUpdate(..., { rawResponse: true })` call site: replace reliance on the rejection with a check on `result.success` / `result.operations[].success`.
6. Review `dropCollection()` call sites that relied on the rejection to detect a non-existent collection.
7. Review `aggregate()` calls that are performance-sensitive and set `batchSize` explicitly if needed.
8. Run your test suite against `4.0.0`.

## See also

For the technical rationale behind each of these changes — what changed in the driver across `4` → `5` → `6` → `7` and how it was analyzed before implementing — see [`driver-v4-to-v7-analysis.md`](./driver-v4-to-v7-analysis.md).
