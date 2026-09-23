'use strict';

const assert = require('node:assert').strict;

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');

describe('Drop collection', () => {

	it('dropCollection(): Should resolve true when the collection exists', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.insert(model, { name: 'Test' });

		const result = await mongodb.dropCollection(TestModel.table);

		assert.equal(result, true);
	});

	it('dropCollection(): Should resolve depending on the server version when the collection does not exist', async () => {

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

});
