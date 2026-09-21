# Actualización del driver `mongodb` de v4 a v7

Análisis basado en la superficie que expone `@janiscommerce/mongodb@3.17.0` (`lib/mongodb.js`, `lib/mongodb-wrapper.js`, `lib/config-validator.js`) y los changelogs oficiales de cada major del driver.

## Superficie que realmente usamos del driver

- `MongoClient` (constructor + `connect()` + `db()`) con `writeConcern: { w: 1 }`.
- `Db.collection()`, `Db.dropDatabase()`.
- Sobre `Collection`: `find`, `distinct`, `insertOne`, `insertMany`, `updateOne`, `updateMany`, `deleteOne`, `deleteMany`, `bulkWrite`, `findOneAndUpdate`, `countDocuments`, `estimatedDocumentCount`, `aggregate`, `indexes`, `createIndexes`, `dropIndex`, `drop`.
- Sobre `Cursor`: `sort`, `project`, `skip`, `limit`, `toArray`, `batchSize`, iteración `for await`.
- `ObjectId` (export).
- Opciones usadas: `readPreference`, `hint`, `comment`, `upsert`, `returnNewDocument`, `ordered`.
- Lectura de campos de respuesta: `insertedId`, `insertedIds`, `modifiedCount`, `matchedCount`, `deletedCount`, `upsertedCount`, `insertedCount`, `writeErrors`, `writeConcernErrors`, `deletedCount`, `ok`, y — clave — `value` / `lastErrorObject.upserted` de `findOneAndUpdate`, y `err.result.result` sobre el error de `insertMany`.

Esta superficie es la que se contrasta contra cada major.

---

## v4 → v5

**Veredicto: no es seguro. Hay dos cambios que nos rompen.**

### Cambios no retrocompatibles que debemos ajustar

- **`BulkWriteResult` sin `result` público** (`lib/mongodb.js:473`). Hoy hacemos:
  ```js
  const { insertedIds, writeErrors } = err.result.result;
  ```
  En v5 la propiedad `result` enumerable de `BulkWriteResult` fue eliminada; la forma oficial es leer los campos top-level. Hay que rescribir la rama de `catch` de `multiInsert()` para usar `err.result.insertedIds` (object keyed by index `{ '0': ObjectId, ... }`) y `err.writeErrors` (array de `WriteError` en la propia excepción). El shape de `insertedIds` pasa de array `[{ index, _id }]` a object, así que hay que normalizar con `Object.entries`. Los tests que mockean `error.result.result = { insertedIds, writeErrors }` hay que actualizarlos al shape nuevo.

- **`ObjectId` no se puede invocar sin `new`** (BSON v5, bundled con driver v5). Hoy tenemos llamadas bare:
  - `lib/helpers/object-id.js:12,16`
  - `lib/mongodb-filters.js:158`
  - Varios tests en `tests/mongodb.js`, `tests/mongodb-filters.js`.

  `ObjectId` pasa a ser una clase stricta — `ObjectId('...')` lanza `TypeError: Class constructor ObjectId cannot be invoked without 'new'`. Hay que agregar `new` en todas las invocaciones. Sed/perl con lookbehind funciona: `perl -i -pe 's/(?<!new )\bObjectId\(/new ObjectId(/g'`.

### Riesgos / cosas a validar

- **Iteración con `for await` del cursor en `getPaged`** (`lib/mongodb.js:226`). En v5 el cursor pasa a `AsyncGenerator` y se cierra solo al salir del `for await`. Ya lo hacemos así, pero conviene correr los tests de `getPaged` contra v5 para confirmar que no hay fuga de cursor ante `throw` dentro del callback.
- **Node.js mínimo 14.20.1**: validar en todos los Lambdas / servicios que consumen el paquete.

### Cambios que no nos afectan

- Eliminación de callbacks en todo el driver: ya usamos Promises.
- Métodos `Collection.insert/update/remove/mapReduce` eliminados: usamos `insertOne`, `insertMany`, `updateOne`, `updateMany`, `deleteOne`, `deleteMany`.
- Alias `ObjectID` eliminado: importamos `ObjectId`.
- `slaveOk`, `Projection`/`ProjectionOperations`, `CursorCloseOptions`, `Db.unref()`, `promiseLibrary`, `logger`/`logLevel`, `fullResponse`, `keepGoing`, `digestPassword`, `bson-ext`: nada de esto se usa.
- Cambio en `WriteConcernError.err()`: no lo consumimos.

