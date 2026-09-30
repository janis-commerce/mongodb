# Plan: integration tests por método

> Spec: `specs/jcn-555-mongodb-driver-v7-upgrade.md` · Verificación de cada batch: `npm run lint` + `npm test` + `npm run test-integration` (6.0.24, 7.0.21, 8.0.12)

## Batch 1 — Base
- [x] `integration-tests/fixtures/_model.js`: agregar `fields` (`isID`, `field`, `type`, `mapper`) y variante `hasCustomId`.
- [x] `integration-tests/fixtures/_helpers.js`: cleanup de colección y assert de error de driver (`code === 4` + `previousError.code`).
- Depende de: —

## Batch 2 — Lecturas
- [x] `constructor.js`, `get.js`, `get-paged.js`, `get-totals.js`, `distinct.js`, `filters.js`, `aggregate.js`
- [x] Migrar casos de `crud.js` (get, distinct) y `aggregate.js`; borrar `aggregate.js`.
- Depende de: 1

## Batch 3 — Escrituras simples
- [x] `insert.js`, `save.js`, `update.js`, `increment.js`, `remove.js`
- [x] Migrar el resto de `crud.js`; borrar `crud.js`.
- Depende de: 1

## Batch 4 — Escrituras masivas
- [x] `multi-insert.js`, `multi-save.js`, `multi-update.js`, `multi-remove.js`, `delete-all-documents.js`
- [x] Migrar `batch.js`; borrarlo.
- Depende de: 1

## Batch 5 — Índices y drops
- [x] `get-indexes.js`, `create-indexes.js`, `create-index.js`, `drop-index.js`, `drop-indexes.js`, `drop-collection.js`, `drop-database.js`
- [x] Migrar `indexes.js` y `drop-collection.js` viejo; borrar `indexes.js`.
- Depende de: 1

## Batch 6 — README
- [x] Corregir las 7 diferencias README vs código (lista en el mapeo; comportamiento real = lo que asertan los tests).
- Depende de: 2–5

## Hallazgos para ticket aparte
<!-- Cada batch agrega acá las inconsistencias confirmadas contra las 3 versiones. -->
- `get`/`getPaged`/`getTotals`: id no-hex lanza `BSONError` crudo, no `MongoDBError` (`get.js:279`).
- `distinct`: no mapea `id`→`_id`; filtrar por `id` devuelve `[]` (`distinct.js:107`).
- `aggregate`: `_id` objeto de `$group` queda `"[object Object]"` (`aggregate.js:156`).
- `aggregate`: ids dentro de operadores (`$in`) no se convierten a ObjectId; en `get` sí (`aggregate.js:98`).
- Conexión fallida: doble wrap code 4; el error del driver queda en `previousError.previousError` (`constructor.js:122`).

- `update`: validación dentro del `try`; filtro inválido (8), stage >1 key (11) y BSONError salen como code 4 (`update.js:290,371,390`).
- `insert`: id no-hex sale code 4; en `save`/`remove`/`get` sale `BSONError` crudo (`insert.js:182`, `save.js:343`, `remove.js:109`).
- `increment`: devuelve doc crudo con `_id` ObjectId, sin `id` (`increment.js:46`).
- `update` con `upsert: true`: retorna 0 (solo `modifiedCount`) aunque crea el doc (`update.js:321`).

- `multiRemove`: filtro `undefined`, `{}` o `[]` borra toda la colección (`multi-remove.js`).
- `multiUpdate` vs `update`: en `multiUpdate` stage >1 key (11) y filtro inválido (8) salen sin envolver.
- `deleteAllDocuments`: filtro crudo; `{ id }` y `{ _id: '<hex string>' }` no matchean.

- `createIndexes(model, [])`: rechaza con code 4 (server 2) en vez de devolver `false` (`create-indexes.js`).
- `dropIndexes`: `Promise.all` rechaza con bajas en vuelo; estado inmediato no determinístico (`drop-indexes.js`).

## Server codes observados (3 versiones)
- `hint` inexistente → 2 · `$text` sin índice → 27 · `$nearSphere` sin índice → 291 · stage desconocido → 40324
- E11000 → 11000 · conflicto de operadores/path → 40 · `$inc` sobre string → 14 · operador desconocido → 9
- colección inexistente → 26 · mismo key otro name → 85 · mismo name otro key/opciones → 86 · `[]` en createIndexes → 2 · dropIndex inexistente → 27 · `_id_` → 72 · dropCollection('') → 73
