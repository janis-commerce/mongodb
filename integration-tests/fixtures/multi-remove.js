'use strict';

const assert = require('node:assert').strict;

const { ObjectId } = require('../../lib/mongodb');

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, findRaw } = require('./_helpers');

describe('multiRemove()', () => {

	const seed = async () => {

		const model = new TestModel();

		await getMongodbInstance().multiInsert(model, [
			{ name: 'Test 1', group: 'a' },
			{ name: 'Test 2', group: 'a' },
			{ name: 'Other', group: 'b' }
		]);

		return model;
	};

	const names = async model => (await findRaw(model)).map(({ name }) => name);

	beforeEach(async () => {
		await getMongodbInstance().createIndexes(new TestModel(), TestModel.indexes);
	});

	afterEach(async () => {
		await cleanCollection();
	});

	it('Should remove the matching documents (search filter) and return the deleted count', async () => {

		const model = await seed();

		const result = await getMongodbInstance().multiRemove(model, { name: { type: 'search', value: 'Test' } });

		assert.equal(result, 2);
		assert.deepEqual(await names(model), ['Other']);
	});

	it('Should remove by plain equality filter', async () => {

		const model = await seed();

		const result = await getMongodbInstance().multiRemove(model, { group: 'a' });

		assert.equal(result, 2);
		assert.deepEqual(await names(model), ['Other']);
	});

	it('Should return 0 and remove nothing when no document matches', async () => {

		const model = await seed();

		const result = await getMongodbInstance().multiRemove(model, { name: 'Nope' });

		assert.equal(result, 0);
		assert.equal((await names(model)).length, 3);
	});

	it('Should remove by id', async () => {

		const model = await seed();
		const [{ _id }] = await findRaw(model, { name: 'Test 1' });

		const result = await getMongodbInstance().multiRemove(model, { id: _id.toString() });

		assert.equal(result, 1);
		assert.deepEqual(await names(model), ['Test 2', 'Other']);
	});

	it('Should remove by an array of ids', async () => {

		const model = await seed();
		const stored = await findRaw(model, { group: 'a' });

		const result = await getMongodbInstance().multiRemove(model, { id: stored.map(({ _id }) => _id.toString()) });

		assert.equal(result, 2);
		assert.deepEqual(await names(model), ['Other']);
	});

	it('Should return 0 when the id does not exist', async () => {

		const model = await seed();

		const result = await getMongodbInstance().multiRemove(model, { id: new ObjectId().toString() });

		assert.equal(result, 0);
	});

	it('Should support an array of filters as OR', async () => {

		const model = await seed();

		const result = await getMongodbInstance().multiRemove(model, [{ name: 'Test 1' }, { name: 'Other' }]);

		assert.equal(result, 2);
		assert.deepEqual(await names(model), ['Test 2']);
	});

	it('Should remove every document of the collection when the filter is empty', async () => {

		const model = await seed();

		// Current behavior: an empty filter is not rejected, it deletes the whole collection (risk: a caller passing a filter that ends up empty wipes the data)
		const result = await getMongodbInstance().multiRemove(model, {});

		assert.equal(result, 3);
		assert.deepEqual(await names(model), []);
	});

	it('Should remove every document of the collection when the filter is an empty array', async () => {

		const model = await seed();

		// Current behavior: same as an empty filter
		const result = await getMongodbInstance().multiRemove(model, []);

		assert.equal(result, 3);
		assert.deepEqual(await names(model), []);
	});

	it('Should remove every document of the collection when the filter is undefined', async () => {

		const model = await seed();

		// Current behavior: same as an empty filter
		const result = await getMongodbInstance().multiRemove(model);

		assert.equal(result, 3);
		assert.deepEqual(await names(model), []);
	});

});
