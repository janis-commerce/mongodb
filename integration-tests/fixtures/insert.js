'use strict';

const assert = require('node:assert').strict;

const { ObjectId } = require('../../lib/mongodb');
const MongoDBError = require('../../lib/mongodb-error');

const TestModel = require('./_model');
const { TestModelWithFields, TestModelWithCustomId } = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, assertDriverError, useFakeDate, findRaw } = require('./_helpers');

describe('insert()', () => {

	let clock;

	beforeEach(async () => {
		await getMongodbInstance().createIndexes(new TestModel(), TestModel.indexes);
	});

	afterEach(async () => {
		clock?.restore();
		clock = undefined;
		await cleanCollection();
	});

	it('Should insert the document and return the generated id as a string', async () => {

		const model = new TestModel();

		const id = await getMongodbInstance().insert(model, { name: 'Test' });

		assert.equal(typeof id, 'string');
		assert.equal(ObjectId.isValid(id), true);

		const [stored] = await findRaw(model);

		assert.equal(stored._id instanceof ObjectId, true);
		assert.equal(stored._id.toString(), id);
		assert.equal(stored.name, 'Test');
	});

	it('Should make the document readable through get() with the id mapped and dateCreated', async () => {

		const now = new Date();
		clock = useFakeDate(now);

		const model = new TestModel();

		const id = await getMongodbInstance().insert(model, { name: 'Test' });

		const result = await getMongodbInstance().get(model, {});

		assert.deepEqual(result, [{ id, name: 'Test', dateCreated: now }]);
	});

	it('Should use the provided id (hex string) as ObjectId _id', async () => {

		const model = new TestModel();
		const providedId = new ObjectId().toString();

		const id = await getMongodbInstance().insert(model, { id: providedId, name: 'Test' });

		assert.equal(id, providedId);

		const [stored] = await findRaw(model);

		assert.equal(stored._id instanceof ObjectId, true);
		assert.equal(stored._id.toString(), providedId);
		assert.equal('id' in stored, false);
	});

	it('Should store the provided id untouched as a string when the model has hasCustomId', async () => {

		const model = new TestModelWithCustomId();

		const id = await getMongodbInstance().insert(model, { id: 'custom-id-1', name: 'Test' });

		assert.equal(id, 'custom-id-1');

		const [stored] = await findRaw(model);

		assert.equal(stored._id, 'custom-id-1');
		assert.equal(typeof stored._id, 'string');
	});

	it('Should convert the isID fields to ObjectId', async () => {

		const model = new TestModelWithFields();
		const parentId = new ObjectId().toString();

		await getMongodbInstance().insert(model, { name: 'Test', parentId });

		const [stored] = await findRaw(model);

		assert.equal(stored.parentId instanceof ObjectId, true);
		assert.equal(stored.parentId.toString(), parentId);
	});

	it('Should keep an explicit Date dateCreated', async () => {

		const model = new TestModel();
		const dateCreated = new Date('2020-01-02T03:04:05.000Z');

		await getMongodbInstance().insert(model, { name: 'Test', dateCreated });

		const [stored] = await findRaw(model);

		assert.deepEqual(stored.dateCreated, dateCreated);
	});

	it('Should parse an ISO string dateCreated into a Date', async () => {

		const model = new TestModel();

		await getMongodbInstance().insert(model, { name: 'Test', dateCreated: '2020-01-02T03:04:05.000Z' });

		const [stored] = await findRaw(model);

		assert.equal(stored.dateCreated instanceof Date, true);
		assert.deepEqual(stored.dateCreated, new Date('2020-01-02T03:04:05.000Z'));
	});

	it('Should use the current date when dateCreated is an invalid string', async () => {

		const now = new Date();
		clock = useFakeDate(now);

		const model = new TestModel();

		await getMongodbInstance().insert(model, { name: 'Test', dateCreated: 'not-a-date' });

		const [stored] = await findRaw(model);

		assert.deepEqual(stored.dateCreated, now);
	});

	it('Should use the current date when dateCreated is not received', async () => {

		const now = new Date();
		clock = useFakeDate(now);

		const model = new TestModel();

		await getMongodbInstance().insert(model, { name: 'Test' });

		const [stored] = await findRaw(model);

		assert.deepEqual(stored.dateCreated, now);
		assert.equal('dateModified' in stored, false);
	});

	it('Should reject with a driver error (code 4, server code 11000) when a unique index is violated', async () => {

		const model = new TestModel();

		await getMongodbInstance().insert(model, { name: 'Duplicated' });

		await assertDriverError(getMongodbInstance().insert(model, { name: 'Duplicated' }), 11000);
	});

	it('Should reject with a driver error (code 4, server code 11000) when the id already exists', async () => {

		const model = new TestModel();
		const id = new ObjectId().toString();

		await getMongodbInstance().insert(model, { id, name: 'Test 1' });

		await assertDriverError(getMongodbInstance().insert(model, { id, name: 'Test 2' }), 11000);
	});

	it('Should reject with MONGODB_INTERNAL_ERROR wrapping a BSONError when the id is not a valid ObjectId', async () => {

		let error;

		try {
			await getMongodbInstance().insert(new TestModel(), { id: 'not-an-object-id', name: 'Test' });
		} catch(err) {
			error = err;
		}

		// Current behavior: unlike get/save/remove, the id cast is inside the try/catch, so it is wrapped as code 4 (no server code)
		assert.ok(error instanceof MongoDBError);
		assert.equal(error.code, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		assert.equal(error.previousError?.name, 'BSONError');
	});

});
