'use strict';

const assert = require('node:assert').strict;

const { ObjectId } = require('../../lib/mongodb');
const MongoDBError = require('../../lib/mongodb-error');

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, assertDriverError } = require('./_helpers');

describe('get()', () => {

	const seed = async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.multiInsert(model, [
			{ name: 'Charlie', age: 30, extra: 'c' },
			{ name: 'Alice', age: 10, extra: 'a' },
			{ name: 'Bob', age: 20, extra: 'b' },
			{ name: 'Dave', age: 40, extra: 'd' }
		]);

		return model;
	};

	const names = docs => docs.map(({ name }) => name);

	afterEach(async () => {
		await cleanCollection();
	});

	it('Should return an empty array if the collection is empty', async () => {

		const result = await getMongodbInstance().get(new TestModel(), {});

		assert.deepEqual(result, []);
	});

	it('Should return every document mapping _id to a string id when called without params', async () => {

		const model = await seed();

		const result = await getMongodbInstance().get(model);

		assert.equal(result.length, 4);

		result.forEach(document => {
			assert.equal(typeof document.id, 'string');
			assert.equal(ObjectId.isValid(document.id), true);
			assert.equal('_id' in document, false);
		});
	});

	it('Should sort ascending and descending', async () => {

		const model = await seed();

		const asc = await getMongodbInstance().get(model, { order: { age: 'asc' } });
		const desc = await getMongodbInstance().get(model, { order: { age: 'desc' } });

		assert.deepEqual(names(asc), ['Alice', 'Bob', 'Charlie', 'Dave']);
		assert.deepEqual(names(desc), ['Dave', 'Charlie', 'Bob', 'Alice']);
	});

	it('Should sort by id as _id', async () => {

		const model = await seed();

		const asc = await getMongodbInstance().get(model, { order: { id: 'asc' } });
		const desc = await getMongodbInstance().get(model, { order: { id: 'desc' } });

		// Insertion order (ObjectId is monotonic within the same process)
		assert.deepEqual(names(asc), ['Charlie', 'Alice', 'Bob', 'Dave']);
		assert.deepEqual(names(desc), ['Dave', 'Bob', 'Alice', 'Charlie']);
	});

	it('Should sort by several fields', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.multiInsert(model, [
			{ name: 'A', group: 1, age: 1 },
			{ name: 'B', group: 2, age: 1 },
			{ name: 'C', group: 1, age: 2 }
		]);

		const result = await mongodb.get(model, { order: { group: 'asc', age: 'desc' } });

		assert.deepEqual(names(result), ['C', 'A', 'B']);
	});

	it('Should ignore invalid order values and return natural order', async () => {

		const model = await seed();

		const result = await getMongodbInstance().get(model, { order: { age: 'invalid' } });

		assert.deepEqual(names(result), ['Charlie', 'Alice', 'Bob', 'Dave']);
	});

	it('Should apply limit and page', async () => {

		const model = await seed();
		const mongodb = getMongodbInstance();

		const params = { order: { age: 'asc' }, limit: 3 };

		const firstPage = await mongodb.get(model, params);
		const secondPage = await mongodb.get(model, { ...params, page: 2 });
		const thirdPage = await mongodb.get(model, { ...params, page: 3 });

		assert.deepEqual(names(firstPage), ['Alice', 'Bob', 'Charlie']);
		assert.deepEqual(names(secondPage), ['Dave']);
		assert.deepEqual(thirdPage, []);
	});

	it('Should return only the requested fields (and the id) with fields', async () => {

		const model = await seed();

		const result = await getMongodbInstance().get(model, { filters: { name: 'Alice' }, fields: ['name', 'age'] });

		assert.deepEqual(result, [{ id: result[0].id, name: 'Alice', age: 10 }]);
	});

	it('Should omit the given fields with excludeFields', async () => {

		const model = await seed();

		const result = await getMongodbInstance().get(model, { filters: { name: 'Alice' }, excludeFields: ['age', 'dateCreated'] });

		assert.deepEqual(result, [{ id: result[0].id, name: 'Alice', extra: 'a' }]);
	});

	it('Should use fields when both fields and excludeFields are received', async () => {

		const model = await seed();

		const result = await getMongodbInstance().get(model, { filters: { name: 'Alice' }, fields: ['name'], excludeFields: ['name'] });

		assert.deepEqual(result, [{ id: result[0].id, name: 'Alice' }]);
	});

	it('Should sort by a field that is not projected', async () => {

		const model = await seed();

		const result = await getMongodbInstance().get(model, { order: { age: 'desc' }, fields: ['name'] });

		assert.deepEqual(names(result), ['Dave', 'Charlie', 'Bob', 'Alice']);
	});

	it('Should filter by id', async () => {

		const model = await seed();
		const mongodb = getMongodbInstance();

		const [{ id }] = await mongodb.get(model, { filters: { name: 'Bob' } });

		const result = await mongodb.get(model, { filters: { id } });

		assert.deepEqual(names(result), ['Bob']);
		assert.equal(result[0].id, id);
	});

	it('Should return the raw driver cursor without limit, page nor id mapping with returnType cursor', async () => {

		const model = await seed();

		const cursor = await getMongodbInstance().get(model, { returnType: 'cursor', limit: 1, page: 2, order: { age: 'asc' } });

		assert.equal(typeof cursor.toArray, 'function');
		assert.equal(typeof cursor.next, 'function');

		const documents = await cursor.toArray();

		// limit and page are ignored for cursors
		assert.deepEqual(names(documents), ['Alice', 'Bob', 'Charlie', 'Dave']);

		// _id is not mapped for cursors
		documents.forEach(document => {
			assert.ok(document._id instanceof ObjectId);
			assert.equal('id' in document, false);
		});
	});

	it('Should not set totalsParams when returnType is cursor', async () => {

		const model = await seed();

		const cursor = await getMongodbInstance().get(model, { returnType: 'cursor' });
		await cursor.close();

		assert.equal(model.totalsParams, undefined);
	});

	it('Should set model.totalsParams with the query data', async () => {

		const model = await seed();

		await getMongodbInstance().get(model, { filters: { age: { type: 'greater', value: 10 } }, limit: 2, page: 2, order: { age: 'asc' } });

		assert.deepEqual(model.totalsParams, {
			length: 1,
			limit: 2,
			page: 2,
			filters: { age: { $gt: 10 } },
			order: { age: 1 }
		});
	});

	it('Should use an existing index with a valid hint', async () => {

		const model = await seed();
		const mongodb = getMongodbInstance();

		await mongodb.createIndex(model, { name: 'age_idx', key: { age: 1 } });

		const result = await mongodb.get(model, { hint: 'age_idx', order: { age: 'asc' } });

		assert.deepEqual(names(result), ['Alice', 'Bob', 'Charlie', 'Dave']);
		assert.equal(model.totalsParams.hint, 'age_idx');
	});

	it('Should reject with code 4 and the server code when the hint index does not exist', async () => {

		const model = await seed();

		// 2 = BadValue
		await assertDriverError(getMongodbInstance().get(model, { hint: 'non_existent_idx' }), 2);
	});

	it('Should accept readPreference', async () => {

		const model = await seed();

		const result = await getMongodbInstance().get(model, { readPreference: 'primary', filters: { name: 'Alice' } });

		assert.deepEqual(names(result), ['Alice']);
		assert.equal(model.totalsParams.readPreference, 'primary');
	});

	it('Should reject with code 4 when the readPreference is invalid', async () => {

		const model = await seed();

		let error;

		try {
			await getMongodbInstance().get(model, { readPreference: 'invalid' });
		} catch(err) {
			error = err;
		}

		assert.ok(error instanceof MongoDBError);
		assert.equal(error.code, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
	});

	it('Should reject with code 8 when the filter type is invalid', async () => {

		const model = await seed();

		let error;

		try {
			await getMongodbInstance().get(model, { filters: { name: { type: 'invalid', value: 'x' } } });
		} catch(err) {
			error = err;
		}

		assert.ok(error instanceof MongoDBError);
		assert.equal(error.code, MongoDBError.codes.INVALID_FILTER_TYPE);
	});

	it('Should reject with a raw BSONError (not a MongoDBError) when the id is not a valid ObjectId', async () => {

		const model = await seed();

		let error;

		try {
			await getMongodbInstance().get(model, { filters: { id: 'not-an-object-id' } });
		} catch(err) {
			error = err;
		}

		// Current behavior: the id is cast before the try/catch, so the driver BSONError is thrown as is (inconsistent with the other driver errors, that are MongoDBError with code 4)
		assert.ok(error);
		assert.equal(error instanceof MongoDBError, false);
		assert.equal(error.name, 'BSONError');
	});

});