---

## v5 → v6

**Veredicto: no es seguro. Es el upgrade con más impacto sobre nuestro código.**

### Cambios no retrocompatibles que debemos ajustar

- **`findOneAndUpdate` cambia el return shape** — el impacto mayor.
  - `lib/mongodb.js:291` (`save()`): hoy lee `res.value` y `res.lastErrorObject.upserted`.
  - `lib/mongodb.js:816` (`increment()`): hoy retorna `res.value`.
  En v6 por defecto `findOneAndUpdate` devuelve el documento (o `null`), no el `ModifyResult`. Dos caminos:
  1. Pasar `includeResultMetadata: true` en ambas llamadas y no tocar el resto. Es el fix mínimo y conserva el acceso a `lastErrorObject.upserted` que usamos en `save()` para resolver el id en el caso upsert.
  2. Migrar al shape nuevo: leer el documento directamente en `increment()` (trivial) y en `save()` combinar con `{ returnDocument: 'after', upsert: true }` y derivar el id del `_id` del documento retornado (requiere reescribir el flujo de “id insertado vs id existente”).
  Recomendación: opción (1) para el bump, opción (2) como limpieza posterior.

- **BSON v6**: hay que verificar que los `ObjectId` generados por el paquete y los recibidos del cliente siguen siendo compatibles con `ObjectIdHelper` (`lib/helpers/object-id.js`). Cambios sutiles de serialización BSON se han visto romper comparaciones/hashing.

- **Boolean parsing estricto en connection string**: hoy aceptamos `connectionString` libre (`lib/mongodb-wrapper.js:37`, `lib/config-validator.js`). Cualquier consumer que pase `?ssl=1`, `?retryWrites=yes`, etc. dejará de funcionar. No es un bug del paquete, pero es nuestro contrato público y conviene documentarlo en el CHANGELOG.

- **Node.js mínimo 16.20.1**.

### Riesgos / cosas a validar

- **Opciones SSL removidas** (`sslCA`, `sslCRL`, `sslCert`, `sslKey`, `sslPass`, `sslValidate`, `tlsCertificateFile`). No las setteamos nosotros, pero viajan por `connectionString`. Si algún consumer las usa en el URI, explota. Hay que avisar.
- **Lectura asíncrona de archivos TLS**: ahora los errores de `tlsCAFile`/`tlsCertificateKeyFile` salen en `connect()`, no en `new MongoClient()`. Esto puede cambiar en qué capa estalla un error y dónde lo capturamos (hoy capturamos en `MongoWrapper.connect`, probablemente siga tapándolo, pero vale la pena ver en tests de integración).
- **Opciones de `ConnectionPoolCreatedEvent`** recortadas: solo relevante si alguien observa eventos del pool — no es nuestro caso hoy.

### Cambios que no nos afectan

- `db.addUser`, `admin.addUser`, `collection.stats`, `Db/admin.command({ readConcern/writeConcern })`: no los usamos.
- `BulkWriteResult` deprecados (`nInserted`, `nUpserted`, `nMatched`, `nModified`, `nRemoved`, `getUpsertedIds()`, `getInsertedIds()`): ya leemos los nombres modernos (`insertedCount`, `modifiedCount`, `matchedCount`, `deletedCount`, `upsertedCount`, `upsertedIds`).
- `AutoEncrypter`, `ClientEncryption`, `EvalOptions`, GridFS (eventos y constantes): no se usan.
- `keepAlive`/`keepAliveInitialDelay`, `useNewUrlParser`, `useUnifiedTopology`: no los pasamos.
- Sesiones cross-client: usamos un único `MongoClient` por `configKey`.
- Cambios de `MongoError` / `MongoCryptError`: no subclaseamos ni construimos `MongoError` directo (envolvemos en `MongoDBError` propio).

---

## v6 → v7

**Veredicto: casi seguro, pero con dos cambios de comportamiento silenciosos que hay que mirar.**

### Cambios no retrocompatibles que debemos ajustar

