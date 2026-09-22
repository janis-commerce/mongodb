'use strict';

const assert = require('node:assert').strict;

const sinon = require('sinon');

const { ObjectId } = require('../../lib/mongodb');

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');

describe('CRUD', () => {

	const now = new Date();

	let clock;

	before(() => {
		clock = sinon.useFakeTimers({ now, toFake: ['Date'] });
	});

	afterEach(async () => {
		clock.setSystemTime(now);
		await getMongodbInstance().dropCollection(TestModel.table);
	});

	after(() => {
		sinon.restore();
	});

	it('get(): Should return an empty array if no records exist', async () => {

		const result = await getMongodbInstance().get(new TestModel(), {});

		assert.deepEqual(result, []);
	});

	it('insert() + get(): Should insert a document and return an array of documents if records exist', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.insert(model, {
			name: 'Test'
		});
		const result = await getMongodbInstance().get(model, {});

		sinon.assert.match(result, [{
			id: sinon.match.string,
			name: 'Test',
			dateCreated: now
		}]);
	});

	it('insert() + get(): Should insert multiple documents and return an array of filtered documents if filters are passed', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.insert(model, { name: 'Test 1' });
		await mongodb.insert(model, { name: 'Test 2' });

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

	it('insert() + update(): Should insert multiple documents and then update one of them', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.insert(model, { name: 'Test 1' });
		await mongodb.insert(model, { name: 'Test 2' });

		await mongodb.update(model, {
			name: 'Test 1 Updated'
		}, {
			name: 'Test 1'
		});

		const result = await getMongodbInstance().get(model, {
			filters: {
				name: 'Test 1 Updated'
			}
		});

		sinon.assert.match(result, [{
			id: sinon.match.string,
			name: 'Test 1 Updated',
			dateCreated: now,
			dateModified: now
		}]);
	});

	it('distinct(): Should return an array of distinct values for a given field', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.insert(model, { name: 'Test 1', parent: 1 });
		await mongodb.insert(model, { name: 'Test 2', parent: 1 });
		await mongodb.insert(model, { name: 'Test 3', parent: 2 });

		const result = await getMongodbInstance().distinct(model, {
			key: 'parent'
		});

		sinon.assert.match(result, [1, 2]);
	});

	it('save(): Should upsert a new document and return its generated id', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		const id = await mongodb.save(model, { name: 'Saved Test' });

		assert.equal(typeof id, 'string');

		const result = await mongodb.get(model, { filters: { name: 'Saved Test' } });

		// $currentDate applies on every save(), even on insert (upsert), so dateModified is also set
		sinon.assert.match(result, [{
			id,
			name: 'Saved Test',
			dateCreated: now,
			dateModified: sinon.match.instanceOf(Date)
		}]);
	});

	it('save(): Should update an existing document and return the same id', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		const insertedId = await mongodb.save(model, { name: 'Existing Test', extra: 1 });

		const updatedId = await mongodb.save(model, { name: 'Existing Test', extra: 2 });

		assert.equal(updatedId, insertedId);

		const result = await mongodb.get(model, { filters: { name: 'Existing Test' } });

		// dateModified is set with $currentDate (server-side), so it reflects real server time, not the faked client Date
		sinon.assert.match(result, [{
			id: insertedId,
			name: 'Existing Test',
			extra: 2,
			dateCreated: now,
			dateModified: sinon.match.instanceOf(Date)
		}]);
	});

	it('increment(): Should increment the value of the given fields and optionally set additional fields', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.insert(model, { name: 'Test 1', firstValue: 1, secondValue: 10 });

		const result = await getMongodbInstance().increment(model, {
			name: 'Test 1'
		}, {
			firstValue: 1,
			secondValue: 30
		}, {
			additionalData: 'test'
		});

		// increment() returns the raw driver document (with `_id`), it does not go through the id mapper
		sinon.assert.match(result, {
			_id: sinon.match.instanceOf(ObjectId),
			name: 'Test 1',
			firstValue: 2,
			secondValue: 40,
			additionalData: 'test',
			dateCreated: now,
			dateModified: now
		});

		const stored = await getMongodbInstance().get(model, {});

		sinon.assert.match(stored, [{
			id: sinon.match.string,
			name: 'Test 1',
			firstValue: 2,
			secondValue: 40,
			additionalData: 'test',
			dateCreated: now,
			dateModified: now
		}]);
	});

	it('increment(): Should return null when the filter matches no document', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		const result = await mongodb.increment(model, {
			name: 'Non existent'
		}, {
			firstValue: 1
		});

		assert.equal(result, null);
	});

});
