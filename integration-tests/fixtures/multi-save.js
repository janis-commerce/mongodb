'use strict';

const assert = require('node:assert').strict;

const { ObjectId } = require('../../lib/mongodb');
const MongoDBError = require('../../lib/mongodb-error');

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, assertDriverError, useFakeDate, findRaw } = require('./_helpers');

describe('multiSave()', () => {

	let clock;

	beforeEach(async () => {
		await getMongodbInstance().createIndexes(new TestModel(), TestModel.indexes);
	});

	afterEach(async () => {
		clock?.restore();
		clock = undefined;
		await cleanCollection();
	});

	it('Should insert multiple new documents and return true', async () => {

		const now = new Date();
		clock = useFakeDate(now);

		const model = new TestModel();

		const result = await getMongodbInstance().multiSave(model, [
			{ name: 'Test 1', value: 1 },
			{ name: 'Test 2', value: 2 }
		]);

		assert.equal(result, true);

		const stored = await findRaw(model);

		assert.equal(stored.length, 2);
		assert.deepEqual(stored.map(({ name, value }) => ({ name, value })), [
			{ name: 'Test 1', value: 1 },
			{ name: 'Test 2', value: 2 }
		]);

		for(const item of stored) {
			assert.deepEqual(item.dateCreated, now);
			// $currentDate: server date
			assert.equal(item.dateModified instanceof Date, true);
		}
	});

	it('Should update the existing documents by the unique index and keep dateCreated', async () => {

		const model = new TestModel();
		const dateCreated = new Date('2020-01-02T03:04:05.000Z');

		await getMongodbInstance().multiInsert(model, [
			{ name: 'Test 1', value: 1, dateCreated },
			{ name: 'Test 2', value: 2, dateCreated }
		]);

		const result = await getMongodbInstance().multiSave(model, [
			{ name: 'Test 1', value: 10, dateCreated: new Date('2021-01-01T00:00:00.000Z') },
			{ name: 'Test 2', value: 20 }
		]);

		assert.equal(result, true);

		const stored = await findRaw(model);

		assert.equal(stored.length, 2);
		assert.deepEqual(stored.map(({ value }) => value), [10, 20]);
		assert.deepEqual(stored.map(item => item.dateCreated), [dateCreated, dateCreated]);
		assert.equal(stored[0].dateModified instanceof Date, true);
	});

	it('Should insert and update in the same call', async () => {

		const model = new TestModel();

		await getMongodbInstance().insert(model, { name: 'Existing', value: 1 });

		await getMongodbInstance().multiSave(model, [
			{ name: 'Existing', value: 2 },
			{ name: 'New', value: 3 }
		]);

		const stored = await findRaw(model);

		assert.deepEqual(stored.map(({ name, value }) => ({ name, value })), [
			{ name: 'Existing', value: 2 },
			{ name: 'New', value: 3 }
		]);
	});

	it('Should update by id even if the unique index value changes', async () => {

		const model = new TestModel();

		const [{ id }] = await getMongodbInstance().multiInsert(model, [{ name: 'Test', value: 1 }]);

		await getMongodbInstance().multiSave(model, [{ id, name: 'Renamed', value: 2 }]);

		const stored = await findRaw(model);

		assert.equal(stored.length, 1);
		assert.equal(stored[0]._id.toString(), id);
		assert.equal(stored[0].name, 'Renamed');
		assert.equal(stored[0].value, 2);
	});

	it('Should insert with the given id when the id does not exist', async () => {

		const model = new TestModel();
		const id = new ObjectId().toString();

		await getMongodbInstance().multiSave(model, [{ id, name: 'Test' }]);

		const [stored] = await findRaw(model);

		assert.equal(stored._id.toString(), id);
	});

	it('Should apply setOnInsert only on inserted documents and not over the item fields', async () => {

		const model = new TestModel();

		await getMongodbInstance().insert(model, { name: 'Existing' });

		await getMongodbInstance().multiSave(model, [
			{ name: 'Existing' },
			{ name: 'New' },
			{ name: 'New With Status', status: 'custom' }
		], { status: 'pending', other: 1 });

		const stored = await findRaw(model);
		const byName = name => stored.find(item => item.name === name);

		assert.equal('status' in byName('Existing'), false);
		assert.equal(byName('New').status, 'pending');
		assert.equal(byName('New').other, 1);
		assert.equal(byName('New With Status').status, 'custom');
		assert.equal(byName('New With Status').other, 1);
	});

	it('Should not set dateModified when skipAutomaticSetModifiedData is true', async () => {

		const model = new TestModel();

		await getMongodbInstance().multiSave(model, [{ name: 'Test 1' }, { name: 'Test 2' }], undefined, { skipAutomaticSetModifiedData: true });

		const stored = await findRaw(model);

		assert.equal(stored.length, 2);
		assert.equal(stored.some(item => 'dateModified' in item), false);
	});

	it('Should support update operators in the items', async () => {

		const model = new TestModel();

		await getMongodbInstance().multiSave(model, [{ name: 'Test', value: 1, tags: ['a'] }]);

		await getMongodbInstance().multiSave(model, [{
			name: 'Test',
			$inc: { value: 4 },
			$push: { tags: 'b' }
		}]);

		const [stored] = await findRaw(model);

		assert.equal(stored.value, 5);
		assert.deepEqual(stored.tags, ['a', 'b']);
	});

	describe('errors', () => {

		it('Should reject with code 4 wrapping server code 11000 when another unique index is violated', async () => {

			const model = new TestModel();

			await getMongodbInstance().createIndexes(model, [{ name: 'code', key: { code: 1 }, unique: true }]);

			await getMongodbInstance().insert(model, { name: 'Existing', code: 'X' });

			await assertDriverError(
				getMongodbInstance().multiSave(model, [{ name: 'New', code: 'X' }]),
				11000
			);
		});

		it('Should stop at the failing item and keep the previous ones applied (ordered)', async () => {

			const model = new TestModel();

			await getMongodbInstance().createIndexes(model, [{ name: 'code', key: { code: 1 }, unique: true }]);

			await getMongodbInstance().insert(model, { name: 'Existing', code: 'X' });

			await assertDriverError(
				getMongodbInstance().multiSave(model, [
					{ name: 'First', code: 'A' }, // applied
					{ name: 'Second', code: 'X' }, // violates the unique index on `code`
					{ name: 'Third', code: 'C' } // never executed: the bulk is ordered
				]),
				11000
			);

			const names = (await findRaw(model)).map(({ name }) => name);

			assert.deepEqual(names, ['Existing', 'First']);
		});

		it('Should reject with INVALID_MODEL when the model is missing', async () => {
			await assert.rejects(getMongodbInstance().multiSave(undefined, [{ name: 'A' }]), { code: MongoDBError.codes.INVALID_MODEL });
		});

		it('Should reject with INVALID_ITEM when the items are not an array or are empty', async () => {

			const model = new TestModel();

			await assert.rejects(getMongodbInstance().multiSave(model, { name: 'A' }), { code: MongoDBError.codes.INVALID_ITEM });
			await assert.rejects(getMongodbInstance().multiSave(model, []), { code: MongoDBError.codes.INVALID_ITEM });
		});

		it('Should reject with EMPTY_UNIQUE_INDEXES when an item does not match a unique index', async () => {
			await assert.rejects(getMongodbInstance().multiSave(new TestModel(), [{ value: 1 }]), { code: MongoDBError.codes.EMPTY_UNIQUE_INDEXES });
		});

	});

});
