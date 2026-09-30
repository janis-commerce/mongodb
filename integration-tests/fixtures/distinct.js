'use strict';

const assert = require('node:assert').strict;

const TestModel = require('./_model');
const { TestModelWithFields } = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection } = require('./_helpers');

describe('distinct()', () => {

	const seed = async (model = new TestModel()) => {

		await getMongodbInstance().multiInsert(model, [
			{ name: 'Test 1', parent: 1, color: 'red' },
			{ name: 'Test 2', parent: 1, color: 'blue' },
			{ name: 'Test 3', parent: 2, color: 'red' },
			{ name: 'Test 4', color: 'green' }
		]);

		return model;
	};

	afterEach(async () => {
		await cleanCollection();
	});

	it('Should return the distinct values of a key', async () => {

		const model = await seed();

		const result = await getMongodbInstance().distinct(model, { key: 'parent' });

		assert.deepEqual(result.sort(), [1, 2]);
	});

	it('Should return an array of values, not documents', async () => {

		const model = await seed();

		const result = await getMongodbInstance().distinct(model, { key: 'color' });

		assert.deepEqual(result.sort(), ['blue', 'green', 'red']);
	});

	it('Should apply the filters', async () => {

		const model = await seed();

		const result = await getMongodbInstance().distinct(model, { key: 'color', filters: { parent: 1 } });

		assert.deepEqual(result.sort(), ['blue', 'red']);
	});

	it('Should apply filters with type and OR conditions', async () => {

		const model = await seed();

		const result = await getMongodbInstance().distinct(model, {
			key: 'color',
			filters: [{ parent: { type: 'greater', value: 1 } }, { color: 'green' }]
		});

		assert.deepEqual(result.sort(), ['green', 'red']);
	});

	it('Should convert the isID fields of the filters to ObjectId', async () => {

		const model = new TestModelWithFields();
		const mongodb = getMongodbInstance();

		const parentId = '5f8a7b2c9d1e4f0012345678';

		await mongodb.multiInsert(model, [
			{ name: 'A', parentId, color: 'red' },
			{ name: 'B', parentId: '5f8a7b2c9d1e4f0012345679', color: 'blue' }
		]);

		const result = await mongodb.distinct(model, { key: 'color', filters: { parentId } });

		assert.deepEqual(result, ['red']);
	});

	it('Should return an empty array if the collection is empty', async () => {

		const result = await getMongodbInstance().distinct(new TestModel(), { key: 'parent' });

		assert.deepEqual(result, []);
	});

	it('Should return an empty array if no document matches the filters', async () => {

		const model = await seed();

		const result = await getMongodbInstance().distinct(model, { key: 'parent', filters: { color: 'none' } });

		assert.deepEqual(result, []);
	});

	it('Should accept readPreference', async () => {

		const model = await seed();

		const result = await getMongodbInstance().distinct(model, { key: 'parent', readPreference: 'primary' });

		assert.deepEqual(result.sort(), [1, 2]);
	});

	it('Should not map the id filter to _id', async () => {

		const model = await seed();
		const mongodb = getMongodbInstance();

		const [{ id }] = await mongodb.get(model, { filters: { name: 'Test 1' } });

		const result = await mongodb.distinct(model, { key: 'color', filters: { id } });

		// Current behavior: unlike get(), distinct() does not map `id` to `_id`, so filtering by id matches nothing (inconsistent with get())
		assert.deepEqual(result, []);

		// Only the raw _id filter works
		const cursor = await mongodb.get(model, { returnType: 'cursor', filters: { name: 'Test 1' } });
		const { _id } = await cursor.next();
		await cursor.close();

		const withRawId = await mongodb.distinct(model, { key: 'color', filters: { _id: { raw: true, value: _id } } });

		assert.deepEqual(withRawId, ['red']);
	});

});
