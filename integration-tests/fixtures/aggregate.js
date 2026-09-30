'use strict';

const assert = require('node:assert').strict;

const { ObjectId } = require('../../lib/mongodb');

const TestModel = require('./_model');
const { TestModelWithFields } = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, assertDriverError } = require('./_helpers');

describe('aggregate()', () => {

	const TOTAL_DOCUMENTS = 1500;

	const seedSmall = async (model = new TestModel()) => {

		await getMongodbInstance().multiInsert(model, [
			{ name: 'Alice', group: 'a', amount: 10 },
			{ name: 'Bob', group: 'a', amount: 20 },
			{ name: 'Carol', group: 'b', amount: 30 },
			{ name: 'Dave', group: 'b', amount: 40 },
			{ name: 'Eve', group: 'c', amount: 50 }
		]);

		return model;
	};

	afterEach(async () => {
		await cleanCollection();
	});

	it('Should return every document even when there are more than the driver default batchSize', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		const items = Array.from({ length: TOTAL_DOCUMENTS }, (documentValue, index) => ({ name: `Item ${index}` }));

		await mongodb.multiInsert(model, items);

		const result = await mongodb.aggregate(model, [{ $match: {} }]);

		assert.equal(result.length, TOTAL_DOCUMENTS);
	});

	it('Should return an empty array if the collection is empty', async () => {

		const result = await getMongodbInstance().aggregate(new TestModel(), [{ $match: {} }]);

		assert.deepEqual(result, []);
	});

	it('Should return every document if the pipeline has no stages', async () => {

		const model = await seedSmall();

		const result = await getMongodbInstance().aggregate(model, []);

		assert.equal(result.length, 5);
	});

	it('Should map _id to a string id in the results', async () => {

		const model = await seedSmall();

		const result = await getMongodbInstance().aggregate(model, [{ $match: { name: 'Alice' } }]);

		assert.equal(result.length, 1);
		assert.equal(typeof result[0].id, 'string');
		assert.equal(ObjectId.isValid(result[0].id), true);
		assert.equal('_id' in result[0], false);
	});

	it('Should convert id to _id ObjectId in $match', async () => {

		const model = await seedSmall();
		const mongodb = getMongodbInstance();

		const [{ id }] = await mongodb.get(model, { filters: { name: 'Carol' } });

		const result = await mongodb.aggregate(model, [{ $match: { id } }]);

		assert.deepEqual(result.map(({ name }) => name), ['Carol']);
		assert.equal(result[0].id, id);
	});

	it('Should convert the ids inside $in, $nin, $eq and $ne in $match', async () => {

		const model = await seedSmall();
		const mongodb = getMongodbInstance();

		const [first, second] = await mongodb.get(model, { order: { name: 'asc' }, limit: 2 });

		const names = async id => (await mongodb.aggregate(model, [{ $match: { id } }, { $sort: { name: 1 } }])).map(({ name }) => name);

		assert.deepEqual(await names({ $in: [first.id, second.id] }), ['Alice', 'Bob']);
		assert.deepEqual(await names({ $nin: [first.id, second.id] }), ['Carol', 'Dave', 'Eve']);
		assert.deepEqual(await names({ $eq: first.id }), ['Alice']);
		assert.deepEqual(await names({ $ne: first.id }), ['Bob', 'Carol', 'Dave', 'Eve']);
	});

	it('Should convert the isID fields of the stages to ObjectId', async () => {

		const model = new TestModelWithFields();
		const mongodb = getMongodbInstance();

		const parentId = '5f8a7b2c9d1e4f0012345678';

		await mongodb.multiInsert(model, [
			{ name: 'A', parentId },
			{ name: 'B', parentId: '5f8a7b2c9d1e4f0012345679' }
		]);

		const result = await mongodb.aggregate(model, [{ $match: { parentId } }]);

		assert.deepEqual(result.map(({ name }) => name), ['A']);

		const operators = await mongodb.aggregate(model, [
			{ $match: { parentId: { $in: [parentId] } } }
		]);

		assert.deepEqual(operators.map(({ name }) => name), ['A']);

		const excluded = await mongodb.aggregate(model, [
			{ $match: { parentId: { $ne: parentId } } }
		]);

		assert.deepEqual(excluded.map(({ name }) => name), ['B']);
	});

	it('Should run $group and map the _id of the groups to a string id', async () => {

		const model = await seedSmall();

		const result = await getMongodbInstance().aggregate(model, [
			{ $group: { _id: '$group', total: { $sum: '$amount' }, count: { $sum: 1 } } },
			{ $sort: { _id: 1 } }
		]);

		assert.deepEqual(result, [
			{ id: 'a', total: 30, count: 2 },
			{ id: 'b', total: 70, count: 2 },
			{ id: 'c', total: 50, count: 1 }
		]);
	});

	it('Should leave the result untouched when _id is null', async () => {

		const model = await seedSmall();

		const result = await getMongodbInstance().aggregate(model, [
			{ $group: { _id: null, total: { $sum: '$amount' } } }
		]);

		// _id null is falsy: it is not mapped to id
		assert.deepEqual(result, [{ _id: null, total: 150 }]);
	});

	it('Should map an ObjectId _id of a $group to a string id', async () => {

		const model = await seedSmall();
		const mongodb = getMongodbInstance();

		const [{ id }] = await mongodb.get(model, { filters: { name: 'Carol' } });

		const result = await mongodb.aggregate(model, [
			{ $match: { name: 'Carol' } },
			{ $group: { _id: '$_id', total: { $sum: '$amount' } } }
		]);

		assert.deepEqual(result, [{ id, total: 30 }]);
	});

	it('Should keep a number _id of a $group without mapping it', async () => {

		const model = await seedSmall();

		const result = await getMongodbInstance().aggregate(model, [
			{ $match: { name: 'Alice' } },
			{ $group: { _id: '$amount', count: { $sum: 1 } } }
		]);

		assert.deepEqual(result, [{ _id: 10, count: 1 }]);
	});

	it('Should keep an object _id of a compound $group without mapping it', async () => {

		const model = await seedSmall();

		const result = await getMongodbInstance().aggregate(model, [
			{ $match: { group: 'a' } },
			{ $group: { _id: { group: '$group' }, total: { $sum: '$amount' } } }
		]);

		assert.deepEqual(result, [{ _id: { group: 'a' }, total: 30 }]);
	});

	it('Should run $project', async () => {

		const model = await seedSmall();

		const result = await getMongodbInstance().aggregate(model, [
			{ $match: { name: 'Alice' } },
			{ $project: { _id: 0, name: 1, double: { $multiply: ['$amount', 2] } } }
		]);

		assert.deepEqual(result, [{ name: 'Alice', double: 20 }]);
	});

	it('Should run $sort and $limit', async () => {

		const model = await seedSmall();

		const result = await getMongodbInstance().aggregate(model, [
			{ $sort: { amount: -1 } },
			{ $limit: 2 },
			{ $project: { _id: 0, name: 1 } }
		]);

		assert.deepEqual(result, [{ name: 'Eve' }, { name: 'Dave' }]);
	});

	it('Should run $count, $skip and $unwind', async () => {

		const model = new TestModel();
		const mongodb = getMongodbInstance();

		await mongodb.insert(model, { name: 'Tagged', tags: ['x', 'y', 'z'] });

		const unwound = await mongodb.aggregate(model, [{ $unwind: '$tags' }, { $skip: 1 }, { $project: { _id: 0, tags: 1 } }]);
		const counted = await mongodb.aggregate(model, [{ $count: 'total' }]);

		assert.deepEqual(unwound, [{ tags: 'y' }, { tags: 'z' }]);
		assert.deepEqual(counted, [{ total: 1 }]);
	});

	it('Should accept batchSize option', async () => {

		const model = await seedSmall();

		const result = await getMongodbInstance().aggregate(model, [{ $sort: { amount: 1 } }], { batchSize: 2 });

		assert.deepEqual(result.map(({ name }) => name), ['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
	});

	it('Should accept allowDiskUse option', async () => {

		const model = await seedSmall();

		const result = await getMongodbInstance().aggregate(model, [{ $sort: { amount: -1 } }], { allowDiskUse: true });

		assert.deepEqual(result.map(({ name }) => name), ['Eve', 'Dave', 'Carol', 'Bob', 'Alice']);
	});

	it('Should accept a hint option', async () => {

		const model = await seedSmall();
		const mongodb = getMongodbInstance();

		await mongodb.createIndex(model, { name: 'amount_idx', key: { amount: 1 } });

		const result = await mongodb.aggregate(model, [{ $match: { amount: { $gte: 40 } } }], { hint: 'amount_idx' });

		assert.deepEqual(result.map(({ name }) => name), ['Dave', 'Eve']);

		// 2 = BadValue
		await assertDriverError(mongodb.aggregate(model, [{ $match: {} }], { hint: 'non_existent_idx' }), 2);
	});

	it('Should reject with code 4 and the server code when a stage is unknown', async () => {

		const model = await seedSmall();

		// 40324 = Unrecognized pipeline stage name
		await assertDriverError(getMongodbInstance().aggregate(model, [{ $unknownStage: {} }]), 40324);
	});

	it('Should reject with code 4 and a server code when a stage has an invalid argument', async () => {

		const model = await seedSmall();

		// 5107201 = $limit argument must be a positive integer
		await assertDriverError(getMongodbInstance().aggregate(model, [{ $limit: 'invalid' }]), 5107201);
	});

});
