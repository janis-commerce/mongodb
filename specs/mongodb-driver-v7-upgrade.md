# Upgrade del driver `mongodb` a 7.x (package 4.0.0)

> Repo: `packages/mongodb` · Branch: `feature/mongodb-driver-v7-upgrade`
> Estado: aprobado (derivado de la definición `[def:mongodb-driver-upgrade v1]`, `~/code/definitions/mongodb-driver-upgrade/index.html`) · Creado: 2026-09-21

## Objetivo

Actualizar el driver `mongodb` de `^4.17.2` a `^7.6` en `@janiscommerce/mongodb` y publicarlo como major `4.0.0` con Node ≥ 20.19. De paso, `increment()` pasa a devolver el documento actualizado y `multiUpdate()` reporta los `writeErrors` / `writeConcernErrors` reales del bulk.

## Contexto

- `mongodb@4.17.2` no recibe patches desde 2023-12-05. No soporta server 8.0 y soporta 7.0 parcialmente. `7.6.0` salió el 2026-09-21.
- Joaquín Ormaechea dejó `origin/chore/upgrade-mongodb-driver-v5-v7` (2026-04-24, driver `^7.2.0`, sin PR) con los fixes de lib y `docs/mongodb-driver-v4-to-v7-upgrade.md`. Mergeada con master queda en verde (285 tests, lint 0).
- 69 repos consumen el package vía `@janiscommerce/model`. 50 corren `nodejs22.x`; 15 siguen en `nodejs18.x` (sls-helper-plugin-janis < 11) y no pueden tomar driver 7 hasta migrar runtime.
- 3 services llaman `ObjectId()` sin `new` (crm, fenicio, wms): rompen con bson ≥ 5. Se documenta en la migration guide; sus fixes son PRs aparte.
- `returnNewDocument` no es opción del driver (ni en 4.17 ni en 7.6). Desde `b75c10a` (2021-12) `increment()` devuelve la pre-imagen.
- `BulkWriteResult` de 4.17 no expone `writeErrors` / `writeConcernErrors` como propiedades: `multiUpdate()` hoy devuelve siempre `[]` en ambos.

## Alcance

✅ Incluye:
- Bump `mongodb` a `^7.6.0`, `engines.node` `>=20.19.0`, `.nvmrc` 22, matriz de CI solo Node 22.
- Ajustes de lib al API del driver 7 (heredados de la branch de Joaquín): `new ObjectId`, `includeResultMetadata`, catch de `multiInsert()`, getters de `BulkWriteResult`.
- Exportar `ObjectId` desde el entrypoint (`lib/mongodb.js`) y en `types/`.
- `increment()` con `returnDocument: 'after'`; eliminar `returnNewDocument` en `save()` e `increment()`.
- `multiUpdate()`: `writeErrors` vía `getWriteErrors()`, `writeConcernErrors` como array vía `getWriteConcernError()`.
- README: migration guide 3.x → 4.0 + docs de `increment()`, `multiUpdate()`, `dropCollection()`, `aggregate()` (batchSize).
- Integration tests contra server real (ver Abiertas).

❌ NO incluye:
- Bump de versión ni `CHANGELOG.md` en la branch (los hace `prepare-release` en el prerelease `4.0.0-beta.N`).
- Fixes en los services consumidores (crm, fenicio, wms) ni bumps de sls-helper en services nodejs18.x.
- Migrar `save()` al shape nuevo de `findOneAndUpdate` (sigue con `includeResultMetadata`).
- Nuevas features del driver (IWM, CSOT, MONGODB-AWS, zstd, `MongoClient.bulkWrite()`): quedan para evaluación posterior.
- Quitar la dependencia `aws4` (sin uso en `lib/`), cambios de `MongoWrapper` o de la config de conexión.
- Tocar `origin/chore/upgrade-mongodb-driver-v5-v7` ni cerrar PR #42.

## Criterios de aceptación

