'use strict';

const assert = require('node:assert').strict;

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { assertDriverError } = require('./_helpers');

describe('dropCollection()', () => {

	it('Should resolve true when the collection exists and remove it with its data and indexes', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.createIndexes(model, TestModel.indexes);
		await mongodb.insert(model, { name: 'Test' });

		const result = await mongodb.dropCollection(TestModel.table);

		assert.equal(result, true);
		assert.deepEqual(await mongodb.get(model), []);
		await assertDriverError(mongodb.getIndexes(model), 26);
	});

	it('Should resolve depending on the server version when the collection does not exist', async () => {

		if(!process.env.MONGODB_INTEGRATION_VERSION)
			throw new Error('Missing MONGODB_INTEGRATION_VERSION env var: run these tests through `npm run test-integration`');

		const mongodb = getMongodbInstance();

		const result = await mongodb.dropCollection('never-existed-collection');

		// The `drop` command became a no-op (idempotent) for non-existent namespaces on some server versions but
		// not others: resolves `false` on 6.0.24, `true` on 7.0.21 and 8.0.12.
		const [majorVersion] = process.env.MONGODB_INTEGRATION_VERSION.split('.').map(Number);
		const expected = majorVersion >= 7;

		assert.equal(result, expected);
	});

	it('Should reject with the driver error 73 (InvalidNamespace) when the collection name is empty', async () => {

		await assertDriverError(getMongodbInstance().dropCollection(''), 73);
	});

	it('Should reject with the driver error 2 (BadValue) or 14 (TypeMismatch) when the collection name is undefined', async () => {

		if(!process.env.MONGODB_INTEGRATION_VERSION)
			throw new Error('Missing MONGODB_INTEGRATION_VERSION env var: run these tests through `npm run test-integration`');

		// Current behavior: the name is not validated by the package, the server code depends on its version:
		// 2 (BadValue) on 6.0.24 and 7.0.21, 14 (TypeMismatch) on 8.0.12.
		const [majorVersion] = process.env.MONGODB_INTEGRATION_VERSION.split('.').map(Number);

		await assertDriverError(getMongodbInstance().dropCollection(undefined), majorVersion >= 8 ? 14 : 2);
	});

});
