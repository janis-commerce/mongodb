'use strict';

const assert = require('node:assert').strict;

const { ObjectId } = require('../../lib/mongodb');
const MongoDBError = require('../../lib/mongodb-error');

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, assertDriverError, useFakeDate, findRaw } = require('./_helpers');

describe('multiInsert()', () => {

	let clock;

	beforeEach(async () => {
		await getMongodbInstance().createIndexes(new TestModel(), TestModel.indexes);
	});

	afterEach(async () => {
		clock?.restore();
		clock = undefined;
		await cleanCollection();
	});

	it('Should insert every document and return them with the generated id and dateCreated', async () => {

		const now = new Date();
		clock = useFakeDate(now);

		const model = new TestModel();

		const result = await getMongodbInstance().multiInsert(model, [
			{ name: 'Test 1', value: 1 },
			{ name: 'Test 2', value: 2 }
		]);

		const stored = await findRaw(model);

		assert.equal(stored.length, 2);

		assert.deepEqual(result, [
			{ name: 'Test 1', value: 1, dateCreated: now, id: stored[0]._id.toString() },
			{ name: 'Test 2', value: 2, dateCreated: now, id: stored[1]._id.toString() }
		]);

		assert.deepEqual(stored[0].dateCreated, now);
	});

	it('Should not set dateModified', async () => {

		const model = new TestModel();

		await getMongodbInstance().multiInsert(model, [{ name: 'Test 1' }]);

		const [stored] = await findRaw(model);

		assert.equal('dateModified' in stored, false);
	});

	it('Should respect an explicit dateCreated (Date and ISO string)', async () => {

		const model = new TestModel();
		const dateCreated = new Date('2020-01-02T03:04:05.000Z');

		const result = await getMongodbInstance().multiInsert(model, [
			{ name: 'Test 1', dateCreated },
			{ name: 'Test 2', dateCreated: '2021-01-02T03:04:05.000Z' }
		]);

		assert.deepEqual(result.map(item => item.dateCreated), [dateCreated, new Date('2021-01-02T03:04:05.000Z')]);

		const stored = await findRaw(model);

		assert.deepEqual(stored.map(item => item.dateCreated), [dateCreated, new Date('2021-01-02T03:04:05.000Z')]);
	});

	it('Should use the given id (converted to ObjectId) and return it', async () => {

		const model = new TestModel();
		const id = new ObjectId().toString();

		const result = await getMongodbInstance().multiInsert(model, [{ id, name: 'Test 1' }, { name: 'Test 2' }]);

		assert.equal(result[0].id, id);
		assert.equal(result[1].id === id, false);

		const stored = await findRaw(model, { _id: new ObjectId(id) });

		assert.equal(stored.length, 1);
		assert.equal(stored[0].name, 'Test 1');
	});

	it('Should skip a single duplicated document and return only the inserted ones', async () => {

		const model = new TestModel();

		const result = await getMongodbInstance().multiInsert(model, [
			{ name: 'Unique 1' },
			{ name: 'Unique 1' } // duplicate of the previous one, violates the unique index on `name`
		]);

		assert.equal(result.length, 1);
		assert.equal(result[0].name, 'Unique 1');
		assert.equal(typeof result[0].id, 'string');

		assert.equal((await findRaw(model)).length, 1);
	});

	it('Should return every successfully inserted document with interleaved duplicates', async () => {

		const now = new Date();
		clock = useFakeDate(now);

		const model = new TestModel();

		const result = await getMongodbInstance().multiInsert(model, [
			{ name: 'A' },
			{ name: 'A' }, // duplicate of index 0, fails
			{ name: 'B' },
			{ name: 'C' }
		]);

		// unordered: the documents after the failing one are inserted too
		assert.deepEqual(result.map(({ name }) => name), ['A', 'B', 'C']);
		assert.deepEqual(result.map(({ dateCreated }) => dateCreated), [now, now, now]);

		const stored = await findRaw(model);

		assert.deepEqual(stored.map(({ name }) => name), ['A', 'B', 'C']);
		assert.deepEqual(result.map(({ id }) => id), stored.map(({ _id }) => _id.toString()));
	});

	it('Should return an empty array when every document is a duplicate of an existing one', async () => {

		const model = new TestModel();

		await getMongodbInstance().insert(model, { name: 'A' });
		await getMongodbInstance().insert(model, { name: 'B' });

		const result = await getMongodbInstance().multiInsert(model, [{ name: 'A' }, { name: 'B' }]);

		assert.deepEqual(result, []);
		assert.equal((await findRaw(model)).length, 2);
	});

	it('Should insert the new documents and skip the ones duplicated against existing documents', async () => {

		const model = new TestModel();

		await getMongodbInstance().insert(model, { name: 'Existing', value: 'original' });

		const result = await getMongodbInstance().multiInsert(model, [
			{ name: 'New 1' },
			{ name: 'Existing', value: 'new' },
			{ name: 'New 2' }
		]);

		assert.deepEqual(result.map(({ name }) => name), ['New 1', 'New 2']);

		const stored = await findRaw(model);

		assert.equal(stored.length, 3);
		assert.equal(stored.find(({ name }) => name === 'Existing').value, 'original');
	});

	it('Should reject with code 4 wrapping server code 11000 when failOnDuplicateErrors is true', async () => {

		const model = new TestModel();

		await getMongodbInstance().insert(model, { name: 'Existing' });

		await assertDriverError(
			getMongodbInstance().multiInsert(model, [{ name: 'Existing' }], { failOnDuplicateErrors: true }),
			11000
		);
	});

	it('Should reject with code 4 wrapping server code 11000 when failOnDuplicateErrors is true and duplicates are in the same batch', async () => {

		const model = new TestModel();

		await assertDriverError(
			getMongodbInstance().multiInsert(model, [{ name: 'A' }, { name: 'A' }], { failOnDuplicateErrors: true }),
			11000
		);
	});

	describe('errors', () => {

		it('Should reject with INVALID_MODEL when the model is missing', async () => {
			await assert.rejects(getMongodbInstance().multiInsert(undefined, [{ name: 'A' }]), { code: MongoDBError.codes.INVALID_MODEL });
		});

		it('Should reject with INVALID_ITEM when the items are not an array or are empty', async () => {

			const model = new TestModel();

			await assert.rejects(getMongodbInstance().multiInsert(model, { name: 'A' }), { code: MongoDBError.codes.INVALID_ITEM });
			await assert.rejects(getMongodbInstance().multiInsert(model, []), { code: MongoDBError.codes.INVALID_ITEM });
		});

	});

});
