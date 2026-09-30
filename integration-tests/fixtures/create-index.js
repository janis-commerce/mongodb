'use strict';

const assert = require('node:assert').strict;

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, assertDriverError } = require('./_helpers');

describe('createIndex()', () => {

	const getIndex = async (model, name) => (await getMongodbInstance().getIndexes(model)).find(index => index.name === name);

	afterEach(async () => {
		await cleanCollection();
	});

	it('Should create a simple index and return true', async () => {

		const model = new TestModel();

		const result = await getMongodbInstance().createIndex(model, { name: 'group', key: { group: 1 } });

		assert.equal(result, true);

		const index = await getIndex(model, 'group');

		assert.deepEqual(index.key, { group: 1 });
		assert.equal(index.unique, undefined);
	});

	it('Should create an index with options and return true', async () => {

		const model = new TestModel();

		const result = await getMongodbInstance().createIndex(model, {
			name: 'code',
			key: { code: 1 },
			unique: true,
			sparse: true
		});

		assert.equal(result, true);

		const index = await getIndex(model, 'code');

		assert.equal(index.unique, true);
		assert.equal(index.sparse, true);
	});

	it('Should reject with the driver error 86 (IndexKeySpecsConflict) when the name exists with another key', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.createIndex(model, { name: 'same', key: { a: 1 } });

		await assertDriverError(mongodb.createIndex(model, { name: 'same', key: { b: 1 } }), 86);
	});

});
