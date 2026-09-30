'use strict';

const assert = require('node:assert').strict;

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, assertDriverError } = require('./_helpers');

describe('dropIndexes()', () => {

	const getIndexNames = async model => (await getMongodbInstance().getIndexes(model)).map(index => index.name).sort();

	// The rejection does not wait for the drops still in flight: polls until the remaining ones are done
	const waitForIndexNames = async (model, expected) => {

		let names;

		for(let attempt = 0; attempt < 50; attempt++) {
			names = await getIndexNames(model);
			if(names.length === expected.length)
				break;
			await new Promise(resolve => { setTimeout(resolve, 20); });
		}

		return names;
	};

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

		// Current behavior: the drops run in parallel (Promise.all), so the existing ones are dropped even though the call rejects
		assert.deepEqual(await waitForIndexNames(model, ['_id_', 'name']), ['_id_', 'name']);
	});

	it('Should reject with the driver error 72 (InvalidOptions) when one of the names is _id_', async () => {

		await assertDriverError(getMongodbInstance().dropIndexes(new TestModel(), ['_id_']), 72);
	});

});
