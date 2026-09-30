# Plan: integration tests por método

> Spec: `specs/jcn-555-mongodb-driver-v7-upgrade.md` · Verificación de cada batch: `npm run lint` + `npm test` + `npm run test-integration` (6.0.24, 7.0.21, 8.0.12)

## Batch 1 — Base
- [ ] `integration-tests/fixtures/_model.js`: agregar `fields` (`isID`, `field`, `type`, `mapper`) y variante `hasCustomId`.
- [ ] `integration-tests/fixtures/_helpers.js`: cleanup de colección y assert de error de driver (`code === 4` + `previousError.code`).
- Depende de: —

## Batch 2 — Lecturas
- [ ] `constructor.js`, `get.js`, `get-paged.js`, `get-totals.js`, `distinct.js`, `filters.js`, `aggregate.js`
- [ ] Migrar casos de `crud.js` (get, distinct) y `aggregate.js`; borrar `aggregate.js`.
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
