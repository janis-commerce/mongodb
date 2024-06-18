'use strict';

const assert = require('node:assert').strict;

const sinon = require('sinon');

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');

describe('CRUD', () => {

	const now = new Date();

	before(() => {
		sinon.useFakeTimers(now);
	});

	afterEach(() => {
		getMongodbInstance().dropCollection(TestModel.table);
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

	it('increment(): Should increment the value of the given fields and optionally set additional fields', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.insert(model, { name: 'Test 1', firstValue: 1, secondValue: 10 });

		await getMongodbInstance().increment(model, {
			name: 'Test 1'
		}, {
			firstValue: 1,
			secondValue: 30
		}, {
			additionalData: 'test'
		});

		const result = await getMongodbInstance().get(model, {});

		sinon.assert.match(result, [{
			id: sinon.match.string,
			name: 'Test 1',
			firstValue: 2,
			secondValue: 40,
			additionalData: 'test',
			dateCreated: now,
			dateModified: now
		}]);
	});

});
