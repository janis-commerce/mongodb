/* eslint-disable max-classes-per-file */

'use strict';

const assert = require('node:assert').strict;

const { ObjectId } = require('../../lib/mongodb');
const MongoDBError = require('../../lib/mongodb-error');

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, assertDriverError, useFakeDate, findRaw } = require('./_helpers');

describe('save()', () => {

	let clock;

	beforeEach(async () => {
		await getMongodbInstance().createIndexes(new TestModel(), TestModel.indexes);
	});

	afterEach(async () => {
		clock?.restore();
		clock = undefined;
		await cleanCollection();
	});

	it('Should upsert a new document by the unique index and return the generated id', async () => {

		const now = new Date();
		clock = useFakeDate(now);

		const model = new TestModel();

		const id = await getMongodbInstance().save(model, { name: 'Test', value: 1 });

		assert.equal(typeof id, 'string');
		assert.equal(ObjectId.isValid(id), true);

		const [stored] = await findRaw(model);

		assert.equal(stored._id.toString(), id);
		assert.equal(stored.name, 'Test');
		assert.equal(stored.value, 1);
		assert.deepEqual(stored.dateCreated, now);
		// $currentDate also applies on the insert of an upsert
		assert.equal(stored.dateModified instanceof Date, true);
	});

	it('Should update the existing document by the unique index and return the same id', async () => {

		const model = new TestModel();

		const insertedId = await getMongodbInstance().save(model, { name: 'Test', value: 1 });
		const updatedId = await getMongodbInstance().save(model, { name: 'Test', value: 2 });

		assert.equal(updatedId, insertedId);

		const stored = await findRaw(model);

		assert.equal(stored.length, 1);
		assert.equal(stored[0].value, 2);
	});

	it('Should update the existing document by id even if the unique index value changes', async () => {

		const model = new TestModel();

		const id = await getMongodbInstance().save(model, { name: 'Test', value: 1 });
		const updatedId = await getMongodbInstance().save(model, { id, name: 'Renamed', value: 2 });

		assert.equal(updatedId, id);

		const stored = await findRaw(model);

		assert.equal(stored.length, 1);
		assert.equal(stored[0].name, 'Renamed');
		assert.equal(stored[0].value, 2);
	});

	it('Should insert a new document with the given id when the id does not exist', async () => {

		const model = new TestModel();
		const id = new ObjectId().toString();

		const savedId = await getMongodbInstance().save(model, { id, name: 'Test' });

		assert.equal(savedId, id);

		const [stored] = await findRaw(model);

		assert.equal(stored._id.toString(), id);
		assert.equal(stored.name, 'Test');
	});

	it('Should keep dateCreated on update and never overwrite it with the item value', async () => {

		const model = new TestModel();
		const dateCreated = new Date('2020-01-02T03:04:05.000Z');

		const id = await getMongodbInstance().save(model, { name: 'Test', dateCreated });

		await getMongodbInstance().save(model, { name: 'Test', value: 1, dateCreated: new Date('2021-01-01T00:00:00.000Z') });

		const [stored] = await findRaw(model, { _id: new ObjectId(id) });

		assert.deepEqual(stored.dateCreated, dateCreated);
		assert.equal(stored.value, 1);
	});

	it('Should set an ISO string dateCreated as Date on insert', async () => {

		const model = new TestModel();

		await getMongodbInstance().save(model, { name: 'Test', dateCreated: '2020-01-02T03:04:05.000Z' });

		const [stored] = await findRaw(model);

		assert.deepEqual(stored.dateCreated, new Date('2020-01-02T03:04:05.000Z'));
	});

	it('Should set dateModified with the server date ($currentDate), not with the client date', async () => {

		const model = new TestModel();
		const before = Date.now();

		clock = useFakeDate(new Date('2000-01-01T00:00:00.000Z'));

		await getMongodbInstance().save(model, { name: 'Test' });

		const [stored] = await findRaw(model);

		assert.equal(stored.dateModified instanceof Date, true);
		// Real server time: far away from the faked client date
		assert.ok(stored.dateModified.getTime() >= before - 60000);
	});

	it('Should not set dateModified when skipAutomaticSetModifiedData is true', async () => {

		const model = new TestModel();

		await getMongodbInstance().save(model, { name: 'Test' }, undefined, { skipAutomaticSetModifiedData: true });
		await getMongodbInstance().save(model, { name: 'Test', value: 1 }, undefined, { skipAutomaticSetModifiedData: true });

		const [stored] = await findRaw(model);

		assert.equal(stored.value, 1);
		assert.equal('dateModified' in stored, false);
	});

	it('Should ignore a dateModified received in the item', async () => {

		const model = new TestModel();
		const dateModified = new Date('2000-01-01T00:00:00.000Z');

		await getMongodbInstance().save(model, { name: 'Test', dateModified });

		const [stored] = await findRaw(model);

		assert.notDeepEqual(stored.dateModified, dateModified);
		assert.equal(stored.dateModified instanceof Date, true);
	});

	describe('setOnInsert', () => {

		it('Should apply the setOnInsert values when the document is inserted', async () => {

			const model = new TestModel();

			await getMongodbInstance().save(model, { name: 'Test' }, { status: 'pending', counter: 0 });

			const [stored] = await findRaw(model);

			assert.equal(stored.status, 'pending');
			assert.equal(stored.counter, 0);
		});

		it('Should not overwrite existing values with setOnInsert when the document is updated', async () => {

			const model = new TestModel();

			await getMongodbInstance().save(model, { name: 'Test' }, { status: 'pending' });
			await getMongodbInstance().save(model, { name: 'Test', value: 1 }, { status: 'other' });

			const [stored] = await findRaw(model);

			assert.equal(stored.status, 'pending');
			assert.equal(stored.value, 1);
		});

		it('Should ignore the setOnInsert keys that are present in the item', async () => {

			const model = new TestModel();

			await getMongodbInstance().save(model, { name: 'Test', status: 'from-item' }, { status: 'from-set-on-insert', other: 'x' });

			const [stored] = await findRaw(model);

			assert.equal(stored.status, 'from-item');
			assert.equal(stored.other, 'x');
		});

	});

	describe('update operators in the item', () => {

		it('Should apply $push, $inc and $unset operators', async () => {

			const model = new TestModel();

			await getMongodbInstance().save(model, { name: 'Test', tags: ['a'], counter: 1, toRemove: 'x' });

			await getMongodbInstance().save(model, {
				name: 'Test',
				$push: { tags: 'b' },
				$inc: { counter: 5 },
				$unset: { toRemove: '' }
			});

			const [stored] = await findRaw(model);

			assert.deepEqual(stored.tags, ['a', 'b']);
			assert.equal(stored.counter, 6);
			assert.equal('toRemove' in stored, false);
		});

		it('Should apply the operators when the document is inserted (upsert)', async () => {

			const model = new TestModel();

			await getMongodbInstance().save(model, { name: 'Test', $inc: { counter: 3 }, $push: { tags: 'a' } });

			const [stored] = await findRaw(model);

			assert.equal(stored.counter, 3);
			assert.deepEqual(stored.tags, ['a']);
		});

		it('Should reject with a driver error (code 4, server code 40) when the operators conflict with a field', async () => {

			const model = new TestModel();

			await getMongodbInstance().save(model, { name: 'Test', counter: 1 });

			await assertDriverError(getMongodbInstance().save(model, { name: 'Test', counter: 2, $inc: { counter: 1 } }), 40);
		});

	});

	describe('unique indexes', () => {

		class CompoundIndexModel extends TestModel {

			static get indexes() {
				return [{ name: 'compound', key: { country: 1, code: 1 }, unique: true }];
			}

		}

		it('Should match the compound unique index using every field', async () => {

			const model = new CompoundIndexModel();

			// The default `name` unique index would collide (documents without `name`)
			await cleanCollection();
			await getMongodbInstance().createIndexes(model, CompoundIndexModel.indexes);

			const firstId = await getMongodbInstance().save(model, { country: 'AR', code: 1, value: 1 });
			const secondId = await getMongodbInstance().save(model, { country: 'AR', code: 2, value: 2 });
			const updatedId = await getMongodbInstance().save(model, { country: 'AR', code: 1, value: 3 });

			assert.notEqual(firstId, secondId);
			assert.equal(updatedId, firstId);

			const stored = await findRaw(model);

			assert.equal(stored.length, 2);
			assert.equal(stored.find(({ code }) => code === 1).value, 3);
		});

		it('Should reject with EMPTY_UNIQUE_INDEXES when the item does not cover the compound index', async () => {

			const model = new CompoundIndexModel();

			await assert.rejects(
				getMongodbInstance().save(model, { country: 'AR', value: 1 }),
				err => err instanceof MongoDBError && err.code === MongoDBError.codes.EMPTY_UNIQUE_INDEXES
			);
		});

		it('Should reject with a driver error (code 4, server code 11000) when another unique index is violated', async () => {

			class TwoIndexesModel extends TestModel {

				static get indexes() {
					return [
						...TestModel.indexes,
						{ name: 'code', key: { code: 1 }, unique: true }
					];
				}

			}

			const model = new TwoIndexesModel();

			await getMongodbInstance().createIndexes(model, TwoIndexesModel.indexes);

			await getMongodbInstance().save(model, { name: 'Test 1', code: 'X' });

			await assertDriverError(getMongodbInstance().save(model, { name: 'Test 2', code: 'X' }), 11000);
		});

	});

	describe('errors', () => {

		it('Should reject with MODEL_EMPTY_UNIQUE_INDEXES when the model has no unique indexes', async () => {

			class NoIndexesModel extends TestModel {

				static get indexes() {
					return [{ name: 'value', key: { value: 1 } }];
				}

			}

			await assert.rejects(
				getMongodbInstance().save(new NoIndexesModel(), { name: 'Test' }),
				err => err instanceof MongoDBError && err.code === MongoDBError.codes.MODEL_EMPTY_UNIQUE_INDEXES
			);
		});

		it('Should reject with a raw BSONError when the id is not a valid ObjectId', async () => {

			let error;

			try {
				await getMongodbInstance().save(new TestModel(), { id: 'not-an-object-id', name: 'Test' });
			} catch(err) {
				error = err;
			}

			// Current behavior: the id is cast before the try/catch, so it is thrown as is (insert() wraps it as code 4)
			assert.ok(error);
			assert.equal(error instanceof MongoDBError, false);
			assert.equal(error.name, 'BSONError');
		});

	});

});
