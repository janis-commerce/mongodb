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

	it('multiInsert(): Should return every successfully inserted document, not just the ones matching the wrong index', async () => {

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

	it('multiUpdate(): Should stop at the failing index and reject with MongoDBError when rawResponse is not used', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.multiInsert(model, [{ name: 'A' }, { name: 'B' }, { name: 'C' }]);

		await assert.rejects(
			mongodb.multiUpdate(model, [
				{ filter: { name: 'A' }, data: { extra: 1 } }, // succeeds
				{ filter: { name: 'B' }, data: { name: 'A' } }, // violates the unique index on `name`
				{ filter: { name: 'C' }, data: { extra: 3 } } // never executed: the bulk is ordered
			]),
			MongoDBError
		);

		// the operation before the failing index was applied and persisted
		const [updatedFirst] = await mongodb.get(model, { filters: { name: 'A' } });
		assert.equal(updatedFirst.extra, 1);

		// the operation after the failing index was never executed
		const [notUpdatedLast] = await mongodb.get(model, { filters: { name: 'C' } });
		assert.equal(notUpdatedLast.extra, undefined);
	});

	it('multiUpdate(): Should resolve with the write errors detail and apply every operation when rawResponse is true', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.multiInsert(model, [{ name: 'A' }, { name: 'B' }, { name: 'C' }]);

		const result = await mongodb.multiUpdate(model, [
			{ filter: { name: 'A' }, data: { extra: 1 } }, // succeeds
			{ filter: { name: 'B' }, data: { name: 'A' } }, // violates the unique index on `name`
			{ filter: { name: 'C' }, data: { extra: 3 } } // succeeds: the bulk is unordered
		], { rawResponse: true });

		assert.equal(result.success, false);
		assert.equal(result.modifiedCount, 2);
		assert.equal(result.writeErrors.length, 1);
		assert.equal(result.writeErrors[0].index, 1);

		assert.deepEqual(result.operations.map(({ index, success }) => ({ index, success })), [
			{ index: 0, success: true },
			{ index: 1, success: false },
			{ index: 2, success: true }
		]);

		assert.ok(result.operations[1].errors.length);

		// the operation after the failing index was applied and persisted
		const [updatedLast] = await mongodb.get(model, { filters: { name: 'C' } });
		assert.equal(updatedLast.extra, 3);
	});

	it('multiUpdate(): Should map the write errors to the original operation index when the failures are non-contiguous', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.multiInsert(model, [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }]);

		const result = await mongodb.multiUpdate(model, [
			{ filter: { name: 'B' }, data: { name: 'A' } }, // violates the unique index on `name`
			{ filter: { name: 'C' }, data: { extra: 1 } }, // succeeds
			{ filter: { name: 'D' }, data: { name: 'A' } }, // violates the unique index on `name`
			{ filter: { name: 'C' }, data: { otherExtra: 2 } } // succeeds
		], { rawResponse: true });

		assert.equal(result.success, false);
		assert.deepEqual(result.writeErrors.map(({ index }) => index), [0, 2]);

		assert.deepEqual(result.operations.map(({ index, success }) => ({ index, success })), [
			{ index: 0, success: false },
			{ index: 1, success: true },
			{ index: 2, success: false },
			{ index: 3, success: true }
		]);

		assert.equal(result.operations[0].errors[0].index, 0);
		assert.equal(result.operations[2].errors[0].index, 2);

		const [updatedDocument] = await mongodb.get(model, { filters: { name: 'C' } });
		assert.equal(updatedDocument.extra, 1);
		assert.equal(updatedDocument.otherExtra, 2);
	});

});
