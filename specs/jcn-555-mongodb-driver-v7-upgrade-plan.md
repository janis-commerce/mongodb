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
- [ ] `insert.js`, `save.js`, `update.js`, `increment.js`, `remove.js`
- [ ] Migrar el resto de `crud.js`; borrar `crud.js`.
- Depende de: 1

## Batch 4 — Escrituras masivas
- [ ] `multi-insert.js`, `multi-save.js`, `multi-update.js`, `multi-remove.js`, `delete-all-documents.js`
- [ ] Migrar `batch.js`; borrarlo.
- Depende de: 1

## Batch 5 — Índices y drops
- [ ] `get-indexes.js`, `create-indexes.js`, `create-index.js`, `drop-index.js`, `drop-indexes.js`, `drop-collection.js`, `drop-database.js`
- [ ] Migrar `indexes.js` y `drop-collection.js` viejo; borrar `indexes.js`.
- Depende de: 1

## Batch 6 — README
- [ ] Corregir las 7 diferencias README vs código (lista en el mapeo; comportamiento real = lo que asertan los tests).
- Depende de: 2–5

## Hallazgos para ticket aparte
<!-- Cada batch agrega acá las inconsistencias confirmadas contra las 3 versiones. -->
- `get`/`getPaged`/`getTotals`: id no-hex lanza `BSONError` crudo, no `MongoDBError` (`get.js:279`).
- `distinct`: no mapea `id`→`_id`; filtrar por `id` devuelve `[]` (`distinct.js:107`).
- `aggregate`: `_id` objeto de `$group` queda `"[object Object]"` (`aggregate.js:156`).
- `aggregate`: ids dentro de operadores (`$in`) no se convierten a ObjectId; en `get` sí (`aggregate.js:98`).
- Conexión fallida: doble wrap code 4; el error del driver queda en `previousError.previousError` (`constructor.js:122`).

## Server codes observados (3 versiones)
- `hint` inexistente → 2 · `$text` sin índice → 27 · `$nearSphere` sin índice → 291 · stage desconocido → 40324

