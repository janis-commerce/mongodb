'use strict';

const assert = require('node:assert').strict;

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, assertDriverError } = require('./_helpers');

describe('getTotals()', () => {

	const seed = async (total = 25) => {

		const model = new TestModel();

		const items = Array.from({ length: total }, (item, index) => ({ name: `Item ${index}`, position: index, even: index % 2 === 0 }));

		await getMongodbInstance().multiInsert(model, items);

		return model;
	};

	afterEach(async () => {
		await cleanCollection();
	});

	it('Should return page 0 and the whole count when there is no previous get()', async () => {

		const model = await seed();

		const result = await getMongodbInstance().getTotals(model);

		// estimatedDocumentCount() branch, page defaults to 0 (as documented in the README)
		assert.deepEqual(result, { total: 25, pageSize: 500, pages: 1, page: 0 });
	});

	it('Should return zero totals without querying when the previous get() returned no documents', async () => {

		const mongodb = getMongodbInstance();
		const model = new TestModel();

		await mongodb.get(model, {});

		// Documents inserted after the empty get() are not counted: the query is skipped
		await mongodb.insert(model, { name: 'Late' });

		const result = await mongodb.getTotals(model);

		assert.deepEqual(result, { total: 0, pages: 0 });
	});

	it('Should deduce the total from the last page without querying', async () => {

		const mongodb = getMongodbInstance();
		const model = await seed();

		await mongodb.get(model, { limit: 10, page: 3, filters: { position: { type: 'greaterOrEqual', value: 0 } } });

		// Documents inserted after the get() are not counted: total is (page - 1) * limit + length
		await mongodb.multiInsert(model, [{ name: 'Late 1' }, { name: 'Late 2' }]);

		const result = await mongodb.getTotals(model);

		assert.deepEqual(result, { total: 25, pageSize: 10, pages: 3, page: 3 });
	});

	it('Should use countDocuments with the filters of the previous get() when the page is full', async () => {

		const mongodb = getMongodbInstance();
		const model = await seed();

		await mongodb.get(model, { limit: 5, page: 1, filters: { even: true } });

		const result = await mongodb.getTotals(model);

		assert.deepEqual(result, { total: 13, pageSize: 5, pages: 3, page: 1 });
	});

	it('Should use countDocuments with the received filter over the ones of the previous get()', async () => {

		const mongodb = getMongodbInstance();
		const model = await seed();

		await mongodb.get(model, { limit: 5, filters: { even: true } });

		const result = await mongodb.getTotals(model, { even: false });

		assert.deepEqual(result, { total: 12, pageSize: 5, pages: 3, page: 1 });
	});

	it('Should map id filters to ObjectId', async () => {

		const mongodb = getMongodbInstance();
		const model = await seed();

		const [{ id }] = await mongodb.get(model, { limit: 1 });

		const result = await mongodb.getTotals(model, { id });

		assert.equal(result.total, 1);
	});

	it('Should use estimatedDocumentCount when the previous get() has no filters and the page is full', async () => {

		const mongodb = getMongodbInstance();
		const model = await seed();

		await mongodb.get(model, { limit: 10, page: 1 });

		const result = await mongodb.getTotals(model);

		assert.deepEqual(result, { total: 25, pageSize: 10, pages: 3, page: 1 });
	});

	it('Should limit the count with params.limit when there are filters', async () => {

		const mongodb = getMongodbInstance();
		const model = await seed();

		await mongodb.get(model, { limit: 5, filters: { even: true } });

		const result = await mongodb.getTotals(model, {}, { limit: 7 });

		assert.deepEqual(result, { total: 7, pageSize: 5, pages: 2, page: 1 });
	});

	it('Should ignore params.limit when there are no filters', async () => {

		const mongodb = getMongodbInstance();
		const model = await seed();

		await mongodb.get(model, { limit: 10 });

		const result = await mongodb.getTotals(model, {}, { limit: 7 });

		assert.equal(result.total, 25);
	});

	it('Should use params.hint over the hint of the previous get()', async () => {

		const mongodb = getMongodbInstance();
		const model = await seed();

		await mongodb.createIndexes(model, [
			{ name: 'position_idx', key: { position: 1 } },
			{ name: 'even_idx', key: { even: 1 } }
		]);

		await mongodb.get(model, { limit: 5, filters: { even: true }, hint: 'position_idx' });

		const withGetHint = await mongodb.getTotals(model);
		const withParamsHint = await mongodb.getTotals(model, {}, { hint: 'even_idx' });

		assert.equal(withGetHint.total, 13);
		assert.equal(withParamsHint.total, 13);

		// The hint of params has priority: if it does not exist, the query fails even though the get() one was valid
		// 2 = BadValue
		await assertDriverError(mongodb.getTotals(model, {}, { hint: 'non_existent_idx' }), 2);
	});

	it('Should reject with code 4 when the hint of the previous get() does not exist in a countDocuments', async () => {

		const mongodb = getMongodbInstance();
		const model = await seed();

		await mongodb.get(model, { limit: 5, filters: { even: true } });

		model.totalsParams.hint = 'non_existent_idx';

		// 2 = BadValue
		await assertDriverError(mongodb.getTotals(model), 2);
	});

	it('Should accept readPreference in params and from the previous get()', async () => {

		const mongodb = getMongodbInstance();
		const model = await seed();

		await mongodb.get(model, { limit: 5, filters: { even: true }, readPreference: 'primary' });

		const fromGet = await mongodb.getTotals(model);
		const fromParams = await mongodb.getTotals(model, {}, { readPreference: 'primaryPreferred' });

		assert.equal(fromGet.total, 13);
		assert.equal(fromParams.total, 13);

		await mongodb.get(model, { limit: 10, readPreference: 'primary' });

		const estimated = await mongodb.getTotals(model, {}, { readPreference: 'secondaryPreferred' });

		assert.equal(estimated.total, 25);
	});

});
