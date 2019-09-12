'use strict';

// Clear node require caches
Object.keys(require.cache).forEach(key => { delete require.cache[key]; });

const assert = require('assert');
const sandbox = require('sinon').createSandbox();
const mockRequire = require('mock-require');
const MongoDriver = require('mongodb');

mockRequire('mongodb', 'mongo-mock');

const MongoMock = require('mongodb');

MongoMock.max_delay = 0; // Evitar lags en los tests

const MongoDB = require('../../index');

class Model {

	static get uniqueIndexes() {
		return [
			'id',
			'unique'
		];
	}

	static get indexes() {
		return [
			'value'
		];
	}

	static get table() {
		return 'table';
	}

	static get fields() {
		return {
			date_from: {
				type: 'greaterOrEqual',
				field: 'date'
			},
			date_from2: {
				type: 'greater',
				field: 'date'
			},
			date_to: {
				type: 'lesserOrEqual',
				field: 'date'
			},
			date_to2: {
				type: 'lesser',
				field: 'date'
			},
			store_dist: {
				type: 'not',
				field: 'store'
			}
		};
	}

}

const mongodb = new MongoDB({
	host: 'localhost',
	port: 27017,
	database: 'myDB'
});

const model = new Model();

const getCollection = async () => {
	await mongodb.checkConnection();
	return mongodb.client.db(mongodb.config.database)
		.collection(model.constructor.table);
};

const clearMockedDatabase = async () => {
	const collection = await getCollection();
	await collection.drop();
};

describe('MongoDB', () => {

	afterEach(() => {
		sandbox.restore();
	});

	after(() => {
		mockRequire.stopAll();
	});

	describe('filterWrapper', () => {
		it('should get an equal value if isnt defined type', async () => {
			// Insert
			const result = await mongodb.save(model, { id: 1, value: 'save_test_data' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result), true);
			const item = await mongodb.get(model, { filters: { value: 'save_test_data' } });
			assert.deepStrictEqual(item[0].value, 'save_test_data');
			// Update
			/* result = await mongodb.save(model, { id: item[0].id, value: 'save_test_data_updated' });
			assert.deepEqual(result, item[0].id.toString());
			item = await mongodb.get(model, { filters: { id: item[0].id } });
			assert.deepEqual(item[0].value, 'save_test_data_updated'); */
			await clearMockedDatabase();
		});

		it('should get an gte date if isnt defined type', async () => {
			// Insert
			const result = await mongodb.save(model, { id: 1, date: '2000-01-03' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result), true);
			const item = await mongodb.get(model, { filters: { date_from: '2000-01-01' } });
			assert.deepStrictEqual(item[0].date, '2000-01-03');
			await clearMockedDatabase();
		});

		it('should get an gt date if define a field with that filter', async () => {
			// Insert
			const result = await mongodb.save(model, { id: 1, date: '2000-01-01' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result), true);
			const result1 = await mongodb.save(model, { id: 2, date: '2000-01-02' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result1), true);
			const result2 = await mongodb.save(model, { id: 3, date: '2000-01-03' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result2), true);
			const item = await mongodb.get(model, { filters: { date_from2: '2000-01-01' } });
			assert.deepStrictEqual([item[0].date, item[1].date], ['2000-01-02', '2000-01-03']);
			await clearMockedDatabase();
		});

		it('should get an lte filter if is defined that filter', async () => {
			// Insert
			const result = await mongodb.save(model, { id: 1, date: '2000-01-25' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result), true);
			const item = await mongodb.get(model, { filters: { date_to: '2000-01-25' } });
			assert.deepStrictEqual(item[0].date, '2000-01-25');
			await clearMockedDatabase();
		});

		it('should get an lt date if is defined that filter', async () => {
			// Insert
			const result = await mongodb.save(model, { id: 1, date: '2000-01-25' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result), true);
			const result1 = await mongodb.save(model, { id: 2, date: '2000-01-02' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result1), true);
			const item = await mongodb.get(model, { filters: { date_to2: '2000-01-25' } });
			assert.deepStrictEqual(item[0].date, '2000-01-02');
			await clearMockedDatabase();
		});

		it('should get a value if filter is distinct', async () => {
			// Insert
			const result = await mongodb.save(model, { id: 1, store: 'ASTORE' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result), true);
			const item = await mongodb.get(model, { filters: { store_dist: 'JBA1' } });
			assert.deepStrictEqual(item[0].store, 'ASTORE');
			await clearMockedDatabase();
		});

		/* it('should get an gte filter if isnt defined type', async () => {
			// Insert
			const result = await mongodb.save(model, { id: 1, date_from: '2000-01-03' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result), true);
			const item = await mongodb.get(model, { filters: { date_from: '2000-01-01' } });
			assert.deepStrictEqual(item[0].date_from, '2000-01-03');
			await clearMockedDatabase();
		});*/

		/* it('should get an equal filter if isnt defined type', async () => {
			// Insert
			const result = await mongodb.save(model, { id: 1, value: 'save_test_data' });
			assert.deepEqual(MongoDriver.ObjectID.isValid(result), true);
			const item = await mongodb.get(model, { filters: { value: 'save_test_data', type: 'notEqual' } });
			assert.deepEqual(item[0].value, '');
			await clearMockedDatabase();
		});*/
	});

});
