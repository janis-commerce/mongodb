'use strict';

const assert = require('node:assert').strict;

const { ObjectId } = require('../../lib/mongodb');
const MongoDBError = require('../../lib/mongodb-error');

const TestModel = require('./_model');
const { TestModelWithFields } = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, assertDriverError, useFakeDate, findRaw } = require('./_helpers');

describe('update()', () => {

	let clock;

	const seed = async (items = [
		{ name: 'Test 1', group: 'a', value: 1 },
		{ name: 'Test 2', group: 'a', value: 2 },
		{ name: 'Test 3', group: 'b', value: 3 }
	], model = new TestModel()) => {

		await getMongodbInstance().multiInsert(model, items);

		return model;
	};

	const findByName = async (model, name) => {
		const [stored] = await findRaw(model, { name });
		return stored;
	};

	beforeEach(async () => {
		await getMongodbInstance().createIndexes(new TestModel(), TestModel.indexes);
	});

	afterEach(async () => {
		clock?.restore();
		clock = undefined;
		await cleanCollection();
	});

	it('Should return the modifiedCount', async () => {

		const model = await seed();

		const result = await getMongodbInstance().update(model, { value: 10 }, { group: 'a' });

		assert.equal(result, 2);
	});

	it('Should return 0 when no document matches the filter', async () => {

		const model = await seed();

		const result = await getMongodbInstance().update(model, { value: 10 }, { group: 'unknown' });

		assert.equal(result, 0);
	});

	it('Should return 0 when the values do not change the document and dateModified is skipped', async () => {

		const model = await seed();

		const result = await getMongodbInstance().update(model, { value: 1 }, { name: 'Test 1' }, { skipAutomaticSetModifiedData: true });

		assert.equal(result, 0);
	});

	it('Should update every matching document by default (updateMany)', async () => {

		const model = await seed();

		await getMongodbInstance().update(model, { value: 10 }, { group: 'a' });

		const stored = await findRaw(model, { value: 10 });

		assert.deepEqual(stored.map(({ name }) => name).sort(), ['Test 1', 'Test 2']);
	});

	it('Should update only one document with updateOne', async () => {

		const model = await seed();

		const result = await getMongodbInstance().update(model, { value: 10 }, { group: 'a' }, { updateOne: true });

		assert.equal(result, 1);
		assert.equal((await findRaw(model, { value: 10 })).length, 1);
	});

	it('Should update every document of the collection when no filters are received', async () => {

		const model = await seed();

		const result = await getMongodbInstance().update(model, { flag: true });

		assert.equal(result, 3);
		assert.equal((await findRaw(model, { flag: true })).length, 3);
	});

	it('Should filter by id', async () => {

		const model = await seed();
		const [{ _id }] = await findRaw(model, { name: 'Test 2' });

		const result = await getMongodbInstance().update(model, { value: 20 }, { id: _id.toString() });

		assert.equal(result, 1);
		assert.equal((await findByName(model, 'Test 2')).value, 20);
		assert.equal((await findByName(model, 'Test 1')).value, 1);
	});

	it('Should filter using the model filters config (field rename, isID cast)', async () => {

		const parentId = new ObjectId();
		const model = await seed([
			{ name: 'Test 1', parentId },
			{ name: 'Test 2', parentId: new ObjectId() }
		], new TestModelWithFields());

		const result = await getMongodbInstance().update(model, { value: 1 }, { fullName: 'Test 1', parentId: parentId.toString() });

		assert.equal(result, 1);
		assert.equal((await findByName(model, 'Test 1')).value, 1);
	});

	it('Should set plain values with $set and keep the other fields', async () => {

		const model = await seed();

		await getMongodbInstance().update(model, { value: 10, extra: 'x' }, { name: 'Test 1' });

		const stored = await findByName(model, 'Test 1');

		assert.equal(stored.value, 10);
		assert.equal(stored.extra, 'x');
		assert.equal(stored.group, 'a');
	});

	it('Should combine plain values with update operators', async () => {

		const model = await seed([{ name: 'Test 1', value: 1, tags: ['a'], toRemove: 'x' }]);

		await getMongodbInstance().update(model, {
			extra: 'x',
			$set: { other: 'y' },
			$inc: { value: 4 },
			$push: { tags: 'b' },
			$unset: { toRemove: '' }
		}, { name: 'Test 1' });

		const stored = await findByName(model, 'Test 1');

		assert.equal(stored.extra, 'x');
		assert.equal(stored.other, 'y');
		assert.equal(stored.value, 5);
		assert.deepEqual(stored.tags, ['a', 'b']);
		assert.equal('toRemove' in stored, false);
	});

	it('Should apply $addToSet without duplicating values', async () => {

		const model = await seed([{ name: 'Test 1', tags: ['a'] }]);

		await getMongodbInstance().update(model, { $addToSet: { tags: 'a' } }, { name: 'Test 1' });
		await getMongodbInstance().update(model, { $addToSet: { tags: 'b' } }, { name: 'Test 1' });

		assert.deepEqual((await findByName(model, 'Test 1')).tags, ['a', 'b']);
	});

	it('Should convert the isID fields of the values to ObjectId', async () => {

		const model = await seed([{ name: 'Test 1' }], new TestModelWithFields());
		const parentId = new ObjectId();

		await getMongodbInstance().update(model, { parentId: parentId.toString() }, { name: 'Test 1' });

		const stored = await findByName(model, 'Test 1');

		assert.equal(stored.parentId instanceof ObjectId, true);
		assert.equal(stored.parentId.toString(), parentId.toString());
	});

	describe('dateModified', () => {

		it('Should set dateModified with the client date', async () => {

			const now = new Date();
			clock = useFakeDate(now);

			const model = await seed();

			await getMongodbInstance().update(model, { value: 10 }, { name: 'Test 1' });

			assert.deepEqual((await findByName(model, 'Test 1')).dateModified, now);
			assert.equal('dateModified' in await findByName(model, 'Test 2'), false);
		});

		it('Should not set dateModified with skipAutomaticSetModifiedData', async () => {

			const model = await seed();

			await getMongodbInstance().update(model, { value: 10 }, { name: 'Test 1' }, { skipAutomaticSetModifiedData: true });

			const stored = await findByName(model, 'Test 1');

			assert.equal(stored.value, 10);
			assert.equal('dateModified' in stored, false);
		});

		it('Should allow overriding dateModified with a plain value', async () => {

			const model = await seed();
			const dateModified = new Date('2020-01-02T03:04:05.000Z');

			await getMongodbInstance().update(model, { dateModified }, { name: 'Test 1' });

			assert.deepEqual((await findByName(model, 'Test 1')).dateModified, dateModified);
		});

		it('Should reject with a driver error (code 4, server code 40) when an operator conflicts with the automatic dateModified', async () => {

			const model = await seed();

			await assertDriverError(getMongodbInstance().update(model, { $currentDate: { dateModified: true } }, { name: 'Test 1' }), 40);
		});

	});

	describe('pipeline', () => {

		it('Should format a stage without operators as $set', async () => {

			const model = await seed();

			const result = await getMongodbInstance().update(model, [{ value: 10 }], { name: 'Test 1' });

			assert.equal(result, 1);
			assert.equal((await findByName(model, 'Test 1')).value, 10);
		});

		it('Should accept stages with operators and reference other fields', async () => {

			const model = await seed([{ name: 'Test 1', first: 2, second: 3 }]);

			await getMongodbInstance().update(model, [
				{ $set: { total: { $add: ['$first', '$second'] } } },
				{ $unset: 'second' }
			], { name: 'Test 1' });

			const stored = await findByName(model, 'Test 1');

			assert.equal(stored.total, 5);
			assert.equal('second' in stored, false);
		});

		it('Should append the dateModified stage', async () => {

			const now = new Date();
			clock = useFakeDate(now);

			const model = await seed();

			await getMongodbInstance().update(model, [{ value: 10 }], { name: 'Test 1' });

			assert.deepEqual((await findByName(model, 'Test 1')).dateModified, now);
		});

		it('Should not append the dateModified stage with skipAutomaticSetModifiedData', async () => {

			const model = await seed();

			await getMongodbInstance().update(model, [{ value: 10 }], { name: 'Test 1' }, { skipAutomaticSetModifiedData: true });

			assert.equal('dateModified' in await findByName(model, 'Test 1'), false);
		});

		it('Should reject with code 4 wrapping INVALID_STAGES when a stage has more than one operator', async () => {

			const model = await seed();

			let error;

			try {
				await getMongodbInstance().update(model, [{ $set: { value: 1 }, $unset: 'extra' }], { name: 'Test 1' });
			} catch(err) {
				error = err;
			}

			// Current behavior: the validation is inside the try/catch, so it is wrapped as code 4 (multiUpdate() throws INVALID_STAGES as is)
			assert.ok(error instanceof MongoDBError);
			assert.equal(error.code, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
			assert.ok(error.previousError instanceof MongoDBError);
			assert.equal(error.previousError.code, MongoDBError.codes.INVALID_STAGES);
		});

	});

	describe('options', () => {

		it('Should support arrayFilters', async () => {

			const model = await seed([{
				name: 'Test 1',
				items: [{ id: 1, done: false }, { id: 2, done: false }]
			}]);

			await getMongodbInstance().update(model, { 'items.$[item].done': true }, { name: 'Test 1' }, {
				arrayFilters: [{ 'item.id': 2 }]
			});

			assert.deepEqual((await findByName(model, 'Test 1')).items, [{ id: 1, done: false }, { id: 2, done: true }]);
		});

		it('Should upsert when there are no matches and upsert is true', async () => {

			const model = await seed();

			const result = await getMongodbInstance().update(model, { value: 10 }, { name: 'New' }, { upsert: true, updateOne: true });

			// Current behavior: only modifiedCount is returned, an upsert counts as 0
			assert.equal(result, 0);

			const stored = await findByName(model, 'New');

			assert.equal(stored.value, 10);
			assert.equal(stored.dateModified instanceof Date, true);
		});

		it('Should not create documents without upsert', async () => {

			const model = await seed();

			await getMongodbInstance().update(model, { value: 10 }, { name: 'New' });

			assert.equal(await findByName(model, 'New'), undefined);
		});

	});

	describe('errors', () => {

		it('Should reject with a driver error (code 4, server code 11000) when a unique index is violated', async () => {

			const model = await seed();

			await assertDriverError(getMongodbInstance().update(model, { name: 'Test 2' }, { name: 'Test 1' }), 11000);
		});

		it('Should reject with a driver error (code 4) when the update operator is unknown', async () => {

			const model = await seed();

			const error = await assertDriverError(getMongodbInstance().update(model, { $foo: { value: 1 } }, { name: 'Test 1' }), 9);

			assert.match(error.message, /\$foo/);
		});

		it('Should reject with code 4 wrapping INVALID_FILTER_TYPE when a filter type is invalid', async () => {

			const model = await seed();

			let error;

			try {
				await getMongodbInstance().update(model, { value: 1 }, { name: { type: 'invalid', value: 'x' } });
			} catch(err) {
				error = err;
			}

			// Current behavior: the validation is inside the try/catch, so it is wrapped as code 4 (get() throws INVALID_FILTER_TYPE as is)
			assert.ok(error instanceof MongoDBError);
			assert.equal(error.code, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
			assert.ok(error.previousError instanceof MongoDBError);
			assert.equal(error.previousError.code, MongoDBError.codes.INVALID_FILTER_TYPE);
		});

		it('Should reject with code 4 wrapping a BSONError when the id filter is not a valid ObjectId', async () => {

			const model = await seed();

			let error;

			try {
				await getMongodbInstance().update(model, { value: 1 }, { id: 'not-an-object-id' });
			} catch(err) {
				error = err;
			}

			// Current behavior: wrapped as code 4 (get()/save()/remove() throw the raw BSONError)
			assert.ok(error instanceof MongoDBError);
			assert.equal(error.code, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
			assert.equal(error.previousError?.name, 'BSONError');
		});

	});

});
