'use strict';

const assert = require('node:assert').strict;

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, assertDriverError } = require('./_helpers');

describe('createIndexes()', () => {

	const getIndex = async (model, name) => (await getMongodbInstance().getIndexes(model)).find(index => index.name === name);

	afterEach(async () => {
		await cleanCollection();
	});

	it('Should create the model unique index, return true and expose it afterwards', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		const created = await mongodb.createIndexes(model, TestModel.indexes);

		assert.equal(created, true);

		const nameIndex = await getIndex(model, 'name');

		assert.ok(nameIndex, 'Expected the unique `name` index to exist');
		assert.deepEqual(nameIndex.key, { name: 1 });
		assert.equal(nameIndex.unique, true);
	});

	it('Should create several indexes in one call', async () => {

		const model = new TestModel();

		const created = await getMongodbInstance().createIndexes(model, [
			{ name: 'a', key: { a: 1 } },
			{ name: 'b', key: { b: -1 } }
		]);

		assert.equal(created, true);
		assert.deepEqual((await getIndex(model, 'a')).key, { a: 1 });
		assert.deepEqual((await getIndex(model, 'b')).key, { b: -1 });
	});

	it('Should create a compound index preserving the key order and direction', async () => {

		const model = new TestModel();

		await getMongodbInstance().createIndexes(model, [{ name: 'compound', key: { group: 1, value: -1 } }]);

		const index = await getIndex(model, 'compound');

		assert.deepEqual(index.key, { group: 1, value: -1 });
		assert.deepEqual(Object.keys(index.key), ['group', 'value']);
	});

	it('Should create a TTL index with expireAfterSeconds', async () => {

		const model = new TestModel();

		await getMongodbInstance().createIndexes(model, [{ name: 'ttl', key: { expiresAt: 1 }, expireAfterSeconds: 3600 }]);

		const index = await getIndex(model, 'ttl');

		assert.deepEqual(index.key, { expiresAt: 1 });
		assert.equal(index.expireAfterSeconds, 3600);
	});

	it('Should create a partial index with partialFilterExpression', async () => {

		const model = new TestModel();

		await getMongodbInstance().createIndexes(model, [{
			name: 'partial',
			key: { code: 1 },
			unique: true,
			partialFilterExpression: { code: { $exists: true } }
		}]);

		const index = await getIndex(model, 'partial');

		assert.equal(index.unique, true);
		assert.deepEqual(index.partialFilterExpression, { code: { $exists: true } });
	});

	it('Should create a sparse index', async () => {

		const model = new TestModel();

		await getMongodbInstance().createIndexes(model, [{ name: 'sparse', key: { optional: 1 }, sparse: true }]);

		assert.equal((await getIndex(model, 'sparse')).sparse, true);
	});

	it('Should be idempotent when creating the same indexes twice', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		assert.equal(await mongodb.createIndexes(model, TestModel.indexes), true);
		assert.equal(await mongodb.createIndexes(model, TestModel.indexes), true);

		const indexes = await mongodb.getIndexes(model);

		assert.equal(indexes.filter(index => index.name === 'name').length, 1);
		assert.equal(indexes.length, 2);
	});

	it('Should reject with the driver error 85 (IndexOptionsConflict) when the same key has another name', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.createIndexes(model, [{ name: 'first', key: { a: 1 } }]);

		await assertDriverError(mongodb.createIndexes(model, [{ name: 'second', key: { a: 1 } }]), 85);
	});

	it('Should reject with the driver error 86 (IndexKeySpecsConflict) when the same name has another key', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.createIndexes(model, [{ name: 'same', key: { a: 1 } }]);

		await assertDriverError(mongodb.createIndexes(model, [{ name: 'same', key: { b: 1 } }]), 86);
	});

	it('Should reject with the driver error 86 (IndexKeySpecsConflict) when the same name and key have other options', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.createIndexes(model, [{ name: 'same', key: { a: 1 } }]);

		await assertDriverError(mongodb.createIndexes(model, [{ name: 'same', key: { a: 1 }, unique: true }]), 86);
	});

	it('Should reject with the driver error 11000 (DuplicateKey) when a unique index is created over duplicated data', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.multiInsert(model, [{ name: 'A', group: 'x' }, { name: 'B', group: 'x' }]);

		await assertDriverError(mongodb.createIndexes(model, [{ name: 'group_unique', key: { group: 1 }, unique: true }]), 11000);

		assert.equal(await getIndex(model, 'group_unique'), undefined);
	});

	it('Should reject with the driver error 2 (BadValue) when the array is empty', async () => {

		// Current behavior: `[]` is not validated by the package, the server rejects it ("Must specify at least one index to create")
		await assertDriverError(getMongodbInstance().createIndexes(new TestModel(), []), 2);
	});

});