- [ ] `package.json` declara `"mongodb": "^7.6.0"` y `"engines": { "node": ">=20.19.0" }`; `.nvmrc` es `22`.
- [ ] `.github/workflows/build-status.yml` pasa `node-versions: '["22.x"]'` al reusable (el default incluye 18.x).
- [ ] `npm run lint` sin errores; `npm test` en verde en Node 22 con `mongodb@7.6.x`; coverage de statements se mantiene en 100%.
- [ ] `require('@janiscommerce/mongodb').ObjectId === require('mongodb').ObjectId`; `types/mongodb.d.ts` lo declara. `lib/mongodb-wrapper.js` sigue exportándolo (compat con deep imports).
- [ ] No queda ningún `ObjectId(` sin `new` en `lib/` ni `tests/`.
- [ ] `save()` e `increment()` no pasan `returnNewDocument`.
- [ ] `increment()` llama `findOneAndUpdate` con `{ upsert: false, returnDocument: 'after', includeResultMetadata: true, ...comment }` y devuelve `res.value` (documento post-`$inc`; `null` si no matchea).
- [ ] `save()` conserva su contrato: devuelve el id (`lastErrorObject.upserted` en upsert, `value._id` si existía) usando `includeResultMetadata: true`.
- [ ] `multiInsert()` con error parcial: ids insertados desde `err.result.insertedIds` (objeto por índice) e índices con error desde `err.writeErrors`; el retorno sigue siendo los ids insertados.
- [ ] `multiUpdate()` devuelve `writeErrors: result.getWriteErrors()` y `writeConcernErrors` como array (`[]` si no hay); `operations[].hasErrors` y `operations[].errors` reflejan los write errors reales por índice.
- [ ] README documenta que `dropCollection()` de una colección inexistente resuelve `false` (antes tiraba `MongoDBError`).
- [ ] README tiene sección "Migration guide 3.x → 4.0": `new ObjectId`, Node ≥ 20.19 / Lambda `nodejs22.x`, connection string con booleanos estrictos, `dropCollection()`, retorno de `increment()`, `ObjectId` desde el entrypoint, `aggregate()` sin `batchSize` default.
- [ ] Integration tests (sujeto a Abiertas): `npm run test-integration` corre contra server 6 / 7 / 8 y cubre `save()` upsert + existente, `increment()` (valor post-`$inc`), `multiInsert()` con duplicados, `multiUpdate()` con write errors, `dropCollection()` inexistente, `aggregate()` > 1000 docs.

## Plan de archivos

- `package.json` (edit) — driver `^7.6.0`, `engines.node`, script `test-integration` si aplica.
- `.github/workflows/build-status.yml` (edit) — `node-versions: '["22.x"]'`.
- `lib/mongodb.js` (edit) — export `ObjectId`; `save()` / `increment()` opciones; `multiUpdate()` getters.
- `lib/mongodb-wrapper.js` (—) — sigue exportando `ObjectId`.
- `lib/helpers/object-id.js`, `lib/mongodb-filters.js` (branch) — `new ObjectId`, ya mergeado.
- `tests/mongodb.js` (edit) — expectativas de `increment()`, `multiUpdate()`, export de `ObjectId`.
- `types/mongodb.d.ts` (regenerar con `npm run build-types`).
- `README.md` (edit) — migration guide + secciones afectadas.
- `docs/mongodb-driver-v4-to-v7-upgrade.md` (branch) — análisis de Joaquín, se conserva.
- `integration-tests/**` (nuevo, desde `origin/Mongodb-driver-upgrade`) — runner + fixtures, adaptados (ver Abiertas).

## Decisiones

- Base: reusar `chore/upgrade-mongodb-driver-v5-v7` mergeada en `feature/mongodb-driver-v7-upgrade` (creada desde master actualizado). Conserva autoría y análisis de Joaquín.
- Target: driver `^7.6` directo, un solo major del package. Los 15 services en nodejs18.x adoptan al migrar a sls-helper 11 (Lambda bloquea updates de nodejs18.x el 2027-03-03).
- Versionado: major `4.0.0`. Cambian Node mínimo, el `ObjectId` re-exportado y `dropCollection()`.
- Contrato público: `engines.node >=20.19.0`; migration guide en README; `ObjectId` exportado desde el entrypoint. Los PRs de fix en crm/fenicio/wms quedan fuera de este repo.
- `increment()`: se corrige a `returnDocument: 'after'` (lo que el código prometía). Se documenta como cambio de comportamiento del 4.0.0.
- `multiUpdate()`: se mantiene `writeConcernErrors` (array) como nombre público; se corrige la lectura con getters.
- Release: prerelease `4.0.0-beta.N`. El reusable `npm-publish` deriva el dist-tag del sufijo del tag → publica bajo `beta` (no `next`). `latest` sigue en 3.x hasta el GA.
- Canaries: wms, catalog, pricing.
- Features nuevas del driver (IWM, CSOT, MONGODB-AWS, zstd, `MongoClient.bulkWrite()`): evaluación posterior, fuera de este spec.

## Abiertas

- **Integration tests sin docker**: la máquina local no tiene `docker`. El runner de la branch 2024 depende de docker-compose. Opciones: (a) instalar Docker Desktop / colima y usar el runner tal cual; (b) reemplazar docker por `mongodb-memory-server` (descarga `mongod` por versión, corre local y en GitHub Actions sin docker); (c) postergar los integration tests a un PR aparte. El batch 3 del plan espera esta decisión; los batches 1 y 2 no dependen de ella.
