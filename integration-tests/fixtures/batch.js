'use strict';

const assert = require('node:assert').strict;

const sinon = require('sinon');

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const MongoDBError = require('../../lib/mongodb-error');

describe('Batch', () => {

	const now = new Date();

	let clock;

	before(() => {
		clock = sinon.useFakeTimers({ now, toFake: ['Date'] });
	});

	beforeEach(async () => {
		// The unique index on `name` must be (re)created on every test: dropCollection() in afterEach drops it too
		await getMongodbInstance().createIndexes(new TestModel(), TestModel.indexes);
	});

	afterEach(async () => {
		clock.setSystemTime(now);
		await getMongodbInstance().dropCollection(TestModel.table);
	});

	after(() => {
		sinon.restore();
	});

	it('multiInsert(): Should insert multiple documents and return an array of documents', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.multiInsert(model, [
			{ name: 'Test 1' },
			{ name: 'Test 2' }
		]);

		const result = await getMongodbInstance().get(model, {
			filters: {
				name: 'Test 1'
			}
		});

		sinon.assert.match(result, [{
			id: sinon.match.string,
			name: 'Test 1',
			dateCreated: now
		}]);
	});

	it('multiSave(): Should save multiple documents and return an array of documents', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.multiSave(model, [
			{ name: 'Test 1' },
			{ name: 'Test 2' }
		]);

		const result = await getMongodbInstance().get(model, {
			filters: {
				name: 'Test 1'
			}
		});

		sinon.assert.match(result, [{
			id: sinon.match.string,
			name: 'Test 1',
			dateCreated: now,
			dateModified: sinon.match.date
		}]);
	});

	it('multiRemove(): Should remove multiple documents and return an array of documents', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.multiInsert(model, [
			{ name: 'Test 1' },
			{ name: 'Test 2' },
			{ name: 'Other' }
		]);

		await mongodb.multiRemove(model, {
			name: {
				type: 'search',
				value: 'Test'
			}
		});

		const result = await getMongodbInstance().get(model, {});

		sinon.assert.match(result, [{
			id: sinon.match.string,
			name: 'Other',
			dateCreated: now
		}]);
	});

	it('multiInsert(): Should skip a single duplicated document and return only the inserted ones', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		const result = await mongodb.multiInsert(model, [
			{ name: 'Unique 1' },
			{ name: 'Unique 1' } // duplicate of the previous one, violates the unique index on `name`
		]);

		sinon.assert.match(result, [{
			id: sinon.match.string,
			name: 'Unique 1',
			dateCreated: now
		}]);

		const stored = await mongodb.get(model, {});
		assert.equal(stored.length, 1);
	});

	/**
	 * TODO(bug): lib/mongodb.js multiInsert() (~line 489-493) filters the returned array using the index of the
	 * already-mapped/filtered array of successful inserts, instead of the original index in `items`:
	 * `.filter((item, index) => !indexesWithError.includes(index))`. `indexesWithError` holds ORIGINAL indexes
	 * (from `err.writeErrors[].index`), but the `index` received by `.filter()` is the position within the
	 * already-successful-only mapped array. When more than one item is inserted successfully after the failed
	 * index, a valid inserted item gets silently dropped from the return value, even though it IS persisted.
	 *
	 * Input: multiInsert(model, [{name:'A'}, {name:'A'} (dup of index 0, fails), {name:'B'}, {name:'C'}])
	 * Expected: returns the 3 actually inserted documents (A, B, C)
	 * Actual: returns only 2 documents (A, C) — B is missing from the return value despite being inserted
	 */
	it.skip('multiInsert(): TODO(bug) Should return every successfully inserted document, not just the ones matching the wrong index', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		const result = await mongodb.multiInsert(model, [
			{ name: 'A' },
			{ name: 'A' }, // duplicate of index 0, fails
			{ name: 'B' },
			{ name: 'C' }
		]);

		sinon.assert.match(result, [
			{ id: sinon.match.string, name: 'A', dateCreated: now },
			{ id: sinon.match.string, name: 'B', dateCreated: now },
			{ id: sinon.match.string, name: 'C', dateCreated: now }
		]);
	});

	it('multiInsert(): Should reject with MongoDBError when failOnDuplicateErrors is true', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.insert(model, { name: 'Existing' });

		await assert.rejects(
			mongodb.multiInsert(model, [{ name: 'Existing' }], { failOnDuplicateErrors: true }),
			MongoDBError
		);
	});

	it('multiUpdate(): Should apply the operations before the failing index and reject with MongoDBError', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.multiInsert(model, [{ name: 'A' }, { name: 'B' }]);

		await assert.rejects(
			mongodb.multiUpdate(model, [
				{ filter: { name: 'A' }, data: { extra: 1 } }, // succeeds
				{ filter: { name: 'B' }, data: { name: 'A' } } // violates the unique index on `name`
			], { rawResponse: true }),
			MongoDBError
		);

		// the operation before the failing index was applied and persisted (bulkWrite default is ordered: true)
		const stored = await mongodb.get(model, { filters: { name: 'A' } });
		sinon.assert.match(stored, [{
			id: sinon.match.string,
			name: 'A',
			extra: 1,
			dateCreated: now,
			dateModified: sinon.match.instanceOf(Date)
		}]);
	});

	/**
	 * TODO(bug): lib/mongodb.js multiUpdate() (~line 597-629) never returns the documented
	 * `{ writeErrors, writeConcernErrors, operations }` shape when there's an actual write error. `bulkWrite()`
	 * is called without `ordered: false`, so on a real write error (e.g. unique index violation) the driver
	 * rejects the bulkWrite() promise with a MongoBulkWriteError instead of resolving with a result object that
	 * exposes `getWriteErrors()`. The `try` block never reaches the `if(rawResponse)` branch: the `catch` wraps
	 * ANY error, including this one, into a generic MongoDBError, discarding writeErrors/writeConcernErrors and
	 * the per-operation success/errors data described by the spec.
	 *
	 * Input: multiUpdate(model, [{filter:{name:'A'},data:{extra:1}}, {filter:{name:'B'},data:{name:'A'}}], {rawResponse:true})
	 * Expected (per spec): resolves { writeErrors: [...], operations: [{success:true,...}, {success:false, errors:[...]}] }
	 * Actual: rejects with MongoDBError; writeErrors/operations data is never exposed to the caller
	 */
	it.skip('multiUpdate(): TODO(bug) Should resolve with writeErrors and per-operation success/errors instead of rejecting', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.multiInsert(model, [{ name: 'A' }, { name: 'B' }]);

		const result = await mongodb.multiUpdate(model, [
			{ filter: { name: 'A' }, data: { extra: 1 } },
			{ filter: { name: 'B' }, data: { name: 'A' } } // violates the unique index on `name`
		], { rawResponse: true });

		assert.ok(result.writeErrors.length);
		assert.equal(result.operations[0].success, true);
		assert.equal(result.operations[1].success, false);
		assert.ok(result.operations[1].errors.length);
	});

});
