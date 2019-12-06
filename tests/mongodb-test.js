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

const objectID = ObjectID();

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
		it('Should reject when MongoClient can\'t connect', async () => {

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

		it('Should use default values when the config is incomplete', () => {

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

		it('Should call MongoClient connect when checks the connection (without user and password)', async () => {

			const spy = sandbox.spy(MongoClient, 'connect');

			await assert.doesNotReject(mongodb.checkConnection());

			sandbox.assert.calledOnce(spy);

		});

		it('Should call MongoClient connect when checks the connection (using user and password)', async () => {

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

		it('Should cache connection and call connect method just once when calls again for the value cached returns undefined', async () => {

			const newMongo = new MongoDB({
				host: 'localhost',
				user: 'root',
				password: '1234',
				database: 'myDB'
			});

			await assert.doesNotReject(newMongo.checkConnection());
			assert.deepStrictEqual(await newMongo.checkConnection(), undefined);
		});

		it('Should cache connection don\'t connect to DB cause exists', async () => {

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

		it('Should return a formatted index object when recieves an array as parameter', async () => {
			assert.deepStrictEqual(mongodb.formatIndex(['foo', 'bar']), { foo: 1, bar: 1 });
		});

		it('Should return formatted index object when recieves a string as parameter', () => {
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

		it('Should not reject when create indexes without unique indexes in the model', async () => {

			const createIndex = await createIndexesStub();

			sandbox.stub(model.constructor, 'uniqueIndexes').get(() => {
				return null;
			});

			await assert.doesNotReject(mongodb.createIndexes(model));
			assert.deepStrictEqual(createIndex.called, true);
		});

		it('Should not reject when create indexes without indexes in the model', async () => {

			const createIndex = await createIndexesStub();

			sandbox.stub(model.constructor, 'indexes').get(() => {
				return null;
			});

			await assert.doesNotReject(mongodb.createIndexes(model));
			assert.deepStrictEqual(createIndex.called, true);
		});

		it('Should not reject when create indexes with indexes and unique indexes in the model', async () => {

			const createIndex = await createIndexesStub();

			await assert.doesNotReject(mongodb.createIndexes(model));

			assert.deepStrictEqual(createIndex.called, true);
		});

		it('Should reject when try to create indexes with an invalid model', async () => {
			await assert.rejects(mongodb.createIndexes(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw when mongodb rejects the operation', async () => {

			const createIndex = await createIndexesStub();

			createIndex.rejects(new Error('Internal mongodb error'));

			await assert.rejects(mongodb.createIndexes(model), {
				name: 'MongoDBError',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});
		});
	});

	describe('prepareFields()', () => {

		it('Should replace the \'id\' field with \'_id\' when \'id\' exists', () => {

			const fields = {
				id: objectID.toString()
			};

			mongodb.prepareFields(fields);

			assert.deepStrictEqual(typeof fields.id, 'undefined');

			assert.deepStrictEqual(fields._id, objectID);
		});

		it('Should replace the \'id\' field with \'_id\' when \'id\' exists and is an array', () => {

			const fields = {
				id: [objectID.toString()]
			};

			mongodb.prepareFields(fields);

			assert.deepStrictEqual(typeof fields.id, 'undefined');

			assert.deepStrictEqual(fields._id, [objectID]);
		});

		it('Should replace the \'id\' field with \'_id\' when \'id\' exists and is an $eq filter', () => {

			const fields = {
				id: {
					$eq: objectID.toString()
				}
			};

			mongodb.prepareFields(fields);

			assert.deepStrictEqual(typeof fields.id, 'undefined');

			assert.deepStrictEqual(fields._id, { $eq: objectID });
		});

		it('Should replace the \'id\' field with \'_id\' when \'id\' exists and is a $in filter', () => {

			const fields = {
				id: {
					$in: [objectID.toString()]
				}
			};

			mongodb.prepareFields(fields);

			assert.deepStrictEqual(typeof fields.id, 'undefined');

			assert.deepStrictEqual(fields._id, { $in: [objectID] });
		});

		it('Should replace the \'id\' field with \'_id\' when \'id\' exists and is an ObjectID', () => {

			const fields = {
				id: objectID
			};

			mongodb.prepareFields(fields);

			assert.deepStrictEqual(typeof fields.id, 'undefined');

			assert.deepStrictEqual(fields._id, objectID);
		});

		it('Should replace the \'id\' field with \'_id\' when \'id\' exists for filters', () => {

			const fields = {
				id: objectID.toString()
			};

			mongodb.prepareFields(fields, true);

			assert.deepStrictEqual(typeof fields.id, 'undefined');

			assert.deepStrictEqual(fields._id, objectID);
		});

		it('Should replace the \'id\' field with \'_id\' when \'id\' exists and is an array for filters', () => {

			const fields = {
				id: [objectID.toString()]
			};

			mongodb.prepareFields(fields, true);

			assert.deepStrictEqual(typeof fields.id, 'undefined');

			assert.deepStrictEqual(fields._id, { $in: [objectID] });
		});

		it('Should do nothing when the \'_id\' exists and \'id\' not exists', () => {

			const fields = {
				_id: objectID
			};

			mongodb.prepareFields(fields);

			assert.deepStrictEqual(typeof fields.id, 'undefined');

			assert.deepStrictEqual(fields._id, objectID);
		});

	});

	describe('prepareFieldsForOutput()', () => {

		it('Should replace the \'_id\' field with \'id\' when \'_id\' exists', () => {

			const fields = {
				_id: objectID
			};

			mongodb.prepareFieldsForOutput(fields);

			assert.deepStrictEqual(typeof fields._id, 'undefined');

			assert.deepStrictEqual(fields.id, objectID);
		});
	});

	describe('getFilter()', () => {

		it('Should return non empty filter object when get filters with an array as parameter', () => {

			sandbox.stub(model.constructor, 'uniqueIndexes').get(() => {
				return [['id']];
			});

			const result = mongodb.getFilter(model, { id: objectID });

			assert.deepStrictEqual(result.id, objectID);
		});

		it('Should return non empty filter object when get filters with an object as parameter', () => {

			const result = mongodb.getFilter(model, { id: objectID });

			assert.deepStrictEqual(result.id, objectID);
		});

		it('Should throw when get filters with a model without unique indexes', () => {

			assert.throws(() => {
				mongodb.getFilter({});
			}, {
				name: 'MongoDBError',
				code: MongoDBError.codes.MODEL_EMPTY_UNIQUE_INDEXES
			});
		});

		it('Should throw when try to get filters and the model unique indexes not matches with any of the filters', () => {

			assert.throws(() => {
				mongodb.getFilter(model);
			}, {
				name: 'MongoDBError',
				code: MongoDBError.codes.EMPTY_UNIQUE_INDEXES
			});

		});

		it('Should throw when get filters with an invalid model', () => {
			assert.throws(() => {
				mongodb.getFilter();
			}, {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});
	});

	describe('insert()', () => {

		it('Should return true when the data was successfully inserted into mongodb', async () => {

			const result = await mongodb.insert(model, {	value: 'insert_test_data' });

			assert(MongoDriver.ObjectID.isValid(result));

			await clearMockedDatabase();
		});

		it('Should reject when try to insert with an invalid model', async () => {
			await assert.rejects(mongodb.insert(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw when mongodb rejects the operation', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'insertOne').rejects(new Error('Internal mongodb error'));

			await assert.rejects(mongodb.insert(model, { value: 'insert_test_data' }));
		});
	});

	describe('distinct()', () => {

		it('Should throw if distinct model is not passed', async () => {
			await assert.rejects(mongodb.distinct(null), {
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw if distinct key is not passed', async () => {
			await assert.rejects(mongodb.distinct(model, {}), {
				code: MongoDBError.codes.INVALID_DISTINCT_KEY
			});
		});

		it('Should throw if distinct key is not a string', async () => {
			await assert.rejects(mongodb.distinct(model, { key: ['invalidKey'] }), {
				code: MongoDBError.codes.INVALID_DISTINCT_KEY
			});
		});

		it('Should return data object when get the data from db', async () => {

			// Distinct is not implemented in mongo-mock so far. So it needs to be defined here.

			const mongoDbResponse = [
				'Value 1',
				'Value 2',
				'Value 3'
			];

			await mongodb.checkConnection();
			const collection = mongodb.db.collection(model.constructor.table);

			collection.distinct = () => Promise.resolve([...mongoDbResponse]);

			sandbox.spy(collection, 'distinct');

			const result = await mongodb.distinct(model, { key: 'myKey' });

			assert.deepStrictEqual(result, [...mongoDbResponse]);
			sandbox.assert.calledOnce(collection.distinct);
			sandbox.assert.calledWithExactly(collection.distinct, 'myKey', {});
		});

		it('Should throw if distinct fails', async () => {

			// Distinct is not implemented in mongo-mock so far. So it needs to be defined here.

			await mongodb.checkConnection();
			const collection = mongodb.db.collection(model.constructor.table);

			collection.distinct = () => Promise.reject(new Error('Some internal error'));

			await assert.rejects(mongodb.distinct(model, { key: 'myKey' }), {
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});
		});
	});

	describe('get()', () => {

		it('Should return data object when get the data from db', async () => {

			await mongodb.insert(model, { value: 'get_test_data' });

			const result = await mongodb.get(model, { order: { id: 'asc' } });

			assert.deepStrictEqual(result[0].value, 'get_test_data');

			await clearMockedDatabase();
		});

		it('Should reject when try to get data with an invalid model', async () => {
			await assert.rejects(mongodb.get(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw when mongodb rejects the operation', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'find').throws(new Error('Internal mongodb error'));

			await assert.rejects(mongodb.get(model), {
				name: 'MongoDBError',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});
		});
	});

	describe('save()', () => {

		it('Should reject when try to save with an invalid model', async () => {
			await assert.rejects(mongodb.save(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw when mongodb rejects the operation', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'findAndModify').rejects(new Error('Internal mongodb error'));

			await assert.rejects(mongodb.save(model, { id: objectID, value: 'save_test_data' }), {
				name: 'MongoDBError',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			sandbox.assert.calledOnce(collection.findAndModify);
		});

		it('Should return upserted id', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'findAndModify').returns({
				value: {
					_id: ObjectID('5de85c6f3929ca50ea230d1b'),
					value: 'some-value',
					unique: 'some-unique'
				}
			});

			sandbox.useFakeTimers(new Date(2019, 11, 1).getTime());

			assert.strictEqual(await mongodb.save(model, { unique: 'some-unique', value: 'some-value' }), '5de85c6f3929ca50ea230d1b');

			sandbox.assert.calledOnce(collection.findAndModify);
			sandbox.assert.calledWithExactly(collection.findAndModify,
				{ unique: 'some-unique' },
				{},
				{ $set: { unique: 'some-unique', value: 'some-value' }, $currentDate: { dateModified: true }, $setOnInsert: { dateCreated: new Date() } },
				{ upsert: true, new: true }
			);
		});

		it('Should return upserted id and not use _id', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'findAndModify').returns({
				value: {
					_id: ObjectID('5de85c6f3929ca50ea230d1b'),
					value: 'some-value',
					unique: 'some-unique'
				}
			});

			sandbox.useFakeTimers(new Date(2019, 11, 1).getTime());

			assert.strictEqual(await mongodb.save(model,
				{
					_id: '5de85c6f3929ca50ea230d1b',
					unique: 'some-unique',
					value: 'some-value'
				}), '5de85c6f3929ca50ea230d1b');

			sandbox.assert.calledOnce(collection.findAndModify);
			sandbox.assert.calledWithExactly(collection.findAndModify,
				{ unique: 'some-unique' },
				{},
				{ $set: { unique: 'some-unique', value: 'some-value' }, $currentDate: { dateModified: true }, $setOnInsert: { dateCreated: new Date() } },
				{ upsert: true, new: true }
			);
		});

		it('Should return null if cannot insert or update', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'findAndModify').returns(null);

			assert.strictEqual(await mongodb.save(model, { unique: 'some-unique', value: 'some-value' }), null);

			sandbox.assert.calledOnce(collection.findAndModify);
		});
	});

	describe('update()', () => {

		it('Should return modified count when updates an item', async () => {

			await mongodb.insert(model, { value: 'update_test_data' });

			const result = await mongodb.update(model, { value: 'update_test_data_updated' }, { value: 'update_test_data' });

			assert.deepStrictEqual(result, 1);

			const item = await mongodb.get(model, { value: 'update_test_data_updated' });

			assert.deepStrictEqual(item[0].value, 'update_test_data_updated');

			await clearMockedDatabase();
		});

		it('Should reject when try to updated with an invalid model', async () => {
			await assert.rejects(mongodb.update(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw when mongodb rejects the operation', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'updateMany').rejects(new Error('Internal mongodb error'));

			await assert.rejects(mongodb.update(model, { value: 'update_test_data_updated' }, { value: 'update_test_data' }), {
				name: 'MongoDBError',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});
		});
	});

	describe('multiInsert()', () => {

		it('Should return true when the multi insert operation was successful', async () => {

			let items = [
				{ id: ObjectID(), value: 'multiInsert_test_data' },
				{ id: ObjectID(), value: 'multiInsert_test_data' },
				{ id: ObjectID(), value: 'multiInsert_test_data' }
			];

			const result = await mongodb.multiInsert(model, items);

			assert.deepStrictEqual(result, true);

			items = await mongodb.get(model, { filters: { value: 'multiInsert_test_data' } });

			assert.deepStrictEqual(items.length, 3);

			await clearMockedDatabase();
		});

		it('Should reject when try to multi insert an invalid items array ', async () => {

			await assert.rejects(mongodb.multiInsert(model, { id: objectID, value: 'multiInsert_test_data' }), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_ITEM
			});
		});

		it('Should reject when try to multi insert with an invalid model', async () => {
			await assert.rejects(mongodb.multiInsert(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw when mongodb rejects the operation', async () => {

			await mongodb.createIndexes(model);

			const collection = await getCollection();

			sandbox.stub(collection, 'insertMany').rejects(new Error('Internal mongodb error'));

			await assert.rejects(mongodb.multiInsert(model, [
				{ id: ObjectID(), value: 'multiInsert_test_data' },
				{ id: ObjectID(), value: 'multiInsert_test_data' }
			]), {
				name: 'MongoDBError',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});

			await clearMockedDatabase();
		});
	});

	describe('multiSave()', () => {

		it('Should call bulkWrite when multi saving items and must return true if the result was successful', async () => {

			const items = [
				{ id: ObjectID(), value: 'multiSave_test_data' },
				{ id: ObjectID(), value: 'multiSave_test_data' },
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

		it('Should return false when try to multi save without items', async () => {

			const result = await mongodb.multiSave(model, []);

			assert.deepStrictEqual(result, false);
		});

		it('Should throw when any of the save stacks rejects', async () => {

			const items = Array(30).fill()
				.map((item, i) => {
					return {
						id: ObjectID(),
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

		it('Should reject when try to multi insert an invalid items array ', async () => {

			await assert.rejects(mongodb.multiSave(model, { id: objectID, value: 'multiSave_test_data' }), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_ITEM
			});
		});

		it('Should reject when try to multi save with an invalid model', async () => {
			await assert.rejects(mongodb.multiSave(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});
	});

	describe('remove()', () => {

		it('Should return true when successfully removes the item', async () => {

			await mongodb.insert(model, { value: 'test_remove_item' });

			const item = await mongodb.get(model, { filters: { value: 'test_remove_item' } });

			const result = await mongodb.remove(model, { id: item[0].id });

			assert.deepStrictEqual(result, true);
		});

		it('Should return false when can\'t remove the item', async () => {

			const result = await mongodb.remove(model, { id: objectID });

			assert.deepStrictEqual(result, false);
		});

		it('Should reject when try to remove an item with an invalid model', async () => {
			await assert.rejects(mongodb.remove(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw when mongodb rejects the operation', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'deleteOne').rejects(new Error('Internal mongodb error'));

			await assert.rejects(mongodb.remove(model, { id: objectID }), {
				name: 'MongoDBError',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});
		});
	});

	describe('remove()', () => {

		it('Should return true when successfully removes the item', async () => {

			await mongodb.insert(model, { value: 'test_remove_item' });

			const item = await mongodb.get(model, { filters: { value: 'test_remove_item' } });

			const result = await mongodb.remove(model, { id: item[0].id });

			assert.deepEqual(result, true);
		});

		it('Should return false when can\'t remove the item', async () => {

			const result = await mongodb.remove(model, { id: objectID });

			assert.deepEqual(result, false);
		});

		it('Should reject when try to remove an item with an invalid model', async () => {
			await assert.rejects(mongodb.remove(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw when mongodb rejects the operation', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'deleteOne').rejects(new Error('Internal mongodb error'));

			await assert.rejects(mongodb.remove(model, { id: objectID }), {
				name: 'MongoDBError',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});
		});
	});

	describe('multiRemove()', () => {

		it('Should return deleted count from mongodb when multi remove items', async () => {

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

		it('Should reject when try to multi remove items with an invalid model', async () => {
			await assert.rejects(mongodb.multiRemove(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should reject when mongodb rejects the operation', async () => {

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

		it('Should return the totals object when get the totals without last empty query in the model', async () => {

			const inserts = Array(10).fill()
				.map((item, i) => {
					return {
						id: ObjectID(),
						field: `get_totals_test ${i}`
					};
				});

			await mongodb.multiInsert(model, inserts);

			await mongodb.get(model, { limit: 5, page: 1, filters: { field: { value: /get_totals_test/, type: 'search' } } });

			assert.deepStrictEqual(await mongodb.getTotals(model), {
				total: 10,
				pageSize: 5,
				pages: 2,
				page: 1
			});

			await clearMockedDatabase();
		});

		it('Should return the totals object with the last avaliable page when the model params look for more than available pages', async () => {

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

		it('Should return the defualt totals object when get the totals without totals params in the model', async () => {

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

		it('Should return zero totals when get the totals with a last empty query in the model', async () => {
			model.lastQueryEmpty = true;
			assert.deepStrictEqual(await mongodb.getTotals(model), {
				total: 0,
				pages: 0
			});
		});

		it('Should throw when try to get totals without a valid model', async () => {
			await assert.rejects(mongodb.getTotals(), {
				name: 'MongoDBError',
				code: MongoDBError.codes.INVALID_MODEL
			});
		});

		it('Should throw when mongodb rejects the operation', async () => {

			const collection = await getCollection();

			sandbox.stub(collection, 'countDocuments').rejects(new Error('Internal mongodb error'));

			await assert.rejects(mongodb.getTotals(model), {
				name: 'MongoDBError',
				code: MongoDBError.codes.MONGODB_INTERNAL_ERROR
			});
		});
	});

	describe('parseSortingParams()', () => {

		it('Should convert \'asc\' into 1 and \'desc\' into -1 and delete invalid elements', () => {

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

			it('Should do nothing when the params are invalid', () => {
				mongodb.parseSortingParams(order);
				assert.deepStrictEqual(order, order);
			});
		});
	});

	describe('cleanFields()', () => {

		it('Should remove dateModified and dateCreated from the specified field', () => {

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
