'use strict';

const assert = require('node:assert').strict;

const { ObjectId } = require('../../lib/mongodb');

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, findRaw } = require('./_helpers');

describe('deleteAllDocuments()', () => {

	const seed = async () => {

		const model = new TestModel();

		await getMongodbInstance().multiInsert(model, [
			{ name: 'Test 1', group: 'a' },
			{ name: 'Test 2', group: 'a' },
			{ name: 'Other', group: 'b' }
		]);

		return model;
	};

	beforeEach(async () => {
		await getMongodbInstance().createIndexes(new TestModel(), TestModel.indexes);
	});

	afterEach(async () => {
		await cleanCollection();
	});

	it('Should remove every document when no filter is received and return the deleted count', async () => {

		const model = await seed();

		const result = await getMongodbInstance().deleteAllDocuments(TestModel.table);

		assert.equal(result, 3);
		assert.deepEqual(await findRaw(model), []);
	});

	it('Should keep the collection indexes', async () => {

		const model = await seed();

		await getMongodbInstance().deleteAllDocuments(TestModel.table);

		const indexes = await getMongodbInstance().getIndexes(model);

		assert.ok(indexes.some(({ name }) => name === 'name'));
	});

	it('Should return 0 on an empty collection', async () => {

		await seed();
		await getMongodbInstance().deleteAllDocuments(TestModel.table);

		assert.equal(await getMongodbInstance().deleteAllDocuments(TestModel.table), 0);
	});

	it('Should apply a raw mongodb filter', async () => {

		const model = await seed();

		const result = await getMongodbInstance().deleteAllDocuments(TestModel.table, { group: 'a' });

		assert.equal(result, 2);
		assert.deepEqual((await findRaw(model)).map(({ name }) => name), ['Other']);
	});

	it('Should not map the id filter to _id nor cast it to ObjectId', async () => {

		const model = await seed();
		const [{ _id }] = await findRaw(model, { name: 'Test 1' });

		// Current behavior: the filter is raw (no model filters parsing), `id` is a regular field name that no document has
		const result = await getMongodbInstance().deleteAllDocuments(TestModel.table, { id: _id.toString() });

		assert.equal(result, 0);
		assert.equal((await findRaw(model)).length, 3);
	});

	it('Should not cast a string _id filter to ObjectId', async () => {

		const model = await seed();
		const [{ _id }] = await findRaw(model, { name: 'Test 1' });

		// Current behavior: no ObjectId conversion, the string never matches the ObjectId _id
		assert.equal(await getMongodbInstance().deleteAllDocuments(TestModel.table, { _id: _id.toString() }), 0);

		// An explicit ObjectId does match
		assert.equal(await getMongodbInstance().deleteAllDocuments(TestModel.table, { _id: new ObjectId(_id) }), 1);
		assert.equal((await findRaw(model)).length, 2);
	});

});
