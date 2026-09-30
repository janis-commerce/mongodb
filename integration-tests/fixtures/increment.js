'use strict';

const assert = require('node:assert').strict;

const sinon = require('sinon');

const { ObjectId } = require('../../lib/mongodb');
const MongoDBError = require('../../lib/mongodb-error');

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, assertDriverError, useFakeDate, findRaw } = require('./_helpers');

describe('increment()', () => {

	const now = new Date();

	let clock;

	beforeEach(async () => {
		clock = useFakeDate(now);
		await getMongodbInstance().createIndexes(new TestModel(), TestModel.indexes);
	});

	afterEach(async () => {
		clock.restore();
		await cleanCollection();
	});

	const seed = async () => {

		const model = new TestModel();

		await getMongodbInstance().insert(model, { name: 'Test 1', firstValue: 1, secondValue: 10 });
		await getMongodbInstance().insert(model, { name: 'Test 2', firstValue: 100 });

		return model;
	};

	it('Should increment the given fields, set the additional data and return the updated document', async () => {

		const model = await seed();

		const result = await getMongodbInstance().increment(model, { name: 'Test 1' }, { firstValue: 1, secondValue: 30 }, { additionalData: 'test' });

		// Current behavior: returns the raw driver document (with `_id` ObjectId), it does not go through the id mapper
		sinon.assert.match(result, {
			_id: sinon.match.instanceOf(ObjectId),
			name: 'Test 1',
			firstValue: 2,
			secondValue: 40,
			additionalData: 'test',
			dateCreated: now,
			dateModified: now
		});
		assert.equal('id' in result, false);

		const [stored] = await findRaw(model, { name: 'Test 1' });

		assert.deepEqual(stored, result);
	});

	it('Should decrement with negative values', async () => {

		const model = await seed();

		const result = await getMongodbInstance().increment(model, { name: 'Test 1' }, { firstValue: -5, secondValue: -1 });

		assert.equal(result.firstValue, -4);
		assert.equal(result.secondValue, 9);
	});

	it('Should create the field starting from 0 when it does not exist', async () => {

		const model = await seed();

		const result = await getMongodbInstance().increment(model, { name: 'Test 1' }, { newValue: 3 });

		assert.equal(result.newValue, 3);
	});

	it('Should work without setData and set dateModified anyway', async () => {

		const model = await seed();

		const result = await getMongodbInstance().increment(model, { name: 'Test 1' }, { firstValue: 1 });

		assert.equal(result.firstValue, 2);
		assert.deepEqual(result.dateModified, now);
	});

	it('Should find the document by id', async () => {

		const model = await seed();
		const [{ _id }] = await findRaw(model, { name: 'Test 2' });

		const result = await getMongodbInstance().increment(model, { id: _id.toString() }, { firstValue: 1 });

		assert.equal(result.name, 'Test 2');
		assert.equal(result.firstValue, 101);
		assert.equal(result._id.toString(), _id.toString());
	});

	it('Should only modify the matching document', async () => {

		const model = await seed();

		await getMongodbInstance().increment(model, { name: 'Test 1' }, { firstValue: 1 });

		const [other] = await findRaw(model, { name: 'Test 2' });

		assert.equal(other.firstValue, 100);
		assert.equal('dateModified' in other, false);
	});

	it('Should return null and not create a document when the filter matches no document', async () => {

		const model = await seed();

		const result = await getMongodbInstance().increment(model, { name: 'Non existent' }, { firstValue: 1 });

		assert.equal(result, null);
		assert.equal((await findRaw(model)).length, 2);
	});

	it('Should reject with a driver error (code 4, server code 14) when the field is not a number', async () => {

		const model = new TestModel();

		await getMongodbInstance().insert(model, { name: 'Test', firstValue: 'text' });

		await assertDriverError(getMongodbInstance().increment(model, { name: 'Test' }, { firstValue: 1 }), 14);
	});

	it('Should reject with a driver error (code 4, server code 40) when setData conflicts with the incremented field', async () => {

		const model = await seed();

		await assertDriverError(getMongodbInstance().increment(model, { name: 'Test 1' }, { firstValue: 1 }, { firstValue: 5 }), 40);
	});

	it('Should reject with EMPTY_UNIQUE_INDEXES when the filter does not match a unique index', async () => {

		const model = await seed();

		await assert.rejects(
			getMongodbInstance().increment(model, { firstValue: 1 }, { firstValue: 1 }),
			err => err instanceof MongoDBError && err.code === MongoDBError.codes.EMPTY_UNIQUE_INDEXES
		);
	});

});
