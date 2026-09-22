'use strict';

const assert = require('node:assert').strict;

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');

describe('Indexes', () => {

	afterEach(async () => {
		await getMongodbInstance().dropCollection(TestModel.table);
	});

	it('createIndexes() + getIndexes(): Should create the model unique index and expose it afterwards', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		const created = await mongodb.createIndexes(model, TestModel.indexes);

		assert.equal(created, true);

		const indexes = await mongodb.getIndexes(model);

		const nameIndex = indexes.find(index => index.name === 'name');

		assert.ok(nameIndex, 'Expected the unique `name` index to exist');
		assert.deepEqual(nameIndex.key, { name: 1 });
		assert.equal(nameIndex.unique, true);
	});

});
