'use strict';

const assert = require('assert');
const sinon = require('sinon');
const mock = require('mock-require');

mock('mongodb', 'mongo-mock');

const { MongoClient } = require('mongodb');

const MongoDB = require('./../index');

const { MongoDBError } = require('./../mongodb');

/* eslint-disable prefer-arrow-callback */

const sandbox = sinon.createSandbox();

class Model {

	get dbname() {
		return 'myDB';
	}

	static get uniqueIndexes() {
		return [
			'_id'
		];
	}

	static get indexes() {
		return [
			'value'
		];
	}

	getTable() {
		return 'table';
	}
}

const mongodb = new MongoDB({
	host: 'mongodb://localhost:3306/fizzmod',
	user: 'root',
	db: 'myDB'
});

const model = new Model();

describe('MongoDB', function() {

	afterEach(() => {
		sandbox.restore();
	});

	after(() => {
		mock.stopAll();
	});

	describe('handled errors', function() {

		describe('getFilter()', function() {

			it('should throw "model requires indexes"', function() {

				assert.throws(() => {
					mongodb.getFilter({});
				}, {
					name: 'MongoDBError',
					code: MongoDBError.codes.MODEL_EMPTY_INDEXES
				});
			});

			it('should throw "operation requires indexes"', function() {

				assert.throws(() => {
					mongodb.getFilter(model);
				}, {
					name: 'MongoDBError',
					code: MongoDBError.codes.EMPTY_INDEXES
				});

			});
		});
	});

	describe('checkConnection()', function() {

		it('should call MongoClient connect', async function() {

			const spy = sandbox.spy(MongoClient, 'connect');

			try {
				await mongodb.checkConnection();
			} catch(err) {
				// nothing...
			}

			sandbox.assert.calledOnce(spy);
		});
	});

	describe('formatIndex()', function() {

		it('should return forrmated index object (array param)', function() {
			assert.deepEqual(typeof mongodb.formatIndex(['foo']), 'object');
		});

		it('should return formatted index object', function() {
			assert.deepEqual(typeof mongodb.formatIndex('foo'), 'object');
		});

	});

	describe('createIndexes()', function() {

		it('should not reject while creating indexes without uniqueIndexes', async function() {

			sandbox.stub(model.constructor, 'uniqueIndexes').get(() => {
				return undefined;
			});

			await assert.doesNotReject(mongodb.createIndexes(model));
		});

		it('should not reject while creating indexes without indexes', async function() {

			sandbox.stub(model.constructor, 'indexes').get(() => {
				return undefined;
			});

			await assert.doesNotReject(mongodb.createIndexes(model));
		});

		it('should not reject while creating indexes normally', async function() {
			await assert.doesNotReject(mongodb.createIndexes(model));
		});

	});

	describe('prepareFields()', function() {

		it('should call mongodb ObjectID then change the fields._id value', function() {

			const fields = {
				_id: 1,
				value: 'sarasa'
			};

			mongodb.prepareFields(fields);

			assert.notDeepEqual(fields._id, 1); // eslint-disable-line
		});
	});

	describe('getFilter()', function() {

		it('should return non empty filter object (with array index)', function() {

			sandbox.stub(model.constructor, 'indexes').get(() => {
				return [['value']];
			});

			const result = mongodb.getFilter(model, { value: 'sarasa' });

			assert.deepEqual(result.value, 'sarasa');
		});

		it('should return non empty filter object', function() {

			const result = mongodb.getFilter(model, { value: 'sarasa' });

			assert.deepEqual(result.value, 'sarasa');
		});

	});

	describe('insert()', function() {

		it('should return true (returned if the data was successfully inserted into db)', async function() {

			const result = await mongodb.insert(model, {	_id: 1, value: 'sarasa'	});

			assert.deepEqual(result, true);
		});

		it('should return false (returned if the insertion was failed)', async function() {

			const result = await mongodb.insert({ dbname: 'sarasa' });

			assert.deepEqual(result, false);
		});

	});

	describe('get()', function() {

		it('should return data object from db', async function() {

			await mongodb.insert(model, { _id: 1, value: 'sarasa' });

			const result = await mongodb.get(model, {});

			assert.deepEqual(result[0].value, 'sarasa');
		});

	});

	describe('save()', function() {

		it('should return true (if can find object to update in db)', async function() {

			const result = await mongodb.save(model, { value: 'sarasa' });

			assert.deepEqual(result, true);
		});

		it('should return false (if can\'t find object to update in db)', async function() {

			await mongodb.checkConnection();

			const collection = mongodb.client.db(model.dbname).collection(model.getTable());

			sandbox.stub(collection, 'updateOne').returns({
				matchedCount: 2
			});

			const result = await mongodb.save(model, { value: 'sarasa' });

			assert.deepEqual(result, false);
		});

	});

	describe('update()', function() {

		it('should return 1 (modified count from mongodb)', async function() {

			await mongodb.insert(model, { _id: 1, value: 'foobar' });

			const result = await mongodb.update(model, { value: 'sarasa' }, { value: 'foobar' });

			assert.deepEqual(result, 1);
		});

	});

	describe('multiInsert()', function() {

		it('should return true if the operation was successful', async function() {

			const items = [
				{
					_id: 3,
					value: 'sarasa1'
				},
				{
					_id: 4,
					value: 'sarasa2'
				},
				{
					_id: 5,
					value: 'sarasa3'
				}
			];

			const result = await mongodb.multiInsert(model, items);

			assert.deepEqual(result, true);
		});

	});

	describe('multiSave', function() {

		const items = [
			{	value: 'sarasa1' },
			{	value: 'sarasa2' },
			{	value: 'sarasa3' }
		];

		it('should call mongodb bulkWrite then return true', async function() {

			await mongodb.checkConnection();

			const collection = mongodb.client.db(model.dbname).collection(model.getTable());

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

			assert.deepEqual(result, true);
		});

		it('should return false (updateItems.length is 0)', async function() {

			const result = await mongodb.multiSave(model, []);

			assert.deepEqual(result, false);
		});

	});

});
