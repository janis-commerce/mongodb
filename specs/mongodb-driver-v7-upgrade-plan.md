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

- [ ] Sección "Migration guide 3.x → 4.0" con los 7 puntos del spec.
- Verifica: lectura cruzada contra `lib/` (cada afirmación tiene su línea de código).

## B3 · Integration tests (janis-developer · sonnet)

Toca: `integration-tests/**` (desde `origin/Mongodb-driver-upgrade`), `package.json` (script + devDependency `mongodb-memory-server`).
Depende de: B1. Decisión tomada: `mongodb-memory-server` en vez de docker-compose (validado local).

- [ ] Rescatar runner + fixtures; levantar server 6 / 7 / 8 con `mongodb-memory-server`, Node 22.
- [ ] Casos: `save()` upsert/existente, `increment()` post-`$inc`, `multiInsert()` duplicados, `multiUpdate()` con write errors, `dropCollection()` inexistente, `aggregate()` > 1000 docs.
- Verifica: `npm run test-integration` verde local (y en CI si se decide).

## Cierre

- [ ] Review `janis-code-reviewer` (opus: > 5 archivos).
- [ ] Commit(s) + push (gate) → PR a master vía `create-pr` (gate).
- [ ] Prerelease `4.0.0-beta.0` vía `prepare-release` (gate de bump) → dist-tag `beta`.
- [ ] Canaries: wms → catalog → pricing (beta → QA → prod). Después: GA `4.0.0`.
