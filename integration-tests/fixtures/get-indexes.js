'use strict';

const assert = require('node:assert').strict;

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, assertDriverError } = require('./_helpers');

describe('getIndexes()', () => {

	afterEach(async () => {
		await cleanCollection();
	});

	it('Should return the raw driver indexes, including the default _id_ index', async () => {

		const model = new TestModel();

		await getMongodbInstance().insert(model, { name: 'Test' });

		const indexes = await getMongodbInstance().getIndexes(model);

		assert.deepEqual(indexes, [{ v: 2, key: { _id: 1 }, name: '_id_' }]);
	});

	it('Should expose the created indexes with their raw driver fields', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.createIndexes(model, [
			...TestModel.indexes,
			{ name: 'group_value', key: { group: 1, value: -1 } }
		]);

		const indexes = await mongodb.getIndexes(model);

		assert.equal(indexes.length, 3);
		assert.deepEqual(indexes.find(index => index.name === '_id_'), { v: 2, key: { _id: 1 }, name: '_id_' });
		assert.deepEqual(indexes.find(index => index.name === 'name'), { v: 2, key: { name: 1 }, name: 'name', unique: true });
		assert.deepEqual(indexes.find(index => index.name === 'group_value'), { v: 2, key: { group: 1, value: -1 }, name: 'group_value' });
	});

	it('Should reject with the driver error 26 (NamespaceNotFound) when the collection does not exist', async () => {

		await assertDriverError(getMongodbInstance().getIndexes(new TestModel()), 26);
	});

});
