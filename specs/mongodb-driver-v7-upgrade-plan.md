# Plan de tareas — `mongodb-driver-v7-upgrade`

Deriva de `specs/mongodb-driver-v7-upgrade.md`. Batches en serie, un writer por vez.

## B0 · Branch + merge (main loop, git)

- [x] `feature/mongodb-driver-v7-upgrade` desde master actualizado.
- [x] Merge `origin/chore/upgrade-mongodb-driver-v5-v7`: workflows de master, `includeResultMetadata` + `getCommentOption()` en `lib/mongodb.js`, 4 fixes en `tests/mongodb.js`.
- Verifica: `npm test` 285 passing, lint 0, driver 7.6.x instalado.

## B1 · Lib + contrato (janis-developer · sonnet)

Toca: `package.json`, `.github/workflows/build-status.yml`, `lib/mongodb.js`, `tests/mongodb.js`, `types/` (build-types), README (secciones `increment`, `multiUpdate`, `dropCollection`, `aggregate`).
Depende de: B0.

- [x] `mongodb` `^7.6.0` · `engines.node >=20.19.0` · build-status `node-versions: '["22.x"]'`.
- [x] Export `ObjectId` desde `lib/mongodb.js` (`types/` es build artifact ignorado, se genera en publish).
- [x] `save()` / `increment()`: quitar `returnNewDocument`; `increment()` con `returnDocument: 'after'`.
- [x] `multiUpdate()`: `getWriteErrors()` / `getWriteConcernError()` → `writeErrors`, `writeConcernErrors` (array).
- [x] Tests actualizados; ningún `ObjectId(` sin `new`.
- Verifica: lint 0 · 287 passing · statements 100% · build-types OK. Pendiente: 2 branches sin cubrir en `multiInsert()` catch (heredado del merge) → se cubre en B2.

## B2 · Migration guide (janis-developer · haiku/sonnet)

Toca: `README.md`, `docs/mongodb-driver-v4-to-v7-upgrade.md` (nota de estado final).
Depende de: B1 (shape final del API).

- [x] Sección "Migration guide 3.x → 4.0" con los 7 puntos del spec (+ 2 tests que cierran branches de `multiInsert()`; coverage 100/100/100/100).
- Verifica: lectura cruzada contra `lib/` (cada afirmación tiene su línea de código).

## B3 · Integration tests (janis-developer · sonnet)

Toca: `integration-tests/**` (desde `origin/Mongodb-driver-upgrade`), `package.json` (script + devDependency `mongodb-memory-server`).
Depende de: B1. Decisión tomada: `mongodb-memory-server` en vez de docker-compose (validado local).

- [x] Rescatar runner + fixtures; levantar server 6 / 7 / 8 con `mongodb-memory-server`, Node 22 (un proceso mocha por versión).
- [x] Casos: `save()` upsert/existente, `increment()` post-`$inc`, `multiInsert()` duplicados, `multiUpdate()` con write errors (rechaza: `it.skip` pendiente de decisión), `dropCollection()` inexistente (booleano según versión de server), `aggregate()` > 1000 docs, `getPaged()`, índices.
- Verifica: `npm run test-integration` → 8.0.12 / 7.0.21 / 6.0.24 PASSED (21 + 1 pending c/u). Workflow `integration-tests.yml` en `ubuntu-22.04`, sin ejecutar aún en CI.

## B4 · Fixes post-integration (janis-developer · sonnet)

- [x] `multiInsert()`: filtrar por índice original antes de mapear (regresión del upgrade: driver 7 solo devuelve `insertedIds` de los insertados).
- [x] README: `dropCollection()` inexistente ya no rechaza; booleano según versión de server.
- [ ] `multiUpdate({ rawResponse: true })`: decisión pendiente (A: resolver con `writeErrors` reales desde el `catch` + `ordered: false` · B: documentar limitación).

## Cierre

- [ ] Review `janis-code-reviewer` (opus: > 5 archivos).
- [ ] Commit(s) + push (gate) → PR a master vía `create-pr` (gate).
- [ ] Prerelease `4.0.0-beta.0` vía `prepare-release` (gate de bump) → dist-tag `beta`.
- [ ] Canaries: wms → catalog → pricing (beta → QA → prod). Después: GA `4.0.0`.

## B5 · Fix de `multiUpdate({ rawResponse: true })` (janis-developer · opus)

Decisión del usuario: corregir dentro de este major (opción A), bulk **unordered** cuando se pide el detalle.

- [x] `ordered: false` solo con `rawResponse`; sin `rawResponse` no cambia nada.
- [x] Resolver desde el `catch` con `success: false` + `writeErrors` + `operations[].success` reales. Errores de driver (conexión/timeout) siguen lanzando: se detectan por ausencia de fallos reportados en el resultado parcial.
- [x] Unit tests reescritos contra el comportamiento real del driver (los 4 anteriores mockeaban un camino imposible).
- [x] Integration tests: fallo simple, fallos no contiguos, y verificación de que las operaciones posteriores al error sí se aplican.
- [x] README: guía de migración con ejemplo antes/después + sección de referencia actualizada.
- Verifica: lint 0 · 290 passing · coverage 100/100/100/100 · 8.0.12 / 7.0.21 / 6.0.24 PASSED · build-types OK.

## B6 · Paquete de findings del review (janis-developer · sonnet)

- [ ] 3 medias: postinstall de 141 MB, runner que puede colgar en CI + `timeout-minutes`, `--require` del bootstrap de logs.
- [ ] 6 bajas: heading del README, `node:util`, comentario de `writeErrors`, `getUri()` explícito, silenciado de logs en fixtures.

## Cierre (pendiente)

- [x] Review `janis-code-reviewer` (opus): APROBADO CON CAMBIOS, 0 altas · 4 medias · 7 bajas.
- [x] Push de la branch; CI en verde (Build Status, Coverage Status, Integration Tests).
- [ ] §9: evaluar docs del repo y borrar `specs/` antes del PR.
- [ ] PR a master vía `create-pr` (gate).
- [ ] Prerelease `4.0.0-beta.0` desde `master` vía `prepare-release` (gate de bump) → dist-tag `beta`.
- [ ] Canaries: wms → catalog → pricing. Ojo: wms, vtex-wms, vtex-pricing, shopify y mercadolibre usan `rawResponse: true` y necesitan la migración del README.