- **Node.js mínimo 20.19.0**. Salto grande — hay que coordinar runtime de Lambdas/servicios. El repo queda con `.nvmrc` en `22`.
- **Flakiness en `tests/mongodb-wrapper.js`**: la suite usaba `config.host = ${Date.now()}.localhost` en `beforeEach`. Con node 22 los tests corren lo suficientemente rápido como para que dos tests seguidos compartan el mismo `Date.now()`, reusen entrada de caché de `clients` y dejen al test "Should connect only once..." contando 0 invocaciones a `connect`. Fix: agregar un counter incremental al host (`${Date.now()}-${n}.localhost`). No es un cambio del driver, es una flakiness latente que se destapa con el node nuevo.
- **Dependencias peer actualizadas** (`@mongodb-js/zstd` v7, `kerberos` v7, `mongodb-client-encryption` v7, `@aws-sdk/credential-providers` ^3.806.0, `gcp-metadata` ^7.0.1). Solo aplica a consumers que instalen estos peers; no los usamos directamente pero hay que reflejarlo en `peerDependencies`/docs si corresponde.

### Riesgos / cosas a validar

- **`Collection.drop()` ya no tira cuando el namespace no existe; devuelve `false`** (`lib/mongodb-wrapper.js:128` → `lib/mongodb.js:953`). Hoy `dropCollection()` hace `return !!result` y confiamos en que el error llega al `catch`. Post-v7 un drop de una colección inexistente **va a resolverse con `false` silenciosamente** en vez de propagar un error. Cambia el contrato observable del paquete. Decidir si queremos mantener el comportamiento previo (chequear explícitamente y tirar) o aceptar el nuevo.
- **Cursores sin `batchSize` default (antes 1000)**. En `get()` usamos `.skip().limit().toArray()` — sin impacto, el servidor corta por `limit`. En `getPaged()` seteamos `batchSize` explícito — sin impacto. En `aggregate()` no seteamos `batchSize` y terminamos con `.toArray()`: el servidor va a usar el default del server, lo cual puede aumentar la cantidad de `getMore` round-trips en agregaciones que devuelven muchos documentos. Performance, no corrección. Medir si aparece regresión.
- **BSON v7**: mismo tipo de riesgo que v6 pero con menor superficie ya amortizada.

### Cambios que no nos afectan

- `cursor.stream(transformFn)` deprecado: no usamos `.stream()`.
- Filtrado de opciones de change streams removido: no usamos change streams.
- Autenticación `MONGODB-AWS` / `MONGODB-CR`: no las usamos.
- `ClientMetadata*` removidos del public API, `CommandOptions.noResponse`, `CreateCollectionOptions.autoIndexId`, `FindOneOptions.batchSize/limit/noCursorTimeout`, `ReadPreference.minWireVersion`, `ServerCapabilities`, `CommandOperationOptions.retryWrites`, `ClientSession.transaction`, clases `Transaction`/`CancellationToken`/`CloseOptions`/`ResumeOptions`: ninguno se usa.
- GridFS `contentType`/`aliases`: no usamos GridFS.
- Errores de encryption subclaseando `MongoError` y rename `PoolRequstedRetry` → `PoolRequestedRetry`: no capturamos por label ni clase de encryption.
- `aggregate()` con write concern + explain lanzando `MongoServerError`: nunca combinamos ambas en el mismo call.

---

## Resumen ejecutivo

| Major | ¿Seguro? | Cambios bloqueantes a tocar                                            |
| ----- | -------- | ---------------------------------------------------------------------- |
| v5    | No       | Rama `catch` de `multiInsert` (`err.result.result`) + `new ObjectId()` obligatorio en todo el código y tests |
| v6    | No       | `findOneAndUpdate` en `save()` e `increment()`; BSON v6; Node ≥16.20.1 |
| v7    | Casi     | `drop()` deja de tirar; Node ≥20.19 (`.nvmrc` → `22`); flakiness en test de wrapper con node rápido; revisar batchSize en `aggregate` |

Orden recomendado: bump staged 4→5→6→7 con CI de integración por cada salto, no un salto directo 4→7. El pivote más frágil es v6 por `findOneAndUpdate`; conviene cubrirlo con un test de integración real antes del bump.
