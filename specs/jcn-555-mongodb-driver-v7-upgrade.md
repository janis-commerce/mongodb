# Integration tests: un fixture por método público

> Repo: `packages/mongodb` · Branch: `JCN-555-mongodb-driver-v7-upgrade` · Ticket: [JCN-555](https://janiscommerce.atlassian.net/browse/JCN-555)
> Estado: aprobado · Creado: 2026-09-30

## Objetivo

Cubrir con integration tests contra MongoDB real (6.0, 7.0 y 8.0) todos los métodos públicos, sus opciones y los errores que dependen del driver o del servidor.

## Contexto

Review de jormaechea en [PR #44](https://github.com/janis-commerce/mongodb/pull/44) (2026-09-29): "armaría un archivo en `fixtures/` por cada método, para asegurar que probamos todos y que probamos todas sus opciones, errores, etc."

Estado actual: 5 fixtures agrupados (`crud`, `batch`, `aggregate`, `indexes`, `drop-collection`), 726 líneas.
- Sin cobertura: `remove`, `getTotals`, `createIndex`, `dropIndex`, `dropIndexes`, `dropDatabase`, `deleteAllDocuments`, constructor.
- Cobertura mínima: `distinct`, `getPaged`, `update`, `multiSave`, `multiRemove`, `getIndexes`, `aggregate`.
- Tipos de filtro: solo `equal` y `search`.
- Errores: solo se verifica `instanceof MongoDBError`; nunca `code` ni `previousError`.

## Alcance

✅ Incluye:
- Un archivo `integration-tests/fixtures/<metodo>.js` por método público de `lib/mongodb.js`.
- Un archivo `integration-tests/fixtures/filters.js` para los tipos de filtro de `lib/mongodb-filters.js`, probados vía `get()`.
- Por método: todas las opciones documentadas en README o soportadas en código, retorno exacto y errores del driver o del servidor (asserts sobre `code` y `previousError`).
- Por método: el camino de error del package que solo se observa contra una DB real (ej. duplicados parciales en `multiInsert`).
- Model de test con `fields` (`isID`, `field`, `type`, `mapper`) y variante con `hasCustomId`.
- Borrar los 5 fixtures agrupados y migrar sus casos al archivo del método.
- Aislamiento: cada archivo deja la colección limpia; `dropDatabase` en su propia DB.
- `constructor.js`: host/port/database separados, `config.limit` aplicado, conexión fallida con código 4.
- Corregir en `README.md` las 7 diferencias con el código detectadas en el mapeo.

❌ NO incluye:
- Cambios en `lib/`. Un bug encontrado se reporta; no se arregla en este paso.
- Unificar códigos de error, envolver `BSONError`, mapear `id` en `distinct`: van a un ticket aparte.
- Verificar el operation comment contra el servidor. Queda en unitarios.
- Cobertura exhaustiva de validación pura del package (códigos 1, 2, 3, 5, 6, 7, 9, 10, 11). Sigue en unitarios; los integration tests pueden incluir casos puntuales.
- Cambios al runner `integration-tests/index.js` ni a las versiones de MongoDB.
- Bump de versión, publish y canarios.
- CI para integration tests.

## Criterios de aceptación

- [ ] Existe un archivo por método: `constructor`, `distinct`, `get`, `get-paged`, `save`, `insert`, `update`, `multi-insert`, `multi-save`, `multi-update`, `remove`, `multi-remove`, `get-totals`, `increment`, `get-indexes`, `create-indexes`, `create-index`, `drop-index`, `drop-indexes`, `drop-database`, `drop-collection`, `delete-all-documents`, `aggregate`.
- [ ] Existe `filters.js` con un caso por tipo: `equal`, `notEqual`, `greater`, `greaterOrEqual`, `lesser`, `lesserOrEqual`, `in`, `notIn`, `all`, `exists`, `elemMatch`, `search`, `text`, `nearSphere`, `geoIntersects`, tipo custom `$xxx`, filtros OR, `id`→`_id`.
- [ ] Cada test de error del driver verifica `code === 4` y `previousError.code` del servidor.
- [ ] `get`: cubre `order`, `limit`/`page`, `fields`, `excludeFields`, `returnType: 'cursor'`, `hint` válido e inválido, `readPreference`.
- [ ] `getTotals`: cubre las 4 ramas (get vacío, última página deducida, `countDocuments`, `estimatedDocumentCount`).
- [ ] `save`/`multiSave`: cubren upsert por `id` y por índice único, `setOnInsert`, `skipAutomaticSetModifiedData`, operadores `$`, E11000.
- [ ] `update`/`multiUpdate`: cubren `updateOne` vs `updateMany`, operadores `$`, pipeline array, `arrayFilters`, `upsert`, `skipAutomaticSetModifiedData`, caso feliz con y sin `rawResponse`.
- [ ] `dropIndex`: cubre índice inexistente y `_id_`.
- [ ] `npm run test-integration` pasa en 8.0.12, 7.0.21 y 6.0.24.
- [ ] `npm run lint` y `npm test` pasan.
- [ ] Los fixtures agrupados viejos no existen.
- [ ] Cada test que fija un comportamiento inconsistente lleva un comentario que lo marca.
- [ ] El README coincide con el comportamiento que prueban los tests.

## Plan de archivos

- `integration-tests/fixtures/_model.js` (edit) — agregar `fields` y variante `hasCustomId`
- `integration-tests/fixtures/_helpers.js` (nuevo, si hace falta) — cleanup y assert de error de driver
- `integration-tests/fixtures/<metodo>.js` (nuevo ×23, incluye `constructor.js`)
- `integration-tests/fixtures/filters.js` (nuevo)
- `integration-tests/fixtures/{crud,batch,aggregate,indexes,drop-collection}.js` (borrar)
- `README.md` (edit) — corregir las 7 diferencias con el código

## Decisiones

- Un archivo por método, nombre kebab-case: pedido del reviewer, deja visibles los huecos.
- Validación pura queda en unitarios: no depende del driver. Ajuste post-review: se aceptan casos puntuales en integration (pedido del reviewer: cubrir errores).
- Sin bump: `files` publica solo `lib/` y `types/`.
- Los filtros van en un archivo aparte: son transversales a `get`, `getTotals`, `multiRemove`, `update`.

- Los tests fijan el comportamiento actual de las inconsistencias. El PR no cambia comportamiento.
- El operation comment no se verifica contra el servidor.
- El constructor y la conexión fallida sí se prueban.
- El README se corrige en este PR: son solo docs, sin bump.

## Abiertas

—
