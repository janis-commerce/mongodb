# Plan: fixes de riesgo bajo (JCN-558)

> Spec: `specs/jcn-558-mongodb-low-risk-behavior-fixes.md` · Verificación: `npm run lint` + `npm run coverage` (100%) + `npm run test-integration` (6.0.24, 7.0.21, 8.0.12)

## Batch 1 — lib/ + unitarios
- [x] `distinct`: filtros por `ensureObjectIdsForWrite`.
- [x] `aggregate`: conversión de ids dentro de `$in/$nin/$eq/$ne` en `$match`; mapeo de `_id` solo ObjectId/string.
- [ ] `increment`: retorno mapeado como `get`. **Pausado**: `@janiscommerce/model` lee `result._id` (model.js:551).
- [x] `createIndexes([])`: code 10 en `validate-indexes.js`.
- [x] `dropIndexes`: `Promise.allSettled` + primer error en orden.
- [x] Unitarios en `tests/` con cobertura 100%.
- Depende de: —

## Batch 2 — Integration tests + docs
- [ ] Invertir `// Current behavior:` de los 6 casos en `distinct`, `aggregate`, `increment`, `create-indexes`, `drop-indexes`.
- [ ] `README.md` y `docs/migration-v3-to-v4.md` con comportamiento nuevo y breaking.
- Depende de: 1
