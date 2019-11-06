'use strict';

// Clear node require caches
Object.keys(require.cache).forEach(key => { delete require.cache[key]; });

const assert = require('assert');
const sandbox = require('sinon').createSandbox();
const mockRequire = require('mock-require');
const MongoDriver = require('mongodb');

require('lllog')('none');

mockRequire('mongodb', 'mongo-mock');

const MongoMock = require('mongodb');

const { MongoClient, ObjectID } = MongoMock;

MongoMock.max_delay = 0; // Evitar lags en los tests

const MongoDB = require('./../lib/mongodb');
const MongoDBError = require('./../lib/mongodb-error');

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
}

const mongodb = new MongoDB({
	host: 'localhost',
	port: 27017,
	database: 'myDB'
});

const model = new Model();

const getCollection = async () => {
	await mongodb.checkConnection();
	return mongodb.db
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

	describe('constructor', () => {
		it('should reject when MongoClient can\'t connect', async () => {

			const newMongo = new MongoDB({
				host: 'localhost',
				user: 'root',
				password: '1234',
				database: 'myDB'
			});

			sandbox.mock(MongoClient).expects('connect')
				.once()
				.rejects(new Error('Error when connects'));

			await assert.rejects(newMongo.checkConnection(), {
				message: 'Error when connects'
			});
		});

		it('should use default values when the config is incomplete', () => {

			let result;

			assert.doesNotThrow(() => {
				const newMongo = new MongoDB({
					database: 'myDB'
				});
				result = newMongo.config;
			});

			assert.deepStrictEqual(result.port, 27017);

		});
	});

	describe('checkConnection()', () => {

		it('should call MongoClient connect when checks the connection (without user and password)', async () => {

			const spy = sandbox.spy(MongoClient, 'connect');

			await assert.doesNotReject(mongodb.checkConnection());

			sandbox.assert.calledOnce(spy);

		});

		it('should call MongoClient connect when checks the connection (using user and password)', async () => {

			const newMongo = new MongoDB({
				host: 'localhost',
				user: 'root',
				password: '1234',
				database: 'myDB'
			});

			const spy = sandbox.spy(MongoClient, 'connect');

			await assert.doesNotReject(newMongo.checkConnection());

			sandbox.assert.calledOnce(spy);

		});

		it('should cache connection and call connect method just once when calls again for the value cached returns undefined', async () => {

			const newMongo = new MongoDB({
				host: 'localhost',
				user: 'root',
				password: '1234',
				database: 'myDB'
			});

			await assert.doesNotReject(newMongo.checkConnection());
			assert.deepStrictEqual(await newMongo.checkConnection(), undefined);
		});

		it('should cache connection don\'t connect to DB cause exists', async () => {

			const newMongo = new MongoDB({
				host: 'localhost',
				user: 'root',
				password: '1234',
				database: 'myDB'
			});

			newMongo.cleanCache();
			const spy = sandbox.spy(MongoClient, 'connect');

			await assert.doesNotReject(newMongo.checkConnection());
			await assert.doesNotReject(newMongo.checkConnection());

			sandbox.assert.calledOnce(spy);
		});
	});

	describe('formatIndex()', () => {

		it('should return a formatted index object when recieves an array as parameter', async () => {
			assert.deepStrictEqual(mongodb.formatIndex(['foo', 'bar']), { foo: 1, bar: 1 });
		});

		it('should return formatted index object when recieves a string as parameter', () => {
			assert.deepStrictEqual(mongodb.formatIndex('foo'), { foo: 1 });
		});
	});

	describe('createIndexes()', () => {

		const createIndexesStub = async () => {
			await mongodb.checkConnection();
			const collection = mongodb.db
				.collection(model.constructor.table);
			return sandbox.stub(collection, 'createIndex');
		};

		it('should not reject when create indexes without unique indexes in the model', async () => {

			const createIndex = await createIndexesStub();

			sandbox.stub(model.constructor, 'uniqueIndexes').get(() => {
				return null;
			});

			await assert.doesNotReject(mongodb.createIndexes(model));
			assert.deepStrictEqual(createIndex.called, true);
		});

		it('should not reject when create indexes without indexes in the model', async () => {

			const createIndex = await createIndexesStub();

			sandbox.stub(model.constructor, 'indexes').get(() => {
				return null;
			});

			await assert.doesNotReject(mongodb.createIndexes(model));
			assert.deepStrictEqual(createIndex.called, true);
		});

		it('should not reject when create indexes with indexes and unique indexes in the model', async () => {

			const createIndex = await createIndexesStub();

			await assert.doesNotReject(mongodb.createIndexes(model));

			assert.deepStrictEqual(createIndex.called, true);
		});

		it('should reject when try to create indexes with an invalid model', async () => {
			await assert.rejects(mongodb.createIndexes(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('should throw when mongodb rejects the operation', async () => {

			const createIndex = await createIndexesStub();

			createIndex.rejects(new Error('Internal mongodb error'));

			await assert.rejects(mongodb.createIndexes(model), {
				name: 'MongoDBError',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});
		});
	});

	describe('prepareFields()', () => {

		it('should replace the \'id\' field with \'_id\' when \'id\' exists', () => {

			const ObjID = ObjectID();

			const fields = {
				id: ObjID.toString()
			};

			mongodb.prepareFields(fields);

			assert.deepStrictEqual(typeof fields.id, 'undefined');

			assert.deepStrictEqual(fields._id, ObjID);
		});

		it('should replace the \'id\' field with \'_id\' when \'id\' exists and is an array', () => {

			const ObjID = ObjectID();

			const fields = {
				id: [ObjID.toString()]
			};

			mongodb.prepareFields(fields);

			assert.deepStrictEqual(typeof fields.id, 'undefined');

			assert.deepStrictEqual(fields._id, [ObjID]);
		});

		it('should replace the \'id\' field with \'_id\' when \'id\' exists for filters', () => {

			const ObjID = ObjectID();

			const fields = {
				id: ObjID.toString()
			};

			mongodb.prepareFields(fields, true);

			assert.deepStrictEqual(typeof fields.id, 'undefined');

			assert.deepStrictEqual(fields._id, ObjID);
		});

		it('should replace the \'id\' field with \'_id\' when \'id\' exists and is an array for filters', () => {

			const ObjID = ObjectID();

			const fields = {
				id: [ObjID.toString()]
			};

			mongodb.prepareFields(fields, true);

			assert.deepStrictEqual(typeof fields.id, 'undefined');

			assert.deepStrictEqual(fields._id, { $in: [ObjID] });
		});

		it('should do nothing when the \'_id\' exists and \'id\' not exists', () => {

			const ObjID = ObjectID();

			const fields = {
				_id: ObjID
			};

			mongodb.prepareFields(fields);

			assert.deepStrictEqual(typeof fields.id, 'undefined');

			assert.deepStrictEqual(fields._id, ObjID);
		});

	});

	describe('prepareFieldsForOutput()', () => {

		it('should replace the \'_id\' field with \'id\' when \'_id\' exists', () => {

			const ObjID = ObjectID();

			const fields = {
				_id: ObjID
			};

			mongodb.prepareFieldsForOutput(fields);

			assert.deepStrictEqual(typeof fields._id, 'undefined');

			assert.deepStrictEqual(fields.id, ObjID);
		});
	});

	describe('getFilter()', () => {

		it('should return non empty filter object when get filters with an array as parameter', () => {

			sandbox.stub(model.constructor, 'uniqueIndexes').get(() => {
				return [['id']];
			});

			const result = mongodb.getFilter(model, { id: 1 });

			assert.deepStrictEqual(result.id, 1);
		});

		it('should return non empty filter object when get filters with an object as parameter', () => {

			const result = mongodb.getFilter(model, { id: 1 });

			assert.deepStrictEqual(result.id, 1);
		});

		it('should throw when get filters with a model without unique indexes', () => {

			assert.throws(() => {
				mongodb.getFilter({});
			}, {
				name: 'MongoDBError',
				code: MongoDBError.codes.MODEL_EMPTY_UNIQUE_INDEXES
			});
		});

		it('should throw when try to get filters and the model unique indexes not matches with any of the filters', () => {

			assert.throws(() => {
				mongodb.getFilter(model);
			}, {
				name: 'MongoDBError',
				code: MongoDBError.codes.EMPTY_UNIQUE_INDEXES
			});

		});

		it('should throw when get filters with an invalid model', () => {
			assert.throws(() => {
				mongodb.getFilter();
			}, {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});
	});

	describe('insert()', () => {

		it('should return true when the data was successfully inserted into mongodb', async () => {

			const result = await mongodb.insert(model, {	value: 'insert_test_data' });

			assert(MongoDriver.ObjectID.isValid(result));

			await clearMockedDatabase();
		});

		it('should reject when try to insert with an invalid model', async () => {
			await assert.rejects(mongodb.insert(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('should throw when mongodb rejects the operation', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'insertOne').rejects(new Error('Internal mongodb error'));

			await assert.rejects(mongodb.insert(model, { value: 'insert_test_data' }));
		});
	});

	describe('distinct()', () => {

		it('should throw if distinct model is not passed', async () => {
			await assert.rejects(mongodb.distinct(null), {
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('should throw if distinct key is not passed', async () => {
			await assert.rejects(mongodb.distinct(model, {}), {
				code: MongoDBError.codes.INVALID_DISTINCT_KEY
			});
		});

		it('should throw if distinct key is not a string', async () => {
			await assert.rejects(mongodb.distinct(model, { key: ['invalidKey'] }), {
				code: MongoDBError.codes.INVALID_DISTINCT_KEY
			});
		});

		it('should return data object when get the data from db', async () => {

			// Distinct is not implemented in mongo-mock so far. So it needs to be defined here.

			const mongoDbResponse = [
				'Value 1',
				'Value 2',
				'Value 3'
			];

			await mongodb.checkConnection();
			const collection = mongodb.db.collection(model.constructor.table);

			collection.distinct = () => ({
				toArray: () => Promise.resolve([...mongoDbResponse])
			});

			sandbox.spy(collection, 'distinct');

			const result = await mongodb.distinct(model, { key: 'myKey' });

			assert.deepStrictEqual(result, [...mongoDbResponse]);
			sandbox.assert.calledOnce(collection.distinct);
			sandbox.assert.calledWithExactly(collection.distinct, 'myKey', {});
		});

		it('should throw if distinct fails', async () => {

			// Distinct is not implemented in mongo-mock so far. So it needs to be defined here.

			await mongodb.checkConnection();
			const collection = mongodb.db.collection(model.constructor.table);

			collection.distinct = () => ({
				toArray: () => Promise.reject(new Error('Some internal error'))
			});

			await assert.rejects(mongodb.distinct(model, { key: 'myKey' }), {
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});
		});
	});

	describe('get()', () => {

		it('should return data object when get the data from db', async () => {

			await mongodb.insert(model, { value: 'get_test_data' });

			const result = await mongodb.get(model, { order: { id: 'asc' } });

			assert.deepStrictEqual(result[0].value, 'get_test_data');

			await clearMockedDatabase();
		});

		it('should reject when try to get data with an invalid model', async () => {
			await assert.rejects(mongodb.get(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('should throw when mongodb rejects the operation', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'find').throws(new Error('Internal mongodb error'));

			await assert.rejects(mongodb.get(model), {
				name: 'MongoDBError',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});
		});
	});

	describe('save()', () => {

		it('should upsert an item when save an unexisting and existing item', async () => {
			// Insert
			let result = await mongodb.save(model, { id: '5d5476783cb30600068170df', value: 'save_test_data' });
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result), true);
			let item = await mongodb.get(model, { filters: { value: 'save_test_data' } });
			assert.deepStrictEqual(item[0].value, 'save_test_data');
			// Update
			result = await mongodb.save(model, { id: item[0].id, value: 'save_test_data_updated' });
			assert.deepStrictEqual(result, item[0].id.toString());
			item = await mongodb.get(model, { filters: { id: item[0].id } });
			assert.deepStrictEqual(item[0].value, 'save_test_data_updated');
			await clearMockedDatabase();
		});

		it('should updated an existing item', async () => {
			// To simulate real Updated MongoDB response, Mock response always response with the upsertId even in Update (and Mongo driver not)
			const itemSaved = { id: '00000000ef72e55d7436f9ba', value: 'save_test_data' };

			const collection = await getCollection();
			sandbox.stub(collection, 'updateOne').returns({ matchedCount: 1, modifiedCount: 1 });

			const result = await mongodb.save(model, { id: itemSaved.id, value: 'save_test_data_updated' });
			assert.deepStrictEqual(result, itemSaved.id);

		});

		it('should return unique Index (not ID) when try to save with that unique Index', async () => {

			const itemToSave = { id: 1, unique: 'Not Equal', value: 'save_test_data' };

			// Insert
			let result = await mongodb.save(model, itemToSave);
			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result), true);

			const itemSaved = await mongodb.get(model, { filters: { value: itemToSave.value } });
			assert.deepStrictEqual(itemSaved[0].value, itemToSave.value);
			assert.deepStrictEqual(itemSaved[0].unique, itemToSave.unique);

			const itemToUpdate = { unique: itemToSave.unique, value: 'save_test_data_updated' };

			// Update
			result = await mongodb.save(model, itemToUpdate);
			assert.deepStrictEqual(result, itemToUpdate.unique);

			const itemUpdated = await mongodb.get(model, { filters: { value: itemToUpdate.value } });
			assert.deepStrictEqual(itemUpdated[0].value, itemToUpdate.value);
			assert.deepStrictEqual(itemUpdated[0].unique, itemToUpdate.unique);

			// Should be the same
			assert.deepStrictEqual(itemUpdated[0].unique, itemSaved[0].unique);
			assert.deepStrictEqual(itemUpdated[0].id, itemSaved[0].id);

			await clearMockedDatabase();

		});

		it('should insert an item and auto fix \'_id\' unexpected fields when save an item', async () => {

			const result = await mongodb.save(model, { id: undefined, value: 'save_test_data' });

			assert.deepStrictEqual(MongoDriver.ObjectID.isValid(result), true);
			await clearMockedDatabase();
		});

		it('should throw when mongodb rejects the operation', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'updateOne').rejects(new Error('Internal mongodb error'));

			await assert.rejects(mongodb.save(model, { id: 1, value: 'save_test_data' }), {
				name: 'MongoDBError',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});
		});

		it('should reject when try to save with an invalid model', async () => {
			await assert.rejects(mongodb.save(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});
	});

	describe('update()', () => {

		it('should return modified count when updates an item', async () => {

			await mongodb.insert(model, { value: 'update_test_data' });

			const result = await mongodb.update(model, { value: 'update_test_data_updated' }, { value: 'update_test_data' });

			assert.deepStrictEqual(result, 1);

			const item = await mongodb.get(model, { value: 'update_test_data_updated' });

			assert.deepStrictEqual(item[0].value, 'update_test_data_updated');

			await clearMockedDatabase();
		});

		it('should reject when try to updated with an invalid model', async () => {
			await assert.rejects(mongodb.update(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('should throw when mongodb rejects the operation', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'updateMany').rejects(new Error('Internal mongodb error'));

			await assert.rejects(mongodb.update(model, { value: 'update_test_data_updated' }, { value: 'update_test_data' }), {
				name: 'MongoDBError',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});
		});
	});

	describe('multiInsert()', () => {

		it('should return true when the multi insert operation was successful', async () => {

			let items = [
				{ id: 1, value: 'multiInsert_test_data' },
				{ id: 2, value: 'multiInsert_test_data' },
				{ id: 3, value: 'multiInsert_test_data' }
			];

			const result = await mongodb.multiInsert(model, items);

			assert.deepStrictEqual(result, true);

			items = await mongodb.get(model, { filters: { value: 'multiInsert_test_data' } });

			assert.deepStrictEqual(items.length, 3);

			await clearMockedDatabase();
		});

		it('should reject when try to multi insert an invalid items array ', async () => {

			await assert.rejects(mongodb.multiInsert(model, { id: 1, value: 'multiInsert_test_data' }), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_ITEM
			});
		});

		it('should reject when try to multi insert with an invalid model', async () => {
			await assert.rejects(mongodb.multiInsert(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('should throw when mongodb rejects the operation', async () => {

			await mongodb.createIndexes(model);

			const collection = await getCollection();

			sandbox.stub(collection, 'insertMany').rejects(new Error('Internal mongodb error'));

			await assert.rejects(mongodb.multiInsert(model, [
				{ id: 1, value: 'multiInsert_test_data' },
				{ id: 1, value: 'multiInsert_test_data' }
			]), {
				name: 'MongoDBError',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			await clearMockedDatabase();
		});
	});

	describe('multiSave()', () => {

		it('should call bulkWrite when multi saving items and must return true if the result was successful', async () => {

			const items = [
				{ id: 1, value: 'multiSave_test_data' },
				{ id: 2, value: 'multiSave_test_data' },
				{ id: undefined, value: 'multiSave_test_data' }
			];

			const collection = await getCollection();

			sandbox.stub(collection, 'bulkWrite').callsFake(updateItems => {
				const fakeResult = {
					result: {
						ok: false
					}
				};
				if(Array.isArray(updateItems) && typeof updateItems[0] === 'object')
					fakeResult.result.ok = true;

				return fakeResult;
			});

			const result = await mongodb.multiSave(model, items);

			assert.deepStrictEqual(result, true);
		});

		it('should return false when try to multi save without items', async () => {

			const result = await mongodb.multiSave(model, []);

			assert.deepStrictEqual(result, false);
		});

		it('should throw when any of the save stacks rejects', async () => {

			const items = Array(30).fill()
				.map((item, i) => {
					return {
						id: i,
						value: 'sarasa' + i
					};
				});

			const collection = await getCollection();

			const stub = sandbox.stub(collection, 'bulkWrite');

			stub.onCall(0).resolves();
			stub.onCall(1).rejects();
			stub.onCall(2).resolves();

			await assert.rejects(mongodb.multiSave(model, items, 10), {
				name: 'MongoDBError',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});
		});

		it('should reject when try to multi insert an invalid items array ', async () => {

			await assert.rejects(mongodb.multiSave(model, { id: 1, value: 'multiSave_test_data' }), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_ITEM
			});
		});

		it('should reject when try to multi save with an invalid model', async () => {
			await assert.rejects(mongodb.multiSave(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});
	});

	describe('remove()', () => {

		it('should return true when successfully removes the item', async () => {

			await mongodb.insert(model, { value: 'test_remove_item' });

			const item = await mongodb.get(model, { filters: { value: 'test_remove_item' } });

			const result = await mongodb.remove(model, { id: item[0].id });

			assert.deepStrictEqual(result, true);
		});

		it('should return false when can\'t remove the item', async () => {

			const result = await mongodb.remove(model, { id: 1 });

			assert.deepStrictEqual(result, false);
		});

		it('should reject when try to remove an item with an invalid model', async () => {
			await assert.rejects(mongodb.remove(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('should throw when mongodb rejects the operation', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'deleteOne').rejects(new Error('Internal mongodb error'));

			await assert.rejects(mongodb.remove(model, { id: 1 }), {
				name: 'MongoDBError',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});
		});
	});

	describe('remove()', () => {

		it('should return true when successfully removes the item', async () => {

			await mongodb.insert(model, { value: 'test_remove_item' });

			const item = await mongodb.get(model, { filters: { value: 'test_remove_item' } });

			const result = await mongodb.remove(model, { id: item[0].id });

			assert.deepEqual(result, true);
		});

		it('should return false when can\'t remove the item', async () => {

			const result = await mongodb.remove(model, { id: 1 });

			assert.deepEqual(result, false);
		});

		it('should reject when try to remove an item with an invalid model', async () => {
			await assert.rejects(mongodb.remove(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('should throw when mongodb rejects the operation', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'deleteOne').rejects(new Error('Internal mongodb error'));

			await assert.rejects(mongodb.remove(model, { id: 1 }), {
				name: 'MongoDBError',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});
		});
	});

	describe('multiRemove()', () => {

		it('should return deleted count from mongodb when multi remove items', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'deleteMany').callsFake(async filter => { // Not implemented in mongo-mock
				if(filter) {
					const result = await mongodb.get(model, { filters: filter });
					return { deletedCount: result.length };
				}
				return { deletedCount: 0 };
			});

			await mongodb.multiInsert(model, [{ store: 'deleteThis' }, { store: 'deleteThis2' }]);

			const result = await mongodb.multiRemove(model, { store: { value: ['deleteThis', 'deleteThis2'], type: 'in' } });

			assert.deepStrictEqual(result, 2);

			await clearMockedDatabase();
		});

		it('should reject when try to multi remove items with an invalid model', async () => {
			await assert.rejects(mongodb.multiRemove(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('should reject when mongodb rejects the operation', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'deleteMany').rejects(new Error('Internal mongodb error'));

			await assert.rejects(mongodb.multiRemove(model, { value: 'sarasa' }), {
				name: 'MongoDBError',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});
		});
	});

	describe('getTotals()', () => {

		afterEach(() => {
			model.lastQueryEmpty = false;
			model.totalsParams = undefined; // Cubre una linea que necesita que totalsParams no este definida
		});

		it('should return the totals object when get the totals without last empty query in the model', async () => {

			const inserts = Array(10).fill()
				.map((item, i) => {
					return {
						id: i,
						field: `get_totals_test ${i}`
					};
				});

			await mongodb.multiInsert(model, inserts);

			await mongodb.get(model, { limit: 5, page: 1, filters: { field: { value: /get_totals_test/, type: 'reg' } } });

			assert.deepStrictEqual(await mongodb.getTotals(model), {
				total: 10,
				pageSize: 5,
				pages: 2,
				page: 1
			});

			await clearMockedDatabase();
		});

		it('should return the totals object with the last avaliable page when the model params look for more than available pages', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'countDocuments').callsFake(() => {
				return 100;
			});

			model.totalsParams = {
				limit: 10,
				page: 100
			};

			assert.deepStrictEqual(await mongodb.getTotals(model), {
				total: 100,
				pageSize: 10,
				pages: 10,
				page: 10
			});
		});

		it('should return the defualt totals object when get the totals without totals params in the model', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'countDocuments').callsFake(() => {
				return 100;
			});

			assert.deepStrictEqual(await mongodb.getTotals(model), {
				total: 100,
				pageSize: 500,
				pages: 1,
				page: 1
			});
		});

		it('should return zero totals when get the totals with a last empty query in the model', async () => {
			model.lastQueryEmpty = true;
			assert.deepStrictEqual(await mongodb.getTotals(model), {
				total: 0,
				pages: 0
			});
		});

		it('should throw when try to get totals without a valid model', async () => {
			await assert.rejects(mongodb.getTotals(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('should throw when mongodb rejects the operation', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'countDocuments').rejects(new Error('Internal mongodb error'));

			await assert.rejects(mongodb.getTotals(model), {
				name: 'MongoDBError',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});
		});
	});

	describe('parseSortingParams()', () => {

		it('should convert \'asc\' into 1 and \'desc\' into -1 and delete invalid elements', () => {

			const order = {
				field1: 'asc',
				field2: 'desc',
				field3: 123,
				field4: 'sarasa'
			};

			mongodb.parseSortingParams(order);

			assert.deepStrictEqual(order, {
				field1: 1,
				field2: -1
			});
		});

		['string', ['some', 'array'], null].forEach(order => {

			it('should do nothing when the params are invalid', () => {
				mongodb.parseSortingParams(order);
				assert.deepStrictEqual(order, order);
			});
		});
	});

	describe('cleanFields()', () => {

		it('should remove dateModified and dateCreated from the specified field', () => {

			const fields = {
				value: 'sarasa',
				dateModified: 'something',
				dateCreated: 'something'
			};

			mongodb.cleanFields(fields);

			assert.deepStrictEqual(fields, {
				value: 'sarasa'
			});
		});
	});
});
