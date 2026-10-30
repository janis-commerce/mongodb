'use strict';

const assert = require('node:assert').strict;

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, assertDriverError } = require('./_helpers');

describe('dropIndexes()', () => {

	const getIndexNames = async model => (await getMongodbInstance().getIndexes(model)).map(index => index.name).sort();

	beforeEach(async () => {
		await getMongodbInstance().createIndexes(new TestModel(), [
			...TestModel.indexes,
			{ name: 'a', key: { a: 1 } },
			{ name: 'b', key: { b: 1 } }
		]);
	});

	afterEach(async () => {
		await cleanCollection();
	});

	it('Should drop several existing indexes and return true', async () => {

		const model = new TestModel();

		const result = await getMongodbInstance().dropIndexes(model, ['a', 'b']);

		assert.equal(result, true);
		assert.deepEqual(await getIndexNames(model), ['_id_', 'name']);
	});

	it('Should return true and drop nothing with an empty array', async () => {

		const model = new TestModel();

		const result = await getMongodbInstance().dropIndexes(model, []);

		assert.equal(result, true);
		assert.deepEqual(await getIndexNames(model), ['_id_', 'a', 'b', 'name']);
	});

	it('Should reject with the driver error 27 (IndexNotFound) but the other indexes are already dropped', async () => {

		const model = new TestModel();

		await assertDriverError(getMongodbInstance().dropIndexes(model, ['a', 'nope', 'b']), 27);

		// allSettled: the call rejects only after every drop finished
		assert.deepEqual(await getIndexNames(model), ['_id_', 'name']);
	});

	it('Should reject with the driver error 72 (InvalidOptions) when one of the names is _id_', async () => {

		await assertDriverError(getMongodbInstance().dropIndexes(new TestModel(), ['_id_']), 72);
	});

});
