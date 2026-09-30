'use strict';

const assert = require('node:assert').strict;

const MongoDBError = require('../../lib/mongodb-error');

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, assertDriverError, useFakeDate, findRaw } = require('./_helpers');

describe('multiUpdate()', () => {

	let clock;

	const seed = async (items = [{ name: 'A', group: 'x' }, { name: 'B', group: 'x' }, { name: 'C', group: 'y' }]) => {

		const model = new TestModel();

		await getMongodbInstance().multiInsert(model, items);

		return model;
	};

	const findByName = async (model, name) => (await findRaw(model, { name }))[0];

	beforeEach(async () => {
		await getMongodbInstance().createIndexes(new TestModel(), TestModel.indexes);
	});

	afterEach(async () => {
		clock?.restore();
		clock = undefined;
		await cleanCollection();
	});

	it('Should apply every operation and return true without rawResponse', async () => {

		const model = await seed();

		const result = await getMongodbInstance().multiUpdate(model, [
			{ filter: { name: 'A' }, data: { value: 1 } },
			{ filter: { name: 'B' }, data: { value: 2 } }
		]);

		assert.equal(result, true);
		assert.equal((await findByName(model, 'A')).value, 1);
		assert.equal((await findByName(model, 'B')).value, 2);
		assert.equal('value' in await findByName(model, 'C'), false);
	});

	it('Should return true even when no document matches', async () => {

		const model = await seed();

		const result = await getMongodbInstance().multiUpdate(model, [{ filter: { name: 'Nope' }, data: { value: 1 } }]);

		assert.equal(result, true);
	});

	describe('rawResponse', () => {

		it('Should return the detailed result with counts and the echo of operations and options', async () => {

			const model = await seed();

			const operations = [
				{ filter: { name: 'A' }, data: { value: 1 }, options: { updateOne: true } },
				{ filter: { group: 'x' }, data: { flag: true } },
				{ filter: { name: 'Nope' }, data: { value: 1 } }
			];

			const result = await getMongodbInstance().multiUpdate(model, operations, { rawResponse: true });

			assert.equal(result.success, true);
			assert.equal(result.matchedCount, 3);
			assert.equal(result.modifiedCount, 3);
			assert.equal(result.upsertedCount, 0);
			assert.equal(result.insertedCount, 0);
			assert.equal(result.deletedCount, 0);
			assert.deepEqual(result.writeErrors, []);
			assert.deepEqual(result.writeConcernErrors, []);

			assert.deepEqual(result.operations, operations.map((operation, index) => ({
				index,
				filter: operation.filter,
				data: operation.data,
				options: operation.options,
				success: true,
				errors: []
			})));
		});

		it('Should count upserted documents in upsertedCount', async () => {

			const model = await seed();

			const result = await getMongodbInstance().multiUpdate(model, [
				{ filter: { name: 'New' }, data: { value: 1 }, options: { upsert: true, updateOne: true } },
				{ filter: { name: 'A' }, data: { value: 2 }, options: { upsert: true, updateOne: true } }
			], { rawResponse: true });

			assert.equal(result.success, true);
			assert.equal(result.upsertedCount, 1);
			assert.equal(result.matchedCount, 1);
			assert.equal(result.modifiedCount, 1);

			assert.equal((await findByName(model, 'New')).value, 1);
		});

		it('Should resolve with the write errors detail and apply every operation (unordered)', async () => {

			const model = await seed([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);

			const result = await getMongodbInstance().multiUpdate(model, [
				{ filter: { name: 'A' }, data: { extra: 1 } }, // succeeds
				{ filter: { name: 'B' }, data: { name: 'A' } }, // violates the unique index on `name`
				{ filter: { name: 'C' }, data: { extra: 3 } } // succeeds: the bulk is unordered
			], { rawResponse: true });

			assert.equal(result.success, false);
			assert.equal(result.modifiedCount, 2);
			assert.equal(result.writeErrors.length, 1);
			assert.equal(result.writeErrors[0].index, 1);
			assert.equal(result.writeErrors[0].code, 11000);

			assert.deepEqual(result.operations.map(({ index, success }) => ({ index, success })), [
				{ index: 0, success: true },
				{ index: 1, success: false },
				{ index: 2, success: true }
			]);

			assert.ok(result.operations[1].errors.length);

			assert.equal((await findByName(model, 'C')).extra, 3);
		});

		it('Should map the write errors to the original operation index when the failures are non-contiguous', async () => {

			const model = await seed([{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }]);

			const result = await getMongodbInstance().multiUpdate(model, [
				{ filter: { name: 'B' }, data: { name: 'A' } }, // violates the unique index on `name`
				{ filter: { name: 'C' }, data: { extra: 1 } }, // succeeds
				{ filter: { name: 'D' }, data: { name: 'A' } }, // violates the unique index on `name`
				{ filter: { name: 'C' }, data: { otherExtra: 2 } } // succeeds
			], { rawResponse: true });

			assert.equal(result.success, false);
			assert.deepEqual(result.writeErrors.map(({ index }) => index), [0, 2]);

			assert.deepEqual(result.operations.map(({ index, success }) => ({ index, success })), [
				{ index: 0, success: false },
				{ index: 1, success: true },
				{ index: 2, success: false },
				{ index: 3, success: true }
			]);

			assert.equal(result.operations[0].errors[0].index, 0);
			assert.equal(result.operations[2].errors[0].index, 2);

			const updatedDocument = await findByName(model, 'C');

			assert.equal(updatedDocument.extra, 1);
			assert.equal(updatedDocument.otherExtra, 2);
		});

	});

	describe('operation options', () => {

		it('Should use updateMany by default and updateOne when options.updateOne is true', async () => {

			const model = await seed();

			await getMongodbInstance().multiUpdate(model, [
				{ filter: { group: 'x' }, data: { many: true } },
				{ filter: { group: 'x' }, data: { one: true }, options: { updateOne: true } }
			]);

			const stored = await findRaw(model, { group: 'x' });

			assert.equal(stored.filter(item => item.many).length, 2);
			assert.equal(stored.filter(item => item.one).length, 1);
		});

		it('Should set dateModified with the client date by default', async () => {

			const now = new Date();
			clock = useFakeDate(now);

			const model = await seed();

			await getMongodbInstance().multiUpdate(model, [{ filter: { name: 'A' }, data: { value: 1 } }]);

			assert.deepEqual((await findByName(model, 'A')).dateModified, now);
			assert.equal('dateModified' in await findByName(model, 'B'), false);
		});

		it('Should not set dateModified with skipAutomaticSetModifiedData (per operation)', async () => {

			const model = await seed();

			await getMongodbInstance().multiUpdate(model, [
				{ filter: { name: 'A' }, data: { value: 1 }, options: { skipAutomaticSetModifiedData: true } },
				{ filter: { name: 'B' }, data: { value: 1 } }
			]);

			assert.equal('dateModified' in await findByName(model, 'A'), false);
			assert.equal((await findByName(model, 'B')).dateModified instanceof Date, true);
		});

		it('Should support update operators combined with plain values', async () => {

			const model = await seed([{ name: 'A', value: 1, tags: ['a'] }]);

			await getMongodbInstance().multiUpdate(model, [{
				filter: { name: 'A' },
				data: { extra: 'x', $inc: { value: 4 }, $push: { tags: 'b' } }
			}]);

			const stored = await findByName(model, 'A');

			assert.equal(stored.extra, 'x');
			assert.equal(stored.value, 5);
			assert.deepEqual(stored.tags, ['a', 'b']);
		});

		it('Should support pipeline updates', async () => {

			const model = await seed([{ name: 'A', first: 2, second: 3 }]);

			await getMongodbInstance().multiUpdate(model, [{
				filter: { name: 'A' },
				data: [{ $set: { total: { $add: ['$first', '$second'] } } }, { $unset: 'second' }]
			}]);

			const stored = await findByName(model, 'A');

			assert.equal(stored.total, 5);
			assert.equal('second' in stored, false);
			assert.equal(stored.dateModified instanceof Date, true);
		});

		it('Should support arrayFilters', async () => {

			const model = await seed([{ name: 'A', items: [{ id: 1, done: false }, { id: 2, done: false }] }]);

			await getMongodbInstance().multiUpdate(model, [{
				filter: { name: 'A' },
				data: { 'items.$[item].done': true },
				options: { arrayFilters: [{ 'item.id': 2 }] }
			}]);

			assert.deepEqual((await findByName(model, 'A')).items, [{ id: 1, done: false }, { id: 2, done: true }]);
		});

		it('Should filter by id', async () => {

			const model = await seed();
			const { _id } = await findByName(model, 'A');

			await getMongodbInstance().multiUpdate(model, [{ filter: { id: _id.toString() }, data: { value: 1 } }]);

			assert.equal((await findByName(model, 'A')).value, 1);
		});

	});

	describe('errors', () => {

		it('Should stop at the failing index and reject with code 4 (server code 11000) when rawResponse is not used', async () => {

			const model = await seed([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);

			await assertDriverError(
				getMongodbInstance().multiUpdate(model, [
					{ filter: { name: 'A' }, data: { extra: 1 } }, // succeeds
					{ filter: { name: 'B' }, data: { name: 'A' } }, // violates the unique index on `name`
					{ filter: { name: 'C' }, data: { extra: 3 } } // never executed: the bulk is ordered
				]),
				11000
			);

			assert.equal((await findByName(model, 'A')).extra, 1);
			assert.equal((await findByName(model, 'C')).extra, undefined);
		});

		it('Should reject with INVALID_MODEL when the model is missing', async () => {
			await assert.rejects(
				getMongodbInstance().multiUpdate(undefined, [{ filter: { name: 'A' }, data: { a: 1 } }]),
				{ code: MongoDBError.codes.INVALID_MODEL }
			);
		});

		it('Should reject with INVALID_ITEM when the operations are not an array or are empty', async () => {

			const model = new TestModel();

			await assert.rejects(
				getMongodbInstance().multiUpdate(model, { filter: { name: 'A' }, data: { a: 1 } }),
				{ code: MongoDBError.codes.INVALID_ITEM }
			);
			await assert.rejects(getMongodbInstance().multiUpdate(model, []), { code: MongoDBError.codes.INVALID_ITEM });
		});

		it('Should reject with INVALID_ITEM when an operation has no data, empty data or no filter', async () => {

			const model = new TestModel();

			await assert.rejects(getMongodbInstance().multiUpdate(model, [{ filter: { name: 'A' } }]), { code: MongoDBError.codes.INVALID_ITEM });
			await assert.rejects(getMongodbInstance().multiUpdate(model, [{ filter: { name: 'A' }, data: {} }]), { code: MongoDBError.codes.INVALID_ITEM });
			await assert.rejects(getMongodbInstance().multiUpdate(model, [{ data: { a: 1 } }]), { code: MongoDBError.codes.INVALID_ITEM });
			await assert.rejects(getMongodbInstance().multiUpdate(model, [{ filter: {}, data: { a: 1 } }]), { code: MongoDBError.codes.INVALID_ITEM });
		});

		it('Should reject with INVALID_STAGES (not wrapped) when a pipeline stage has more than one operator', async () => {

			const model = await seed();

			// Current behavior: unlike update() (wrapped as code 4), the validation runs outside the try/catch and is thrown as is
			await assert.rejects(
				getMongodbInstance().multiUpdate(model, [{ filter: { name: 'A' }, data: [{ $set: { value: 1 }, $unset: 'extra' }] }]),
				{ code: MongoDBError.codes.INVALID_STAGES }
			);
		});

		it('Should reject with a raw BSONError when the id filter is not a valid ObjectId', async () => {

			const model = await seed();

			// Current behavior: unlike update() (wrapped as code 4), the id conversion runs outside the try/catch and the BSONError is thrown as is

			await assert.rejects(
				getMongodbInstance().multiUpdate(model, [{ filter: { id: 'invalid' }, data: { value: 1 } }]),
				err => {
					assert.equal(err instanceof MongoDBError, false);
					assert.equal(err.name, 'BSONError');
					return true;
				}
			);
		});

		it('Should reject with INVALID_FILTER_TYPE (not wrapped) when a filter type is invalid', async () => {

			const model = await seed();

			// Current behavior: unlike update() (wrapped as code 4), the filter parsing runs outside the try/catch and the error is thrown as is

			await assert.rejects(
				getMongodbInstance().multiUpdate(model, [{ filter: { name: { type: 'invalidType', value: 'A' } }, data: { value: 1 } }]),
				{ code: MongoDBError.codes.INVALID_FILTER_TYPE }
			);
		});

	});

});
