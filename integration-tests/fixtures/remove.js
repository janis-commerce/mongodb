'use strict';

const assert = require('node:assert').strict;

const { ObjectId } = require('../../lib/mongodb');
const MongoDBError = require('../../lib/mongodb-error');

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, findRaw } = require('./_helpers');

describe('remove()', () => {

	const seed = async () => {

		const model = new TestModel();

		await getMongodbInstance().insert(model, { name: 'Test 1' });
		await getMongodbInstance().insert(model, { name: 'Test 2' });

		return model;
	};

	beforeEach(async () => {
		await getMongodbInstance().createIndexes(new TestModel(), TestModel.indexes);
	});

	afterEach(async () => {
		await cleanCollection();
	});

	it('Should remove the document by id and return true', async () => {

		const model = await seed();
		const [{ _id }] = await findRaw(model, { name: 'Test 1' });

		const result = await getMongodbInstance().remove(model, { id: _id.toString() });

		assert.equal(result, true);

		const remaining = await findRaw(model);

		assert.deepEqual(remaining.map(({ name }) => name), ['Test 2']);
	});

	it('Should remove the document by unique index and return true', async () => {

		const model = await seed();

		const result = await getMongodbInstance().remove(model, { name: 'Test 2' });

		assert.equal(result, true);

		const remaining = await findRaw(model);

		assert.deepEqual(remaining.map(({ name }) => name), ['Test 1']);
	});

	it('Should return false when the document does not exist (unique index)', async () => {

		const model = await seed();

		const result = await getMongodbInstance().remove(model, { name: 'Non existent' });

		assert.equal(result, false);
		assert.equal((await findRaw(model)).length, 2);
	});

	it('Should return false when the document does not exist (id)', async () => {

		const model = await seed();

		const result = await getMongodbInstance().remove(model, { id: new ObjectId().toString() });

		assert.equal(result, false);
		assert.equal((await findRaw(model)).length, 2);
	});

	it('Should return false when removing the same document twice', async () => {

		const model = await seed();

		assert.equal(await getMongodbInstance().remove(model, { name: 'Test 1' }), true);
		assert.equal(await getMongodbInstance().remove(model, { name: 'Test 1' }), false);
	});

	it('Should reject with EMPTY_UNIQUE_INDEXES when the item does not match a unique index', async () => {

		const model = await seed();

		await assert.rejects(
			getMongodbInstance().remove(model, { other: 'x' }),
			err => err instanceof MongoDBError && err.code === MongoDBError.codes.EMPTY_UNIQUE_INDEXES
		);
	});

	it('Should reject with a raw BSONError when the id is not a valid ObjectId', async () => {

		const model = await seed();

		let error;

		try {
			await getMongodbInstance().remove(model, { id: 'not-an-object-id' });
		} catch(err) {
			error = err;
		}

		// Current behavior: the id is cast before the try/catch, so it is thrown as is
		assert.ok(error);
		assert.equal(error instanceof MongoDBError, false);
		assert.equal(error.name, 'BSONError');
	});

});
