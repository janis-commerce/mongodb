'use strict';

const assert = require('node:assert').strict;

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, assertDriverError } = require('./_helpers');

describe('dropIndex()', () => {

	const getIndexNames = async model => (await getMongodbInstance().getIndexes(model)).map(index => index.name);

	beforeEach(async () => {
		await getMongodbInstance().createIndexes(new TestModel(), [
			...TestModel.indexes,
			{ name: 'group', key: { group: 1 } }
		]);
	});

	afterEach(async () => {
		await cleanCollection();
	});

	it('Should drop an existing index and return true', async () => {

		const model = new TestModel();

		const result = await getMongodbInstance().dropIndex(model, 'group');

		assert.equal(result, true);
		assert.deepEqual((await getIndexNames(model)).sort(), ['_id_', 'name']);
	});

	it('Should reject with the driver error 27 (IndexNotFound) when the index does not exist', async () => {

		await assertDriverError(getMongodbInstance().dropIndex(new TestModel(), 'nope'), 27);
	});

	it('Should reject with the driver error 72 (InvalidOptions) when dropping the _id_ index', async () => {

		const model = new TestModel();

		await assertDriverError(getMongodbInstance().dropIndex(model, '_id_'), 72);

		assert.ok((await getIndexNames(model)).includes('_id_'));
	});

	it('Should reject with the driver error 26 (NamespaceNotFound) when the collection does not exist', async () => {

		await cleanCollection();

		await assertDriverError(getMongodbInstance().dropIndex(new TestModel(), 'group'), 26);
	});

});
