'use strict';

const assert = require('node:assert').strict;

const MongoDBError = require('../../lib/mongodb-error');

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, assertDriverError } = require('./_helpers');

describe('getPaged()', () => {

	const TOTAL_DOCUMENTS = 25;

	const seed = async (total = TOTAL_DOCUMENTS) => {

		const model = new TestModel();

		const items = Array.from({ length: total }, (item, index) => ({
			name: `Item ${String(index).padStart(2, '0')}`,
			position: index,
			even: index % 2 === 0
		}));

		await getMongodbInstance().multiInsert(model, items);

		return model;
	};

	const collectPages = async (model, params) => {

		const pages = [];

		const result = await getMongodbInstance().getPaged(model, params, (items, page, limit) => {
			pages.push({ items, page, limit });
		});

		return { result, pages };
	};

	afterEach(async () => {
		await cleanCollection();
	});

	it('Should call the callback with every full page and a partial last page', async () => {

		const model = await seed();

		const { result, pages } = await collectPages(model, { limit: 10, order: { position: 'asc' } });

		assert.deepEqual(result, { total: 25, batchSize: 10, pages: 3 });

		assert.deepEqual(pages.map(({ items, page, limit }) => ({ length: items.length, page, limit })), [
			{ length: 10, page: 1, limit: 10 },
			{ length: 10, page: 2, limit: 10 },
			{ length: 5, page: 3, limit: 10 }
		]);

		assert.deepEqual(pages.flatMap(({ items }) => items.map(({ position }) => position)), Array.from({ length: 25 }, (item, index) => index));

		pages[0].items.forEach(item => {
			assert.equal(typeof item.id, 'string');
			assert.equal('_id' in item, false);
		});
	});

	it('Should not add an empty page when the total is a multiple of the limit', async () => {

		const model = await seed(20);

		const { result, pages } = await collectPages(model, { limit: 10 });

		assert.deepEqual(result, { total: 20, batchSize: 10, pages: 2 });
		assert.equal(pages.length, 2);
	});

	it('Should return zero totals and not call the callback if the collection is empty', async () => {

		const { result, pages } = await collectPages(new TestModel(), { limit: 10 });

		assert.deepEqual(result, { total: 0, batchSize: 10, pages: 0 });
		assert.deepEqual(pages, []);
	});

	it('Should apply the filters', async () => {

		const model = await seed();

		const { result, pages } = await collectPages(model, { limit: 5, filters: { even: true } });

		assert.deepEqual(result, { total: 13, batchSize: 5, pages: 3 });
		assert.equal(pages.flatMap(({ items }) => items).every(({ even }) => even), true);
	});

	it('Should apply the order', async () => {

		const model = await seed();

		const { pages } = await collectPages(model, { limit: 10, order: { position: 'desc' } });

		const positions = pages.flatMap(({ items }) => items.map(({ position }) => position));

		assert.deepEqual(positions, Array.from({ length: 25 }, (item, index) => 24 - index));
	});

	it('Should apply fields and excludeFields', async () => {

		const model = await seed(3);

		const { pages: withFields } = await collectPages(model, { fields: ['name'], order: { position: 'asc' } });
		const { pages: withExclude } = await collectPages(model, { excludeFields: ['even', 'dateCreated'], order: { position: 'asc' } });

		assert.deepEqual(Object.keys(withFields[0].items[0]).sort(), ['id', 'name']);
		assert.deepEqual(Object.keys(withExclude[0].items[0]).sort(), ['id', 'name', 'position']);
	});

	it('Should use the config limit as batch size when limit is not received', async () => {

		const model = await seed(3);

		const { result, pages } = await collectPages(model, {});

		// Default config limit is 500
		assert.deepEqual(result, { total: 3, batchSize: 500, pages: 1 });
		assert.equal(pages[0].limit, 500);
	});

	it('Should ignore page and returnType', async () => {

		const model = await seed();

		const { result, pages } = await collectPages(model, { limit: 10, page: 3, returnType: 'cursor', order: { position: 'asc' } });

		assert.deepEqual(result, { total: 25, batchSize: 10, pages: 3 });
		assert.equal(pages[0].items[0].position, 0);
	});

	it('Should use a valid hint and reject with code 4 if the hint index does not exist', async () => {

		const model = await seed(3);
		const mongodb = getMongodbInstance();

		await mongodb.createIndex(model, { name: 'position_idx', key: { position: 1 } });

		const { result } = await collectPages(model, { hint: 'position_idx' });

		assert.equal(result.total, 3);

		// 2 = BadValue
		await assertDriverError(mongodb.getPaged(model, { hint: 'non_existent_idx' }, () => {}), 2);
	});

	it('Should accept readPreference', async () => {

		const model = await seed(3);

		const { result } = await collectPages(model, { readPreference: 'primary' });

		assert.equal(result.total, 3);
	});

	it('Should await an async callback before calling it with the next page', async () => {

		const model = await seed();

		const events = [];

		await getMongodbInstance().getPaged(model, { limit: 10 }, async (items, page) => {
			events.push(`start ${page}`);
			await new Promise(resolve => { setTimeout(resolve, 20); });
			events.push(`end ${page}`);
		});

		assert.deepEqual(events, ['start 1', 'end 1', 'start 2', 'end 2', 'start 3', 'end 3']);
	});

	it('Should reject with code 4 when the callback throws', async () => {

		const model = await seed(3);

		const callbackError = new Error('Callback failed');

		const error = await getMongodbInstance()
			.getPaged(model, {}, () => { throw callbackError; })
			.catch(err => err);

		assert.ok(error instanceof MongoDBError);
		assert.equal(error.code, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		assert.equal(error.previousError, callbackError);
	});

	it('Should reject with code 4 when the async callback rejects and stop calling it', async () => {

		const model = await seed();

		let calls = 0;

		const error = await getMongodbInstance()
			.getPaged(model, { limit: 10 }, async () => {
				calls++;
				throw new Error('Async callback failed');
			})
			.catch(err => err);

		assert.ok(error instanceof MongoDBError);
		assert.equal(error.code, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		assert.equal(calls, 1);
	});

});
