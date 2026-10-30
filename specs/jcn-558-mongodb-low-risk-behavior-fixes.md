# Fixes de comportamiento de riesgo bajo para 4.0.0

> Repo: `packages/mongodb` · Branch: `JCN-558-mongodb-low-risk-behavior-fixes` (desde `JCN-555-mongodb-driver-v7-upgrade`) · Ticket: [JCN-558](https://janiscommerce.atlassian.net/browse/JCN-558)
> Estado: aprobado · Creado: 2026-09-30

## Objetivo

Corregir 6 comportamientos inconsistentes antes del GA de 4.0.0: `distinct` e `aggregate` convierten ids como `get`, `aggregate` conserva `_id` compuestos, `increment` devuelve el documento mapeado, `createIndexes([])` falla con error de validación y `dropIndexes` termina todas las bajas antes de rechazar. Además, un id inválido rechaza con `MongoDBError` en todos los métodos y un `MongoDBError` lanzado dentro de un método conserva su code.

## Contexto

- Los integration tests de JCN-555 fijaron estos comportamientos con `// Current behavior:`.
- Definición: `~/code/definitions/jcn-558-mongodb-v4-behavior-fixes/` v1 (2026-09-30).
- `multiRemove` con filtro vacío queda fuera: obliga a tocar `@janiscommerce/model`.

## Alcance

✅ Incluye:
- `distinct`: pasar `params.filters` por `ObjectIdHelper.ensureObjectIdsForWrite` antes de `parseFilters` (`lib/mongodb.js:109`).
- `aggregate`: en stages `$match`, convertir `id` y campos `isID` dentro de `$in`, `$nin`, `$eq`, `$ne` (`lib/mongodb.js:1064`).
- `aggregate`: mapear `_id` → `id` solo si `_id` es ObjectId o string. Otro tipo deja `_id` sin tocar.
- `increment`: agregar `id` string al documento devuelto y conservar `_id`; `null` sin match (`lib/mongodb.js:861`).
- `createIndexes(model, [])`: rechazar con code 10 `INVALID_INDEX` antes del driver (`lib/helpers/validate-indexes.js`).
- `dropIndexes`: `Promise.allSettled`; cuando todos terminan, rechazar con el primer error en orden de `indexNames` (`lib/mongodb.js:990`).
- Id inválido: `ObjectIdHelper` envuelve el `BSONError` en `MongoDBError` code 12 `INVALID_ID` (`lib/helpers/object-id.js`). Lo pidió el review del PR.
- Catch de los métodos: dejar pasar un `MongoDBError` sin re-envolverlo como code 4 (`lib/mongodb.js`). Saca el doble wrap de conexión.
- Unitarios en `tests/` con cobertura 100%.
- Invertir los asserts `// Current behavior:` de estos 6 casos en `integration-tests/fixtures/`.
- `README.md` y `docs/migration-v3-to-v4.md`: documentar el comportamiento nuevo y los breaking.

❌ NO incluye:
- `multiRemove` con filtro vacío y método nuevo para vaciar colección.
- Cambios en `@janiscommerce/model`.
- Conversión de ids en `get`, `getTotals`, `multiRemove` ni en stages de `aggregate` distintos de `$match`.
- Retorno de `update` con upsert.
- Code de `MongoDBError` en `lib/mongodb-filters.js:56` (sale sin code).
- Bump, publish de `4.0.0-beta.1` y canarios (paso posterior, con su gate).
- `CHANGELOG.md` (va en la descripción del PR).

## Criterios de aceptación

- [ ] `distinct(model, { key, filters: { id: hex } })` devuelve los valores del documento con ese `_id`.
- [ ] `aggregate` con `$match: { id: { $in: [hex1, hex2] } }` matchea los dos documentos. Igual con `$nin`, `$eq`, `$ne` y con campos `isID`.
- [ ] `aggregate` con `$group: { _id: { a, b } }` devuelve `_id` objeto intacto y sin `id`.
- [ ] `aggregate` con `_id` ObjectId o string devuelve `id` string y sin `_id`. Con `_id` null o número deja `_id`.
- [ ] `increment` devuelve `id` string y conserva `_id` ObjectId. Sin match devuelve `null`.
- [ ] `createIndexes(model, [])` rechaza con `MongoDBError` code 10 sin llamar al driver. `createIndex` no cambia.
- [ ] `dropIndexes(model, ['a', 'missing', 'b'])` rechaza con el error de `missing` y, al rechazar, `a` y `b` ya no existen.
- [ ] `dropIndexes` sin errores resuelve `true` igual que hoy.
- [ ] Id no-hex en cualquier método (incluido `$in` de `$match` en `aggregate`) rechaza con `MongoDBError` code 12, con el `BSONError` en `previousError`.
- [ ] `update` con tipo de filtro inválido rechaza con code 8 y con stage inválido con code 11, sin wrap.
- [ ] Conexión fallida: el error del driver queda en `previousError` (un solo wrap).
- [ ] `npm test` pasa con cobertura 100%.
- [ ] `npm run test-integration` pasa en 8.0.12, 7.0.21 y 6.0.24. No quedan `// Current behavior:` de estos 6 casos.
- [ ] `docs/migration-v3-to-v4.md` lista `createIndexes([])`, `distinct` y `aggregate` como breaking, y `increment` como aditivo.
- [ ] `lint` pasa.

## Plan de archivos

- `lib/mongodb.js` (edit) — `distinct`, `aggregate`, `increment`, `dropIndexes`
- `lib/helpers/object-id.js` (edit) — conversión dentro de operadores, mapeo condicional de `_id` y `toObjectId` con code 12
- `lib/mongodb-error.js` (edit) — `INVALID_ID: 12`
- `lib/helpers/validate-indexes.js` (edit) — array no vacío
- `tests/mongodb.js`, `tests/…` (edit) — unitarios
- `integration-tests/fixtures/{distinct,aggregate,increment,create-indexes,drop-indexes}.js` (edit)
- `README.md`, `docs/migration-v3-to-v4.md` (edit)

## Decisiones

- Branch desde `JCN-555`, PR contra `JCN-555`: separa tests de cambio de comportamiento. Excepción a "branch desde master", decidida por Juan.
- `aggregate` convierte solo en `$match`: evita convertir strings que no son ids en `$project` o `$addFields`.
- `aggregate` con `_id` compuesto lo deja en `_id`: sin pérdida de data.
- `increment` aditivo (`id` + `_id`): `@janiscommerce/model` lee `result._id.toString()` (`model.js:551`); el mapeo como `get` lo rompería. Decisión post-Explore.
- `createIndexes([])` rechaza con code 10: error de validación explícito.
- `dropIndexes` con `allSettled`: estado final determinístico, mismo contrato de error.
- `multiRemove` vacío fuera: requiere `@janiscommerce/model`.
- Id inválido se envuelve en `toObjectId` y no moviendo la conversión al `try`: moverla convertiría `INVALID_FILTER_TYPE` (8) en 4. Decisión post-review del PR.

## Abiertas

—
