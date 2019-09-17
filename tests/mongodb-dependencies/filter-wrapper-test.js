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
			},
			store_equal: 'AB'
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

	describe('Using FilterWrapper', () => {

		it('should get an equal value if isnt defined type', async () => {
			// Insert
			const result = await mongodb.save(model, { id: 1, store: 'Janis', gain: 10, bla: 'foo' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result), true);
			const item = await mongodb.get(model, { filters: { bla: 'foo', gain: 10 } });
			assert.deepStrictEqual(item[0].store, 'Janis');
			await clearMockedDatabase();
		});

		it('should get a value if is not defined a filter', async () => {
			// Insert
			const result = await mongodb.save(model, { id: 1, store: 'Janis', gain: 10, bla: 'foo' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result), true);
			const item = await mongodb.get(model, { });
			assert.deepStrictEqual(item[0].store, 'Janis');
			await clearMockedDatabase();
		});

		it('should get an or filter if defined by an array', async () => {
			// Insert
			const result = await mongodb.save(model, {
				id: 1,
				store: 'Janis',
				gain: 10,
				bla: 'foo'
			});
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result), true);
			const item = await mongodb.get(model, {
				filters: [{
					store: {
						value: 'Janis',
						type: 'not'
					},
					bla: 'afoo'
				},
				{
					gain: 10
				}]
			});
			assert.deepStrictEqual(item[0].store, 'Janis');
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

		it('should get an gte filter if isnt defined type', async () => {
			// Insert
			const result = await mongodb.save(model, { id: 1, date: '2000-01-02', store: 'AAA' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result), true);
			const result2 = await mongodb.save(model, { id: 2, date: '2000-01-05', store: 'AAA' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result2), true);
			const result3 = await mongodb.save(model, { id: 3, date: '2000-01-10', store: 'AAA' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result3), true);
			const item = await mongodb.get(model, { filters: { date: { value: '2000-01-10', type: 'lesser' }, store: 'AAA' } });
			assert.deepStrictEqual([item[0].date, item[1].date], ['2000-01-02', '2000-01-05']);
			await clearMockedDatabase();
		});

		it('should get an or filter if define a array', async () => {
			// Insert
			const result = await mongodb.save(model, { id: 1, store: 'save_test_data' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result), true);
			const result2 = await mongodb.save(model, { id: 2, store: 'only_for_test' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result2), true);
			const result3 = await mongodb.save(model, { id: 3, store: 'foo_value' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result3), true);
			const item = await mongodb.get(model, { filters: [{ store: 'save_test_data' }, { store: { value: 'foo_value', type: 'equal' } }] });
			assert.deepStrictEqual([item[0].store, item[1].store], ['save_test_data', 'foo_value']);
			await clearMockedDatabase();
		});

		it('should get values with an in filter if define a array to search', async () => {
			// Insert
			const result = await mongodb.save(model, { id: 1, store: 'save_test_data' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result), true);
			const result2 = await mongodb.save(model, { id: 2, store: 'only_for_test' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result2), true);
			const result3 = await mongodb.save(model, { id: 3, store: 'foo_value' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result3), true);
			const item = await mongodb.get(model, { filters: { store: { value: ['save_test_data', 'foo_value'], type: 'in' } } });
			assert.deepStrictEqual([item[0].store, item[1].store], ['save_test_data', 'foo_value']);
			await clearMockedDatabase();
		});

		it('should get values with an in filter if define a array to search', async () => {
			// Insert
			const result = await mongodb.save(model, { id: 1, store: 'save_test_data' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result), true);
			const result2 = await mongodb.save(model, { id: 2, store: 'only_for_test' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result2), true);
			const result3 = await mongodb.save(model, { id: 3, store: 'foo_value' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result3), true);
			const item = await mongodb.get(model, { filters: { store: { value: ['save_test_data', 'foo_value'], type: 'notIn' } } });
			assert.deepStrictEqual([item[0].store], ['only_for_test']);
			await clearMockedDatabase();
		});

		it('should get all values in a filter if define a array to search', async () => {
			// Insert
			const result = await mongodb.save(model, { id: 1, store: ['save_test_data', 'blabla'] });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result), true);
			const result2 = await mongodb.save(model, { id: 2, store: ['blabla'] });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result2), true);
			const result3 = await mongodb.save(model, { id: 3, store: 'foo_value' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result3), true);
			const item = await mongodb.get(model, { filters: { store: { value: ['save_test_data', 'blabla'], type: 'all' } } });
			assert.deepStrictEqual([item[0].store], [['save_test_data', 'blabla']]);
			await clearMockedDatabase();
		});

		it('should get all values that accomplish one value of filter if define a array to search', async () => {
			// Insert
			const result = await mongodb.save(model, { id: 1, store: ['save_test_data', 'blabla'] });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result), true);
			const result2 = await mongodb.save(model, { id: 2, store: ['blabla', 'new_foo_value'] });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result2), true);
			const result3 = await mongodb.save(model, { id: 3, store: ['foo_value'] });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result3), true);
			const item = await mongodb.get(model, { filters: { store: { value: ['blabla'], type: 'in' } } });
			assert.deepStrictEqual(item.length, 2);
			await clearMockedDatabase();
		});

	});
});
